import { getStore } from '@netlify/blobs'

// Session storage using Netlify Blobs
// Uses separate keys for offer, answer, and candidates to avoid race conditions
const STORE_NAME = 'signalling-sessions'

async function getSessionStore() {
  return getStore({
    name: STORE_NAME,
    consistency: 'strong'
  })
}

async function getBlob(store, key) {
  try {
    const data = await store.get(key, { type: 'json' })
    return data || null
  } catch {
    return null
  }
}

async function setBlob(store, key, value) {
  await store.setJSON(key, value)
}

async function listKeys(store, prefix) {
  try {
    const { blobs } = await store.list({ prefix })
    return blobs.map(b => b.key)
  } catch {
    return []
  }
}

// CORS headers for all responses
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json'
}

// Main handler using Netlify Functions v2 format
export default async (request, _context) => {
  const url = new URL(request.url)
  let path = url.pathname
  if (path.startsWith('/.netlify/functions/api')) {
    path = path.replace('/.netlify/functions/api', '')
  } else if (path.startsWith('/api')) {
    path = path.replace(/^\/api/, '')
  }
  if (!path.startsWith('/')) {
    path = '/' + path
  }
  const method = request.method

  if (method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders })
  }

  try {
    const store = await getSessionStore()

    // POST /signalling/offer
    if (path === '/signalling/offer' && method === 'POST') {
      const { inviteToken, alias, peerId, offer } = await request.json()
      
      if (!inviteToken || !peerId || !offer || !alias) {
        return new Response(
          JSON.stringify({ error: 'inviteToken, alias, peerId, and offer are required' }),
          { status: 400, headers: corsHeaders }
        )
      }

      // Store offer in its own key (won't conflict with answer or candidates)
      const offerKeyName = `offer:${inviteToken}:${peerId}`
      await setBlob(store, offerKeyName, { offer, alias, createdAt: Date.now() })
      
      // Also store metadata to help with listing
      const metaKeyName = `meta:${inviteToken}:${peerId}`
      await setBlob(store, metaKeyName, { inviteToken, peerId, alias, createdAt: Date.now() })

      return new Response(
        JSON.stringify({ message: 'offer stored' }),
        { status: 200, headers: corsHeaders }
      )
    }

    // POST /signalling/answer
    if (path === '/signalling/answer' && method === 'POST') {
      const { inviteToken, peerId, answer } = await request.json()
      
      if (!inviteToken || !peerId || !answer) {
        return new Response(
          JSON.stringify({ error: 'inviteToken, peerId, and answer are required' }),
          { status: 400, headers: corsHeaders }
        )
      }

      // Store answer in its own key (completely independent, no race condition)
      const answerKeyName = `answer:${inviteToken}:${peerId}`
      await setBlob(store, answerKeyName, { answer, createdAt: Date.now() })

      return new Response(
        JSON.stringify({ message: 'answer stored' }),
        { status: 200, headers: corsHeaders }
      )
    }

    // POST /signalling/candidate
    if (path === '/signalling/candidate' && method === 'POST') {
      const { inviteToken, peerId, candidate, origin } = await request.json()
      
      if (!inviteToken || !peerId || !candidate) {
        return new Response(
          JSON.stringify({ error: 'inviteToken, peerId, and candidate are required' }),
          { status: 400, headers: corsHeaders }
        )
      }

      // Store candidates in their own key with append logic
      const candidatesKeyName = `candidates:${inviteToken}:${peerId}`
      
      // Read current candidates
      let candidatesData = await getBlob(store, candidatesKeyName)
      if (!candidatesData) {
        candidatesData = { candidates: [] }
      }

      // Add new candidate
      candidatesData.candidates.push({
        candidate,
        origin: origin || 'peer',
        timestamp: Date.now()
      })

      await setBlob(store, candidatesKeyName, candidatesData)

      return new Response(null, { status: 204, headers: corsHeaders })
    }

    // GET /signalling/pending/:inviteToken
    const pendingMatch = path.match(/^\/signalling\/pending\/([^/]+)$/)
    if (pendingMatch && method === 'GET') {
      const inviteToken = decodeURIComponent(pendingMatch[1])
      
      // Find all meta keys for this invite token
      const metaKeys = await listKeys(store, `meta:${inviteToken}:`)
      
      const sessions = []
      for (const metaKey of metaKeys) {
        const meta = await getBlob(store, metaKey)
        if (!meta) continue
        
        const { peerId, alias } = meta
        
        // Fetch offer, answer, and candidates from their separate keys
        const offerData = await getBlob(store, `offer:${inviteToken}:${peerId}`)
        const answerData = await getBlob(store, `answer:${inviteToken}:${peerId}`)
        const candidatesData = await getBlob(store, `candidates:${inviteToken}:${peerId}`)
        
        sessions.push({
          peerId,
          alias: alias || offerData?.alias,
          offer: offerData?.offer || null,
          answer: answerData?.answer || null,
          candidates: candidatesData?.candidates || [],
          connectionState: answerData?.answer ? 'connected' : 'pending'
        })
      }

      if (!sessions.length) {
        return new Response(
          JSON.stringify({ error: 'no pending sessions' }),
          { status: 404, headers: corsHeaders }
        )
      }

      return new Response(
        JSON.stringify(sessions),
        { status: 200, headers: corsHeaders }
      )
    }

    // GET /signalling/session/:inviteToken/:peerId
    const sessionMatch = path.match(/^\/signalling\/session\/([^/]+)\/([^/]+)$/)
    if (sessionMatch && method === 'GET') {
      const inviteToken = decodeURIComponent(sessionMatch[1])
      const peerId = decodeURIComponent(sessionMatch[2])
      
      // Fetch from separate keys
      const offerData = await getBlob(store, `offer:${inviteToken}:${peerId}`)
      const answerData = await getBlob(store, `answer:${inviteToken}:${peerId}`)
      const candidatesData = await getBlob(store, `candidates:${inviteToken}:${peerId}`)
      
      // Session exists if we have either an offer or candidates
      if (!offerData && !candidatesData) {
        return new Response(
          JSON.stringify({ error: 'session not found' }),
          { status: 404, headers: corsHeaders }
        )
      }

      return new Response(
        JSON.stringify({
          offer: offerData?.offer || null,
          answer: answerData?.answer || null,
          candidates: candidatesData?.candidates || []
        }),
        { status: 200, headers: corsHeaders }
      )
    }

    // POST /game-instance/:instanceId/invite-regenerate
    const regenerateMatch = path.match(/^\/game-instance\/([^/]+)\/invite-regenerate$/)
    if (regenerateMatch && method === 'POST') {
      const instanceId = decodeURIComponent(regenerateMatch[1])
      const { partyId } = await request.json()
      
      if (!partyId) {
        return new Response(
          JSON.stringify({ error: 'partyId is required' }),
          { status: 400, headers: corsHeaders }
        )
      }

      const inviteToken = `${instanceId}-${partyId}-${Date.now()}`
      return new Response(
        JSON.stringify({ inviteToken }),
        { status: 200, headers: corsHeaders }
      )
    }

    // 404 for unmatched routes
    return new Response(
      JSON.stringify({ error: 'Not found', path }),
      { status: 404, headers: corsHeaders }
    )

  } catch (error) {
    console.error('API error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: error.message }),
      { status: 500, headers: corsHeaders }
    )
  }
}

export const config = {
  path: '/api/*'
}

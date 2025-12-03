import express from 'express'
import serverless from 'serverless-http'
import cors from 'cors'
import { getStore } from '@netlify/blobs'

const app = express()
app.use(cors({ origin: true, credentials: true }))
app.use(express.json())

// Helper to get the Netlify Blobs store
const getSessionStore = () => getStore('signalling-sessions')

const sessionKey = (inviteToken, peerId) => `${inviteToken}-${peerId}`

// Helper to get all sessions for an invite token
const getSessionsByInviteToken = async (store, inviteToken) => {
  const { blobs } = await store.list({ prefix: `${inviteToken}-` })
  const sessions = await Promise.all(
    blobs.map(async (blob) => {
      const data = await store.get(blob.key, { type: 'json' })
      return data
    })
  )
  return sessions.filter(Boolean)
}

app.post('/api/signalling/offer', async (req, res) => {
  const { inviteToken, alias, peerId, offer } = req.body
  if (!inviteToken || !peerId || !offer || !alias) {
    return res.status(400).json({ error: 'inviteToken, alias, peerId, and offer are required' })
  }

  const store = getSessionStore()
  const key = sessionKey(inviteToken, peerId)
  
  await store.setJSON(key, {
    inviteToken,
    peerId,
    alias,
    offer,
    answer: null,
    candidates: [],
    createdAt: Date.now()
  })

  res.status(200).json({ message: 'offer stored' })
})

app.post('/api/signalling/answer', async (req, res) => {
  const { inviteToken, peerId, answer } = req.body
  if (!inviteToken || !peerId || !answer) {
    return res.status(400).json({ error: 'inviteToken, peerId, and answer are required' })
  }

  const store = getSessionStore()
  const key = sessionKey(inviteToken, peerId)
  const session = await store.get(key, { type: 'json' })
  
  if (!session) {
    return res.status(404).json({ error: 'session not found' })
  }

  session.answer = answer
  await store.setJSON(key, session)
  
  res.status(200).json({ message: 'answer stored' })
})

app.post('/api/signalling/candidate', async (req, res) => {
  const { inviteToken, peerId, candidate } = req.body
  if (!inviteToken || !peerId || !candidate) {
    return res.status(400).json({ error: 'inviteToken, peerId, and candidate are required' })
  }

  const store = getSessionStore()
  const key = sessionKey(inviteToken, peerId)
  const session = await store.get(key, { type: 'json' })
  
  if (!session) {
    return res.status(404).json({ error: 'session not found' })
  }

  session.candidates.push({
    candidate,
    origin: req.body.origin || 'peer',
    timestamp: Date.now()
  })
  
  await store.setJSON(key, session)
  res.sendStatus(204)
})

app.get('/api/signalling/pending/:inviteToken', async (req, res) => {
  const { inviteToken } = req.params
  const store = getSessionStore()
  
  const matches = await getSessionsByInviteToken(store, inviteToken)

  if (!matches.length) {
    return res.status(404).json({ error: 'no pending sessions' })
  }

  const payload = matches.map((session) => ({
    peerId: session.peerId,
    alias: session.alias,
    offer: session.offer,
    answer: session.answer,
    candidates: session.candidates,
    connectionState: session.answer ? 'connected' : 'pending'
  }))

  res.json(payload)
})

app.get('/api/signalling/session/:inviteToken/:peerId', async (req, res) => {
  const { inviteToken, peerId } = req.params
  const store = getSessionStore()
  const key = sessionKey(inviteToken, peerId)
  const session = await store.get(key, { type: 'json' })
  
  if (!session) {
    return res.status(404).json({ error: 'session not found' })
  }

  res.json({
    offer: session.offer,
    answer: session.answer,
    candidates: session.candidates
  })
})

app.post('/api/game-instance/:instanceId/invite-regenerate', (req, res) => {
  const { instanceId } = req.params
  const { partyId } = req.body
  if (!partyId) {
    return res.status(400).json({ error: 'partyId is required' })
  }

  const inviteToken = `${instanceId}-${partyId}-${Date.now()}`
  res.status(200).json({ inviteToken })
})

export const handler = serverless(app)

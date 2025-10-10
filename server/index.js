import express from 'express'
import { createServer } from 'node:http'
import { WebSocketServer, WebSocket } from 'ws'
import { randomUUID } from 'node:crypto'

const PORT = Number(process.env.PORT || 3001)

const app = express()

app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') {
    res.sendStatus(204)
    return
  }
  next()
})

app.use(express.json())

const invites = new Map()
const sessions = new Map()

function getSession(sessionId) {
  if (!sessions.has(sessionId)) {
    sessions.set(sessionId, { clients: new Map() })
  }
  return sessions.get(sessionId)
}

app.get('/health', (req, res) => {
  res.json({ status: 'ok' })
})

app.post('/api/invites', (req, res) => {
  const { sessionId, partyId } = req.body || {}
  if (!sessionId || !partyId) {
    res.status(400).json({ error: 'sessionId and partyId are required' })
    return
  }
  const inviteId = randomUUID()
  invites.set(inviteId, {
    sessionId,
    partyId,
    createdAt: Date.now()
  })
  res.json({ inviteId })
})

app.get('/api/invites/:inviteId', (req, res) => {
  const invite = invites.get(req.params.inviteId)
  if (!invite) {
    res.status(404).json({ error: 'Invite not found' })
    return
  }
  res.json({ inviteId: req.params.inviteId, ...invite })
})

const server = createServer(app)
const wss = new WebSocketServer({ server, path: '/signal' })

wss.on('connection', (socket, request) => {
  const url = new URL(request.url || '', 'http://localhost')
  const sessionId = url.searchParams.get('sessionId')
  if (!sessionId) {
    socket.close(1008, 'sessionId required')
    return
  }
  const clientId = url.searchParams.get('clientId') || randomUUID()
  const session = getSession(sessionId)
  session.clients.set(clientId, socket)

  socket.send(JSON.stringify({ type: 'welcome', clientId }))

  socket.on('message', (raw) => {
    let payload
    try {
      payload = JSON.parse(raw.toString())
    } catch (err) {
      return
    }
    session.clients.forEach((client, otherId) => {
      if (otherId === clientId || client.readyState !== WebSocket.OPEN) return
      const message = { ...payload, senderId: clientId }
      try {
        client.send(JSON.stringify(message))
      } catch (err) {
        // ignore send errors
      }
    })
  })

  socket.on('close', () => {
    session.clients.delete(clientId)
    if (session.clients.size === 0) {
      sessions.delete(sessionId)
    }
  })

  socket.on('error', () => {
    session.clients.delete(clientId)
  })
})

server.listen(PORT, () => {
  console.log(`Signal server listening on port ${PORT}`)
})

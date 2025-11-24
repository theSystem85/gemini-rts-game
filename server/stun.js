import express from 'express'

const PORT = process.env.STUN_PORT ?? 3333
const app = express()
app.use(express.json())

const sessions = new Map()

const sessionKey = (inviteToken, peerId) => `${inviteToken}-${peerId}`

app.post('/signalling/offer', (req, res) => {
  const { inviteToken, alias, peerId, offer } = req.body
  if (!inviteToken || !peerId || !offer || !alias) {
    return res.status(400).json({ error: 'inviteToken, alias, peerId, and offer are required' })
  }

  sessions.set(sessionKey(inviteToken, peerId), {
    inviteToken,
    peerId,
    alias,
    offer,
    answer: null,
    candidates: []
  })

  res.status(200).json({ message: 'offer stored' })
})

app.post('/signalling/answer', (req, res) => {
  const { inviteToken, peerId, answer } = req.body
  if (!inviteToken || !peerId || !answer) {
    return res.status(400).json({ error: 'inviteToken, peerId, and answer are required' })
  }

  const session = sessions.get(sessionKey(inviteToken, peerId))
  if (!session) {
    return res.status(404).json({ error: 'session not found' })
  }

  session.answer = answer
  res.status(200).json({ message: 'answer stored' })
})

app.post('/signalling/candidate', (req, res) => {
  const { inviteToken, peerId, candidate } = req.body
  if (!inviteToken || !peerId || !candidate) {
    return res.status(400).json({ error: 'inviteToken, peerId, and candidate are required' })
  }

  const session = sessions.get(sessionKey(inviteToken, peerId))
  if (!session) {
    return res.status(404).json({ error: 'session not found' })
  }

  session.candidates.push(candidate)
  res.sendStatus(204)
})

app.get('/signalling/session/:inviteToken/:peerId', (req, res) => {
  const { inviteToken, peerId } = req.params
  const session = sessions.get(sessionKey(inviteToken, peerId))
  if (!session) {
    return res.status(404).json({ error: 'session not found' })
  }

  res.json({
    offer: session.offer,
    answer: session.answer,
    candidates: session.candidates
  })
})

app.post('/game-instance/:instanceId/invite-regenerate', (req, res) => {
  const { instanceId } = req.params
  const { partyId } = req.body
  if (!partyId) {
    return res.status(400).json({ error: 'partyId is required' })
  }

  const inviteToken = `${instanceId}-${partyId}-${Date.now()}`
  res.status(200).json({ inviteToken })
})

app.listen(PORT, () => {
  console.log(`Express STUN helper listening on http://localhost:${PORT}`)
})

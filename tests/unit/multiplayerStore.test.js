import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

import '../setup.js'

const inviteMocks = vi.hoisted(() => ({
  composeInviteToken: vi.fn(),
  buildInviteUrl: vi.fn(),
  humanReadablePartyLabel: vi.fn()
}))

const hostNotificationMocks = vi.hoisted(() => ({
  showHostNotification: vi.fn()
}))

const gameRandomMock = vi.hoisted(() => ({
  gameRandom: vi.fn()
}))

const configMock = {
  PARTY_COLORS: {
    player1: '#00FF00',
    player2: '#FF0000',
    player3: '#0080FF',
    player4: '#FFFF00'
  },
  MULTIPLAYER_PARTY_IDS: ['player1', 'player2', 'player3', 'player4'],
  MAX_MULTIPLAYER_PARTIES: 4,
  INVITE_TOKEN_TTL_MS: 1000
}

let gameStateMock

vi.mock('../../src/gameState.js', () => ({
  gameState: gameStateMock
}))

vi.mock('../../src/config.js', () => configMock)

vi.mock('../../src/network/invites.js', () => inviteMocks)

vi.mock('../../src/network/hostNotifications.js', () => hostNotificationMocks)

vi.mock('../../src/network/signalling.js', () => ({
  STUN_HOST: ''
}))

vi.mock('../../src/utils/gameRandom.js', () => gameRandomMock)

const loadStore = async() => {
  vi.resetModules()
  return import('../../src/network/multiplayerStore.js')
}

const createBaseState = (overrides = {}) => ({
  playerCount: 2,
  humanPlayer: 'player1',
  partyStates: [],
  hostInviteStatus: {},
  gameInstanceId: null,
  hostId: null,
  multiplayerSession: {
    isRemote: false,
    localRole: 'host',
    status: 'idle',
    alias: null,
    inviteToken: null,
    connectedAt: null
  },
  ...overrides
})

beforeEach(() => {
  gameStateMock = createBaseState()
  inviteMocks.composeInviteToken.mockReturnValue('local-token')
  inviteMocks.buildInviteUrl.mockReturnValue('http://invite.local')
  inviteMocks.humanReadablePartyLabel.mockReturnValue('Green: AI')
  gameRandomMock.gameRandom.mockReturnValue(0.42)
})

afterEach(() => {
  vi.restoreAllMocks()
  delete globalThis.crypto
  delete globalThis.fetch
})

describe('multiplayerStore', () => {
  it('uses crypto.randomUUID when available for generateRandomId', async() => {
    globalThis.crypto = { randomUUID: vi.fn().mockReturnValue('uuid-123') }

    const { generateRandomId } = await loadStore()

    expect(generateRandomId('party')).toBe('uuid-123')
    expect(globalThis.crypto.randomUUID).toHaveBeenCalledTimes(1)
  })

  it('falls back to deterministic random ID generation', async() => {
    const nowSpy = vi.spyOn(Date, 'now').mockReturnValue(1234567890)
    gameRandomMock.gameRandom.mockReturnValue(0.123456)

    const { generateRandomId } = await loadStore()

    expect(generateRandomId('test')).toBe('test-1234567890-123456')
    expect(gameRandomMock.gameRandom).toHaveBeenCalledTimes(1)
    nowSpy.mockRestore()
  })

  it('initializes party states with host ownership and colors', async() => {
    gameStateMock = createBaseState({
      playerCount: 3,
      humanPlayer: 'player2'
    })

    const { ensureMultiplayerState, getPartyState } = await loadStore()

    const parties = ensureMultiplayerState()
    expect(parties).toHaveLength(3)

    const hostParty = getPartyState('player2')
    expect(hostParty.owner).toBe('You (Host)')
    expect(hostParty.aiActive).toBe(false)
    expect(hostParty.color).toBe(configMock.PARTY_COLORS.player2)

    const aiParty = getPartyState('player1')
    expect(aiParty.owner).toBe('AI')
    expect(aiParty.aiActive).toBe(true)
  })

  it('generates invite tokens from the server when available', async() => {
    gameStateMock = createBaseState({
      gameInstanceId: 'instance-1',
      hostId: 'host-1'
    })
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ inviteToken: 'server-token' })
    })
    inviteMocks.buildInviteUrl.mockReturnValue('http://invite.local/server')
    inviteMocks.humanReadablePartyLabel.mockReturnValue('Red: AI')

    const { generateInviteForParty, validateInviteToken } = await loadStore()

    const result = await generateInviteForParty('player2')

    expect(result).toEqual({
      token: 'server-token',
      url: 'http://invite.local/server',
      expiresAt: expect.any(Number)
    })
    expect(inviteMocks.composeInviteToken).not.toHaveBeenCalled()
    expect(hostNotificationMocks.showHostNotification).toHaveBeenCalledWith(
      'Invite ready for Red: AI'
    )

    const record = validateInviteToken('server-token')
    expect(record.partyId).toBe('player2')
    expect(record.gameInstanceId).toBe('instance-1')
    expect(record.hostId).toBe('host-1')
  })

  it('falls back to local invite tokens when server requests fail', async() => {
    const { generateInviteForParty, validateInviteToken } = await loadStore()

    const result = await generateInviteForParty('player3')

    expect(inviteMocks.composeInviteToken).toHaveBeenCalledTimes(1)
    expect(result.token).toBe('local-token')
    expect(result.url).toBe('http://invite.local')

    const record = validateInviteToken('local-token')
    expect(record).not.toBeNull()
    expect(record.partyId).toBe('player3')
  })

  it('expires and purges invite tokens after the TTL', async() => {
    const nowSpy = vi.spyOn(Date, 'now')
    nowSpy.mockReturnValue(1000)

    const { generateInviteForParty, validateInviteToken, getInviteRecords } = await loadStore()

    const { token } = await generateInviteForParty('player2')

    nowSpy.mockReturnValue(3000)

    expect(validateInviteToken(token)).toBeNull()
    expect(getInviteRecords()).toHaveLength(0)

    nowSpy.mockRestore()
  })

  it('invalidates invite tokens for a party', async() => {
    const { generateInviteForParty, invalidateInviteToken, validateInviteToken, getPartyState } =
      await loadStore()

    const { token } = await generateInviteForParty('player2')

    invalidateInviteToken('player2')

    expect(validateInviteToken(token)).toBeNull()
    expect(getPartyState('player2').inviteToken).toBeNull()
  })

  it('tracks party ownership changes and dispatches events', async() => {
    const handler = vi.fn()
    const { ensureMultiplayerState, observePartyOwnershipChange, markPartyControlledByHuman, markPartyControlledByAi } =
      await loadStore()

    ensureMultiplayerState()

    const unsubscribe = observePartyOwnershipChange(handler)
    const humanParty = markPartyControlledByHuman('player2', 'Alex')

    expect(humanParty.owner).toBe('Alex')
    expect(humanParty.aiActive).toBe(false)
    expect(handler).toHaveBeenCalledTimes(1)
    expect(handler.mock.calls[0][0].detail).toMatchObject({
      partyId: 'player2',
      owner: 'Alex',
      aiActive: false
    })

    handler.mockClear()
    unsubscribe()

    const aiParty = markPartyControlledByAi('player2')
    expect(aiParty.owner).toBe('AI')
    expect(aiParty.aiActive).toBe(true)
    expect(handler).not.toHaveBeenCalled()
  })

  it('rebuilds invite tokens and resets multiplayer session on regeneration', async() => {
    gameStateMock = createBaseState({
      playerCount: 3,
      partyStates: [
        {
          partyId: 'player1',
          color: configMock.PARTY_COLORS.player1,
          owner: 'You (Host)',
          inviteToken: null,
          aiActive: false,
          lastConnectedAt: null
        },
        {
          partyId: 'player2',
          color: configMock.PARTY_COLORS.player2,
          owner: 'Sam',
          inviteToken: 'old-token-2',
          aiActive: false,
          lastConnectedAt: 100
        },
        {
          partyId: 'player3',
          color: configMock.PARTY_COLORS.player3,
          owner: 'Taylor',
          inviteToken: 'old-token-3',
          aiActive: false,
          lastConnectedAt: 200
        }
      ],
      multiplayerSession: {
        isRemote: true,
        localRole: 'guest',
        status: 'connected',
        alias: 'Guest',
        inviteToken: 'old',
        connectedAt: 50
      }
    })
    inviteMocks.composeInviteToken.mockImplementation((instanceId, partyId) => `${instanceId}-${partyId}-token`)

    const { regenerateAllInviteTokens, getPartyState } = await loadStore()

    await regenerateAllInviteTokens()

    expect(gameStateMock.multiplayerSession).toMatchObject({
      isRemote: false,
      localRole: 'host',
      status: 'idle',
      alias: null,
      inviteToken: null,
      connectedAt: null
    })

    const party2 = getPartyState('player2')
    const party3 = getPartyState('player3')

    expect(party2.owner).toBe('AI')
    expect(party2.aiActive).toBe(true)
    expect(party2.inviteToken).toContain('player2-token')

    expect(party3.owner).toBe('AI')
    expect(party3.aiActive).toBe(true)
    expect(party3.inviteToken).toContain('player3-token')

    expect(hostNotificationMocks.showHostNotification).toHaveBeenCalledWith(
      'Multiplayer tokens regenerated - you are now the host'
    )
  })

  it('reports host status based on session role or remote flag', async() => {
    gameStateMock = createBaseState({
      multiplayerSession: {
        isRemote: true,
        localRole: 'guest'
      }
    })

    const { isHost } = await loadStore()

    expect(isHost()).toBe(false)

    gameStateMock.multiplayerSession = { isRemote: false, localRole: 'guest' }
    expect(isHost()).toBe(true)
  })

  it('manages per-party host invite status', async() => {
    const { getHostInviteStatus, setHostInviteStatus } = await loadStore()

    expect(getHostInviteStatus('player2')).toBe('idle')
    expect(setHostInviteStatus('player2', 'loading')).toBe('loading')
    expect(getHostInviteStatus('player2')).toBe('loading')
  })
})

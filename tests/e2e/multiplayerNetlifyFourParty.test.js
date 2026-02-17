import { test, expect } from '@playwright/test'

/* ------------------------------------------------------------------ *
 *  Multiplayer 4-party E2E test                                       *
 *                                                                     *
 *  Flow (matches manual session):                                     *
 *    1. HOST opens the game with URL params (?size, ?players, ?seed)  *
 *    2. HOST pauses immediately so AI cannot pre-build                *
 *    3. HOST sets map seed / dimensions / player count via sidebar    *
 *    4. HOST minimises tutorial overlay (if visible)                  *
 *    5. HOST clicks Invite for RED  → extracts invite URL             *
 *    6. HOST clicks Invite for YELLOW → extracts invite URL           *
 *    7. RED  opens invite URL → fills alias → submits                *
 *    8. YELLOW opens invite URL → fills alias → submits              *
 *    9. HOST verifies RED/YELLOW connected, BLUE stays AI            *
 *   10. HOST resumes the game                                        *
 *   11. HOST provisions buildings + units for controlled parties     *
 *   12. Tank combat → verify BLUE AI takes damage                    *
 * ------------------------------------------------------------------ */

const MAP_SIZE = 40
const MAP_SEED = '4'
const CONTROLLED_PARTIES = ['player1', 'player2', 'player4']
const AI_PARTY = 'player3'
const PROVISIONED_PARTIES = [...CONTROLLED_PARTIES, AI_PARTY]

// Replicate baseURL resolution from playwright.config.js so that
// browser.newContext() – which does NOT inherit config.use.baseURL –
// gets the correct origin when we call page.goto('/…').
const useNetlifyDev = process.env.PLAYWRIGHT_NETLIFY_DEV === '1'
const BASE_URL = process.env.PLAYWRIGHT_BASE_URL
  || (useNetlifyDev ? 'http://localhost:8888' : 'http://localhost:5173')
const LARGEST_SCREEN_WIDTH = Number.parseInt(process.env.PLAYWRIGHT_LARGEST_SCREEN_WIDTH || '0', 10)
const LARGEST_SCREEN_HEIGHT = Number.parseInt(process.env.PLAYWRIGHT_LARGEST_SCREEN_HEIGHT || '0', 10)

function getWindowLayout() {
  if (!Number.isFinite(LARGEST_SCREEN_WIDTH) || !Number.isFinite(LARGEST_SCREEN_HEIGHT)
    || LARGEST_SCREEN_WIDTH <= 0 || LARGEST_SCREEN_HEIGHT <= 0) {
    return {
      host: { left: 0, top: 40, width: 900, height: 920 },
      red: { left: 920, top: 40, width: 900, height: 920 },
      yellow: { left: 1840, top: 40, width: 900, height: 920 }
    }
  }

  const top = 40
  const usableHeight = Math.max(700, LARGEST_SCREEN_HEIGHT - 120)
  const paneWidth = Math.max(700, Math.floor(LARGEST_SCREEN_WIDTH / 3))

  return {
    host: { left: 0, top, width: paneWidth, height: usableHeight },
    red: { left: paneWidth, top, width: paneWidth, height: usableHeight },
    yellow: { left: paneWidth * 2, top, width: paneWidth, height: usableHeight }
  }
}

function logStep(message) {
  console.log(`[E2E][multiplayer][${new Date().toISOString()}] ${message}`)
}

async function positionBrowserWindow(page, { left, top, width, height, label }) {
  try {
    const session = await page.context().newCDPSession(page)
    const { windowId } = await session.send('Browser.getWindowForTarget')
    await session.send('Browser.setWindowBounds', {
      windowId,
      bounds: {
        left,
        top,
        width,
        height,
        windowState: 'normal'
      }
    })
    logStep(`${label}: positioned window at (${left}, ${top}) size ${width}x${height}`)
  } catch (error) {
    logStep(`${label}: window positioning not available (${error?.message || 'unknown error'})`)
  }
}

async function ensureSidebarVisible(page) {
  await page.waitForSelector('#sidebar', { state: 'visible', timeout: 30000 })
  await page.waitForSelector('#sidebarScroll', { state: 'visible', timeout: 30000 })

  const sidebarCollapsed = await page.evaluate(() => document.body.classList.contains('sidebar-collapsed'))
  if (sidebarCollapsed) {
    logStep('Sidebar is collapsed, attempting to open via #sidebarToggle')
    const toggle = page.locator('#sidebarToggle')
    if (await toggle.isVisible().catch(() => false)) {
      await toggle.click()
    }
    await page.waitForFunction(() => !document.body.classList.contains('sidebar-collapsed'), { timeout: 15000 })
  }
}

async function ensureMapSettingsExpanded(page) {
  await ensureSidebarVisible(page)

  await page.evaluate(() => {
    const toggle = document.getElementById('mapSettingsToggle')
    if (toggle) {
      toggle.scrollIntoView({ behavior: 'instant', block: 'center' })
    }
  })

  const mapSettingsVisible = await page.evaluate(() => {
    const content = document.getElementById('mapSettingsContent')
    if (!content) return false
    return content.style.display !== 'none'
  })

  if (!mapSettingsVisible) {
    logStep('Map settings accordion is collapsed, expanding it now')
    await page.locator('#mapSettingsToggle').click()
  }

  await expect(page.locator('#mapSettingsContent')).toBeVisible({ timeout: 30000 })
  await expect(page.locator('#playerCount')).toBeVisible({ timeout: 30000 })
}

async function ensureMultiplayerInviteSectionVisible(page) {
  await ensureSidebarVisible(page)
  await page.evaluate(() => {
    const multiplayer = document.getElementById('multiplayerSettings')
    if (multiplayer) {
      multiplayer.scrollIntoView({ behavior: 'instant', block: 'center' })
    }
  })
  await expect(page.locator('#inviteLinkInput')).toBeVisible({ timeout: 30000 })
}

async function dismissInviteQrModalIfVisible(page) {
  const modal = page.locator('.multiplayer-qr-modal.visible')
  if (!await modal.isVisible().catch(() => false)) {
    return
  }

  logStep('QR invite modal is visible, dismissing it before continuing')
  const closeBtn = page.locator('.multiplayer-qr-modal__close')
  if (await closeBtn.isVisible().catch(() => false)) {
    await closeBtn.click({ force: true })
  } else {
    await page.keyboard.press('Escape').catch(() => {})
  }

  await expect(modal).toBeHidden({ timeout: 10000 })
}

// ────────────────────────────────────────────────────────────────────
//  Helpers
// ────────────────────────────────────────────────────────────────────

/** Pre-seed localStorage so the tutorial is configured before page load. */
async function configureTutorial(page, { showTutorial, completed }) {
  await page.addInitScript((cfg) => {
    localStorage.setItem(
      'tutorial-settings',
      JSON.stringify({ showTutorial: cfg.showTutorial, speechEnabled: false })
    )
    localStorage.setItem(
      'tutorial-progress',
      JSON.stringify({ completed: cfg.completed, stepIndex: 0 })
    )
  }, { showTutorial, completed })
}

/** Navigate to a path and wait until gameState.gameStarted is true. */
async function gotoAndWaitGameReady(page, urlPath = '/') {
  logStep(`Navigating to ${urlPath}`)
  await page.goto(urlPath, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('#gameCanvas', { state: 'visible', timeout: 60000 })
  await page.waitForFunction(
    () => window.gameState !== undefined && window.gameState.gameStarted === true,
    { timeout: 60000 }
  )
  logStep(`Game ready on ${urlPath}`)
}

/** Force-pause gameState (called right after page load, before any AI tick). */
async function pauseGameImmediately(page) {
  logStep('Pausing host game immediately')
  await page.evaluate(() => {
    window.gameState.gamePaused = true
    const icon = document.querySelector('#pauseBtn .play-pause-icon')
    if (icon) icon.textContent = '▶'
  })
  await page.waitForFunction(
    () => window.gameState?.gamePaused === true,
    { timeout: 10000 }
  )
}

/** Set map dimensions, player count and seed via sidebar inputs. */
async function setHostMapAndPlayers(page) {
  logStep('Preparing sidebar/map settings for host map configuration')
  await ensureMapSettingsExpanded(page)

  logStep('Setting playerCount=4')
  await page.locator('#playerCount').fill('4')
  await page.locator('#playerCount').dispatchEvent('change')

  logStep(`Setting map width/height to ${MAP_SIZE}`)
  await page.locator('#mapWidthTiles').fill(String(MAP_SIZE))
  await page.locator('#mapWidthTiles').dispatchEvent('change')
  await page.locator('#mapHeightTiles').fill(String(MAP_SIZE))
  await page.locator('#mapHeightTiles').dispatchEvent('change')

  logStep(`Setting map seed to ${MAP_SEED} and clicking shuffle`)
  await page.locator('#mapSeed').fill(MAP_SEED)
  await page.locator('#shuffleMapBtn').click()

  await page.waitForFunction(
    (args) => {
      const gs = window.gameState
      return gs
        && Number(gs.mapTilesX) === args.size
        && Number(gs.mapTilesY) === args.size
        && Number(gs.playerCount) === 4
        && String(gs.mapSeed) === args.seed
    },
    { size: MAP_SIZE, seed: MAP_SEED },
    { timeout: 30000 }
  )

  logStep('Host map settings applied and confirmed in gameState')
}

/** If the tutorial overlay is showing, minimise it. */
async function minimizeTutorialIfVisible(page) {
  const overlay = page.locator('#tutorialOverlay')
  if (await overlay.isVisible().catch(() => false)) {
    const minimizeBtn = page.locator('[data-tutorial-action="minimize"]')
    if (await minimizeBtn.count() > 0) {
      await minimizeBtn.first().click()
    }
  }
}

/**
 * Click Invite for a party, wait for token creation, then try to read
 * the copied link from clipboard. Falls back to URL built from token.
 */
async function invitePartyAndCaptureCopiedUrl(hostPage, partyId) {
  await dismissInviteQrModalIfVisible(hostPage)
  logStep(`Preparing invite section for ${partyId}`)
  await ensureMultiplayerInviteSectionVisible(hostPage)

  const btn = hostPage.locator(`[data-testid="multiplayer-invite-${partyId}"]`)
  await btn.scrollIntoViewIfNeeded()
  await expect(btn).toBeVisible({ timeout: 30000 })
  logStep(`Clicking invite button for ${partyId}`)
  await btn.click()

  // Wait until the party state contains an inviteToken
  await hostPage.waitForFunction(
    (pid) => {
      const parties = window.gameState?.partyStates || []
      return parties.some((p) => p.partyId === pid && p.inviteToken)
    },
    partyId,
    { timeout: 30000 }
  )

  // Read the token back
  const token = await hostPage.evaluate((pid) => {
    const party = (window.gameState?.partyStates || []).find((p) => p.partyId === pid)
    return party?.inviteToken || null
  }, partyId)

  const copiedUrl = await hostPage.evaluate(async() => {
    if (!navigator?.clipboard || typeof navigator.clipboard.readText !== 'function') {
      return ''
    }

    try {
      return (await navigator.clipboard.readText()).trim()
    } catch {
      return ''
    }
  })

  const fallbackUrl = token ? `${BASE_URL}/?invite=${encodeURIComponent(token)}` : null
  const inviteUrl = copiedUrl && copiedUrl.includes('invite=') ? copiedUrl : fallbackUrl

  logStep(`Invite resolved for ${partyId} | token=${token ? 'yes' : 'no'} | copied=${copiedUrl ? 'yes' : 'no'} | usingFallback=${copiedUrl && copiedUrl.includes('invite=') ? 'no' : 'yes'}`)

  await dismissInviteQrModalIfVisible(hostPage)

  return { copiedUrl, inviteUrl }
}

async function ensureHostOwnsRequiredBuildings(hostPage) {
  await hostPage.waitForFunction(
    (partyId) => {
      const blds = window.gameState?.buildings || []
      const aliases = partyId === 'player1' ? ['player1', 'player'] : [partyId]
      const ownedByHost = (building) => aliases.includes(building.owner)
      return blds.some((b) => ownedByHost(b) && b.type === 'constructionYard')
        && blds.some((b) => ownedByHost(b) && b.type === 'powerPlant')
        && blds.some((b) => ownedByHost(b) && b.type === 'oreRefinery')
        && blds.some((b) => ownedByHost(b) && b.type === 'vehicleFactory')
    },
    'player1',
    { timeout: 30000 }
  )
}

/**
 * A client (RED / YELLOW) joins the game:
 *   1. Navigate directly to the invite URL  (same result as pasting
 *      into #inviteLinkInput and clicking Join – both end up at
 *      /?invite=TOKEN which triggers remoteInviteLanding.js).
 *   2. Wait for the "Join Remote Match" overlay.
 *   3. Fill alias → submit.
 *   4. Wait until the WebRTC session status is 'connected'.
 */
async function joinViaDirectInviteUrl(page, inviteUrl, alias) {
  logStep(`${alias}: opening invite URL directly`)
  await page.goto(inviteUrl, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('#gameCanvas', { state: 'visible', timeout: 60000 })

  // The invite overlay should appear
  const overlay = page.locator('#remoteInviteLanding')
  await expect(overlay).toBeVisible({ timeout: 30000 })

  // Fill alias and submit
  await page.locator('#remoteAliasInput').fill(alias)
  await page.locator('#remoteInviteSubmit').click()

  // Wait for WebRTC connection
  await expect(overlay).toBeHidden({ timeout: 60000 })
  await page.waitForFunction(
    () => {
      const s = window.gameState?.multiplayerSession
      return s && s.isRemote === true && s.status === 'connected'
    },
    { timeout: 60000 }
  )
  logStep(`${alias}: remote session connected`)
}

async function provisionPartiesFromHost(hostPage) {
  await hostPage.evaluate(async(parties) => {
    const buildingsModule = await import('/src/buildings.js')
    const buildingDataModule = await import('/src/data/buildingData.js')
    const unitsModule = await import('/src/units.js')
    const mainModule = await import('/src/main.js')
    const gameStateModule = await import('/src/gameState.js')

    const { createBuilding, placeBuilding, canPlaceBuilding } = buildingsModule
    const { buildingData } = buildingDataModule
    const { createUnit, updateUnitOccupancy } = unitsModule
    const { mapGrid, factories, units } = mainModule
    const { gameState } = gameStateModule

    const ownerAliasesForParty = (partyId) => {
      if (partyId === 'player1') {
        const aliases = ['player1', 'player']
        if (typeof gameState.humanPlayer === 'string' && gameState.humanPlayer.length > 0) {
          aliases.push(gameState.humanPlayer)
        }
        return [...new Set(aliases)]
      }
      return [partyId]
    }

    const isOwnedByParty = (entity, partyId) => ownerAliasesForParty(partyId).includes(entity?.owner)

    const ownerForPlacement = (partyId) => {
      if (partyId === 'player1') {
        return gameState.humanPlayer || 'player1'
      }
      return partyId
    }

    const canPlaceRect = (x, y, width, height, owner) => {
      if (x < 0 || y < 0 || y + height > mapGrid.length || x + width > mapGrid[0].length) {
        return false
      }

      for (let yy = y; yy < y + height; yy++) {
        for (let xx = x; xx < x + width; xx++) {
          if (mapGrid[yy][xx].building) {
            return false
          }
        }
      }

      return canPlaceBuilding(typeForScan, x, y, mapGrid, units, gameState.buildings || [], factories, owner)
    }

    let typeForScan = 'constructionYard'

    const findSpotNearFactory = (factory, width, height, owner, type) => {
      const centerX = factory.x + Math.floor(factory.width / 2)
      const centerY = factory.y + Math.floor(factory.height / 2)
      typeForScan = type

      for (let radius = 2; radius <= 10; radius++) {
        for (let dy = -radius; dy <= radius; dy++) {
          for (let dx = -radius; dx <= radius; dx++) {
            const tx = centerX + dx
            const ty = centerY + dy
            if (canPlaceRect(tx, ty, width, height, owner)) {
              return { x: tx, y: ty }
            }
          }
        }
      }

      return null
    }

    const findAnySpot = (width, height, owner, type) => {
      typeForScan = type
      for (let y = 0; y <= mapGrid.length - height; y++) {
        for (let x = 0; x <= mapGrid[0].length - width; x++) {
          if (canPlaceRect(x, y, width, height, owner)) {
            return { x, y }
          }
        }
      }

      return null
    }

    const findFreeUnitTileNearFactory = (factory) => {
      const centerX = factory.x + Math.floor(factory.width / 2)
      const centerY = factory.y + factory.height + 1

      for (let radius = 0; radius <= 8; radius++) {
        for (let dy = -radius; dy <= radius; dy++) {
          for (let dx = -radius; dx <= radius; dx++) {
            const tx = centerX + dx
            const ty = centerY + dy
            if (tx < 0 || ty < 0 || ty >= mapGrid.length || tx >= mapGrid[0].length) {
              continue
            }

            if (mapGrid[ty][tx].building) {
              continue
            }

            if (gameState.occupancyMap?.[ty]?.[tx] > 0) {
              continue
            }

            return { x: tx, y: ty }
          }
        }
      }

      for (let y = 0; y < mapGrid.length; y++) {
        for (let x = 0; x < mapGrid[0].length; x++) {
          if (mapGrid[y][x].building) {
            continue
          }

          if (gameState.occupancyMap?.[y]?.[x] > 0) {
            continue
          }

          return { x, y }
        }
      }

      return { x: centerX, y: Math.min(mapGrid.length - 1, centerY) }
    }

    const ensureBuildingForParty = (partyId, factory, type) => {
      const existing = (gameState.buildings || []).find(building => building.type === type && isOwnedByParty(building, partyId))
      if (existing) {
        existing.constructionFinished = true
        existing.constructionStartTime = performance.now() - 10000
        return existing
      }

      const buildingConfig = buildingData?.[type]
      if (!buildingConfig?.width || !buildingConfig?.height) {
        return null
      }

      const targetOwner = ownerForPlacement(partyId)
      const spot = findSpotNearFactory(factory, buildingConfig.width, buildingConfig.height, targetOwner, type)
        || findAnySpot(buildingConfig.width, buildingConfig.height, targetOwner, type)
      if (!spot) {
        return null
      }

      const building = createBuilding(type, spot.x, spot.y)
      if (!building) {
        return null
      }
      building.owner = targetOwner
      building.constructionFinished = true
      building.constructionStartTime = performance.now() - 10000
      placeBuilding(building, mapGrid, gameState.occupancyMap, { recordTransition: false })
      gameState.buildings.push(building)
      return building
    }

    const ensureUnitsForParty = (partyId, factory, type, count) => {
      const existing = units.filter(unit => isOwnedByParty(unit, partyId) && unit.type === type)
      if (existing.length >= count) {
        return existing.slice(0, count)
      }

      const createdUnits = [...existing]
      const needed = count - existing.length

      for (let i = 0; i < needed; i++) {
        const tile = findFreeUnitTileNearFactory(factory)
        const unit = createUnit(factory, type, tile.x, tile.y)
        units.push(unit)
        updateUnitOccupancy(unit, -1, -1, gameState.occupancyMap)
        createdUnits.push(unit)
      }

      return createdUnits
    }

    parties.forEach((partyId) => {
      const factory = factories.find(item => (item.owner || item.id) === partyId)
      if (!factory) {
        return
      }

      if (partyId === 'player1' || ownerAliasesForParty(partyId).includes(gameState.humanPlayer)) {
        gameState.money = Math.max(Number(gameState.money) || 0, 40000)
      } else {
        factory.budget = Math.max(Number(factory.budget) || 0, 40000)
      }

      ensureBuildingForParty(partyId, factory, 'constructionYard')
      ensureBuildingForParty(partyId, factory, 'powerPlant')
      ensureBuildingForParty(partyId, factory, 'oreRefinery')
      ensureBuildingForParty(partyId, factory, 'vehicleFactory')

      ensureUnitsForParty(partyId, factory, 'harvester', 2)
      ensureUnitsForParty(partyId, factory, 'tank_v1', 1)
    })
  }, PROVISIONED_PARTIES)
}

async function setupTankCombat(hostPage) {
  return hostPage.evaluate(({ humanParties, aiParty }) => {
    const gs = window.gameState
    const allUnits = gs?.units || []

    const ownerAliasesForParty = (partyId) => {
      if (partyId === 'player1') {
        const aliases = ['player1', 'player']
        if (typeof gs?.humanPlayer === 'string' && gs.humanPlayer.length > 0) {
          aliases.push(gs.humanPlayer)
        }
        return [...new Set(aliases)]
      }
      return [partyId]
    }

    const isOwnedByParty = (unit, partyId) => ownerAliasesForParty(partyId).includes(unit?.owner)

    const aiTank = allUnits.find(unit => isOwnedByParty(unit, aiParty) && unit.type === 'tank_v1')
    if (!aiTank) {
      return { ok: false, tankIds: [], targetId: null }
    }

    aiTank.x = 18 * 32
    aiTank.y = 12 * 32
    aiTank.tileX = 18
    aiTank.tileY = 12
    aiTank.path = []
    aiTank.moveTarget = null
    aiTank.health = aiTank.maxHealth
    aiTank.destroyed = false
    aiTank.allowedToAttack = true

    const tanks = humanParties.map((partyId, index) => {
      const tank = allUnits.find(unit => isOwnedByParty(unit, partyId) && unit.type === 'tank_v1')
      if (!tank) {
        return null
      }

      const baseX = 10 + index * 2
      const baseY = 12 + (index % 2)
      tank.x = baseX * 32
      tank.y = baseY * 32
      tank.tileX = baseX
      tank.tileY = baseY
      tank.path = []
      tank.moveTarget = null
      tank.health = tank.maxHealth
      tank.destroyed = false
      tank.allowedToAttack = true
      return tank
    }).filter(Boolean)

    if (tanks.length < 3) {
      return { ok: false, tankIds: [] }
    }

    tanks.forEach((tank) => {
      tank.target = aiTank
      tank.attackTarget = aiTank
      tank.holdFire = false
      tank.lastShotTime = 0
    })

    aiTank.target = tanks[0]
    aiTank.attackTarget = tanks[0]
    aiTank.holdFire = false
    aiTank.lastShotTime = 0

    return { ok: true, tankIds: tanks.map(tank => tank.id), targetId: aiTank.id }
  }, { humanParties: CONTROLLED_PARTIES, aiParty: AI_PARTY })
}

/** Verify RED and YELLOW are human-connected and BLUE is still AI. */
async function waitForHumansAndBlueAi(hostPage) {
  await hostPage.waitForFunction(
    (aiPid) => {
      const parties = window.gameState?.partyStates || []
      const red = parties.find((p) => p.partyId === 'player2')
      const yellow = parties.find((p) => p.partyId === 'player4')
      const blue = parties.find((p) => p.partyId === aiPid)

      return red?.aiActive === false
        && yellow?.aiActive === false
        && blue?.aiActive === true
    },
    AI_PARTY,
    { timeout: 60000 }
  )
}

/** Unpause the host game. */
async function resumeHost(hostPage) {
  const isPaused = await hostPage.evaluate(() => Boolean(window.gameState?.gamePaused))
  if (isPaused) {
    await hostPage.locator('#pauseBtn').click()
  }
  await hostPage.waitForFunction(
    () => window.gameState?.gamePaused === false,
    { timeout: 15000 }
  )
}

// ────────────────────────────────────────────────────────────────────
//  Test
// ────────────────────────────────────────────────────────────────────

test.describe('Netlify multiplayer 4-party sync', () => {
  test.describe.configure({ mode: 'serial' })
  test.setTimeout(240000)

  test('host setup + invite flow → 3-party build/combat with blue AI', async({ browser }) => {
    // Use separate browser processes per role so native windows don't get
    // re-targeted/repositioned by shared CDP window IDs.
    const browserType = browser.browserType()
    const windowLayout = getWindowLayout()

    const launchRoleBrowser = async(role, bounds) => {
      const args = [
        `--window-position=${bounds.left},${bounds.top}`,
        `--window-size=${bounds.width},${bounds.height}`,
        '--disable-background-timer-throttling',
        '--disable-backgrounding-occluded-windows',
        '--disable-renderer-backgrounding',
        '--disable-frame-rate-limit',
        '--disable-gpu-vsync'
      ]

      let roleBrowser = null

      if (process.platform === 'darwin') {
        try {
          roleBrowser = await browserType.launch({
            channel: 'chrome',
            headless: false,
            args
          })
          logStep(`${role}: launched using Chrome channel for better headed performance`)
        } catch {
          roleBrowser = null
        }
      }

      if (!roleBrowser) {
        roleBrowser = await browserType.launch({
          headless: false,
          args
        })
      }

      const roleContext = await roleBrowser.newContext({ baseURL: BASE_URL })
      const rolePage = await roleContext.newPage()
      await positionBrowserWindow(rolePage, { ...bounds, label: role })
      return { roleBrowser, roleContext, rolePage }
    }

    const hostRole = await launchRoleBrowser('HOST', windowLayout.host)
    const hostBrowser = hostRole.roleBrowser
    const hostContext = hostRole.roleContext
    const hostPage = hostRole.rolePage
    let redPage = null
    let yellowPage = null
    let redBrowser = null
    let yellowBrowser = null

    try {
      logStep('Starting host-first multiplayer test flow')
      await hostContext.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: BASE_URL }).catch(() => {})
      logStep(`Window layout source: ${LARGEST_SCREEN_WIDTH > 0 ? `${LARGEST_SCREEN_WIDTH}x${LARGEST_SCREEN_HEIGHT}` : 'default fallback'}`)

      // ── Pre-configure tutorial per context ────────────────────────
      await configureTutorial(hostPage, { showTutorial: true, completed: false })

      // ── 1. HOST loads game ────────────────────────────────────────
      await gotoAndWaitGameReady(
        hostPage,
        `/?size=${MAP_SIZE}&players=4&seed=${MAP_SEED}`
      )

      // ── 2. Immediately pause so AI cannot act ─────────────────────
      await pauseGameImmediately(hostPage)

      // ── 3. Set map settings via sidebar inputs ────────────────────
      await setHostMapAndPlayers(hostPage)

      // ── 4. Minimise tutorial if visible ───────────────────────────
      await minimizeTutorialIfVisible(hostPage)

      // ── 5. Host invites RED, captures copied link, then starts RED browser ──
      const redInvite = await invitePartyAndCaptureCopiedUrl(hostPage, 'player2')
      expect(redInvite.inviteUrl).toBeTruthy()
      logStep(`RED invite URL ready: ${redInvite.inviteUrl}`)

      const redRole = await launchRoleBrowser('RED', windowLayout.red)
      redBrowser = redRole.roleBrowser
      redPage = redRole.rolePage
      await configureTutorial(redPage, { showTutorial: false, completed: true })
      await joinViaDirectInviteUrl(redPage, redInvite.inviteUrl, 'RED')

      // ── 6. Host invites YELLOW (player4), captures copied link, then starts YELLOW browser ──
      const yellowInvite = await invitePartyAndCaptureCopiedUrl(hostPage, 'player4')
      expect(yellowInvite.inviteUrl).toBeTruthy()
      logStep(`YELLOW invite URL ready: ${yellowInvite.inviteUrl}`)
      await dismissInviteQrModalIfVisible(hostPage)

      const yellowRole = await launchRoleBrowser('YELLOW', windowLayout.yellow)
      yellowBrowser = yellowRole.roleBrowser
      yellowPage = yellowRole.rolePage
      await configureTutorial(yellowPage, { showTutorial: false, completed: true })
      await joinViaDirectInviteUrl(yellowPage, yellowInvite.inviteUrl, 'YELLOW')
      await dismissInviteQrModalIfVisible(hostPage)
      logStep('Host invite modal closed after YELLOW invite flow')

      // ── 9. Verify connections ─────────────────────────────────────
      await waitForHumansAndBlueAi(hostPage)
      logStep('Host sees RED + YELLOW connected and BLUE still AI')

      // ── 10. Resume ────────────────────────────────────────────────
      await resumeHost(hostPage)
      logStep('Host resumed game after human connections')

      // ── 11. Provision buildings + units ───────────────────────────
      await provisionPartiesFromHost(hostPage)
      await ensureHostOwnsRequiredBuildings(hostPage)
      logStep('Host build-out confirmed (construction yard, power plant, refinery, vehicle factory)')

      // Wait until combat-critical provisioning is reflected in gameState
      await hostPage.waitForFunction(
        ({ humanParties, aiParty }) => {
          const gs = window.gameState
          if (!gs) return false
          const uts = gs.units || []

          const ownerAliasesForParty = (partyId) => {
            if (partyId === 'player1') {
              const aliases = ['player1', 'player']
              if (typeof gs?.humanPlayer === 'string' && gs.humanPlayer.length > 0) {
                aliases.push(gs.humanPlayer)
              }
              return [...new Set(aliases)]
            }
            return [partyId]
          }

          const unitMatchesParty = (unit, partyId) => ownerAliasesForParty(partyId).includes(unit.owner)

          const humansReady = humanParties.every((pid) => {
            return uts.filter((u) => unitMatchesParty(u, pid) && u.type === 'harvester').length >= 2
              && uts.filter((u) => unitMatchesParty(u, pid) && u.type === 'tank_v1').length >= 1
          })

          const blueReady = uts.filter((u) => unitMatchesParty(u, aiParty) && u.type === 'tank_v1').length >= 1
          return humansReady && blueReady
        },
        { humanParties: CONTROLLED_PARTIES, aiParty: AI_PARTY },
        { timeout: 30000 }
      )

      // Optional stronger check for base progression on human parties (non-fatal).
      const baseProgression = await hostPage.evaluate((parties) => {
        const gs = window.gameState
        if (!gs) return null

        const ownerAliasesForParty = (partyId) => {
          if (partyId === 'player1') {
            const aliases = ['player1', 'player']
            if (typeof gs?.humanPlayer === 'string' && gs.humanPlayer.length > 0) {
              aliases.push(gs.humanPlayer)
            }
            return [...new Set(aliases)]
          }
          return [partyId]
        }

        const unitMatchesParty = (unit, partyId) => ownerAliasesForParty(partyId).includes(unit.owner)
        const buildingMatchesParty = (building, partyId) => ownerAliasesForParty(partyId).includes(building.owner)

        return parties.map((pid) => {
          const blds = gs.buildings || []
          const uts = gs.units || []
          return {
            partyId: pid,
            hasConstructionYard: blds.some((b) => buildingMatchesParty(b, pid) && b.type === 'constructionYard'),
            hasPowerPlant: blds.some((b) => buildingMatchesParty(b, pid) && b.type === 'powerPlant'),
            hasOreRefinery: blds.some((b) => buildingMatchesParty(b, pid) && b.type === 'oreRefinery'),
            hasVehicleFactory: blds.some((b) => buildingMatchesParty(b, pid) && b.type === 'vehicleFactory'),
            harvesterCount: uts.filter((u) => unitMatchesParty(u, pid) && u.type === 'harvester').length,
            tankCount: uts.filter((u) => unitMatchesParty(u, pid) && u.type === 'tank_v1').length
          }
        })
      }, CONTROLLED_PARTIES)

      logStep(`Base progression snapshot: ${JSON.stringify(baseProgression)}`)

      // ── 12. Tank combat ───────────────────────────────────────────
      const combatSetup = await setupTankCombat(hostPage)
      expect(combatSetup.ok).toBe(true)
      logStep('Combat setup complete, waiting for BLUE AI tank to take damage')

      await hostPage.waitForFunction(
        (targetId) => {
          const target = (window.gameState?.units || []).find((unit) => unit.id === targetId)
          if (!target) return false
          return Number(target.health) < Number(target.maxHealth)
        },
        combatSetup.targetId,
        { timeout: 60000 }
      )

      await redPage.waitForFunction(
        () => window.gameState?.multiplayerSession?.status === 'connected',
        { timeout: 15000 }
      )
      await yellowPage.waitForFunction(
        () => window.gameState?.multiplayerSession?.status === 'connected',
        { timeout: 15000 }
      )
      logStep('Combat effect confirmed: BLUE AI tank damaged while RED/YELLOW remain connected')
    } finally {
      logStep('Cleaning up browser contexts')
      await hostBrowser.close().catch(() => {})
      if (redBrowser) {
        await redBrowser.close().catch(() => {})
      }
      if (yellowBrowser) {
        await yellowBrowser.close().catch(() => {})
      }
    }
  })
})

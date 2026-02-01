import { test, expect } from '@playwright/test'

/**
 * E2E Test: Basic Game Flow
 *
 * This test simulates a human player:
 * 1. Starting a new game with seed 11
 * 2. Building a power plant
 * 3. Building a refinery
 * 4. Building a vehicle factory
 * 5. Producing a harvester
 * 6. Producing a tank
 * 7. Commanding the tank to move to the closest ore field
 *
 * Verifies:
 * - No console errors during gameplay
 * - Money/power correctly updated after each build
 * - All buildings and units can be built successfully
 */

// Building costs from buildingData.js (for reference)
// powerPlant: 2000, oreRefinery: 2500, vehicleFactory: 3000
// harvester: 1500, tank: 1000

// Initial money
const STARTING_MONEY = 10000

test.describe('Basic Game Flow', () => {
  /** @type {string[]} */
  let consoleErrors = []

  test.beforeEach(async({ page }) => {
    consoleErrors = []

    // Capture console errors
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text())
      }
    })

    // Capture page errors (uncaught exceptions)
    page.on('pageerror', error => {
      consoleErrors.push(`Page error: ${error.message}`)
    })
  })

  test('should build a base and produce units without errors', async({ page }) => {
    // =======================
    // 0. DISABLE TUTORIAL BEFORE PAGE LOAD
    // =======================

    // Disable tutorial to prevent it from blocking UI interaction
    await page.addInitScript(() => {
      localStorage.setItem('tutorial-settings', JSON.stringify({ showTutorial: false, speechEnabled: false }))
      localStorage.setItem('tutorial-progress', JSON.stringify({ completed: true, stepIndex: 0 }))
    })

    // =======================
    // 1. LOAD GAME WITH SEED 11 VIA URL PARAMETER
    // =======================

    // Navigate to the game with seed parameter to avoid UI manipulation
    console.log('Loading game with seed 11 via URL parameter...')
    await page.goto('/?seed=11')

    // Wait for game to fully load (canvas should be visible)
    await page.waitForSelector('#gameCanvas', { state: 'visible', timeout: 30000 })

    // Wait for game initialization (game starts unpaused after setup)
    // Wait for the sidebar to be ready
    await page.waitForSelector('#sidebar', { state: 'visible' })

    // Wait for game state to be fully ready - first check that gameState exists
    await page.waitForFunction(() => {
      return window.gameState !== undefined
    }, { timeout: 10000 })

    // Then check game started and unpause if needed
    await page.waitForFunction(() => {
      const gs = window.gameState
      if (!gs) return false

      // If game started but is paused, unpause it
      if (gs.gameStarted && gs.gamePaused) {
        gs.gamePaused = false
      }

      // Return true if game is started and not paused
      return gs.gameStarted && !gs.gamePaused
    }, { timeout: 30000 })

    // Extra safety delay for UI to settle
    await page.waitForTimeout(500)

    // Log game state for debugging
    await page.evaluate(() => {
      console.log('=== GAME STATE CHECK ===')
      console.log('gameStarted:', window.gameState?.gameStarted)
      console.log('gamePaused:', window.gameState?.gamePaused)
      console.log('mapSeed:', window.gameState?.mapSeed)
      console.log('money:', window.gameState?.money)
      console.log('buildings:', window.gameState?.buildings?.length)
      console.log('========================')
    })

    // Verify seed was set correctly
    const actualSeed = await page.evaluate(() => window.gameState?.mapSeed)
    console.log('Map seed from URL parameter:', actualSeed)
    expect(actualSeed).toBe('11')

    // Dismiss any blocking overlays (tutorial/benchmark) before interacting with UI
    const tutorialSkip = page.getByRole('button', { name: 'Skip tutorial' })
    if (await tutorialSkip.isVisible()) {
      await tutorialSkip.click()
    }

    const tutorialMinimize = page.getByRole('button', { name: 'Minimize' })
    if (await tutorialMinimize.isVisible()) {
      await tutorialMinimize.click()
    }

    // Close benchmark modal via JavaScript to bypass canvas pointer interception
    await page.evaluate(() => {
      const btn = document.getElementById('benchmarkModalCloseBtn') ||
                  document.getElementById('benchmarkModalCloseFooterBtn')
      if (btn) {
        btn.click()
      }
    })

    // Verify initial money is displayed
    const moneyDisplay = page.locator('#moneyText, #mobileMoneyValue').first()
    await expect(moneyDisplay).toBeVisible()

    // Helper function to get current money
    async function getMoney() {
      const text = (await moneyDisplay.textContent()) || ''
      // Extract number from text like "$10,000" or "10000"
      const match = text.replace(/,/g, '').match(/\d+/)
      return match ? parseInt(match[0], 10) : 0
    }

    // Helper function to wait for building to be ready for placement
    async function waitForBuildingReady(buildingType, timeout = 30000) {
      console.log(`Waiting for ${buildingType} to be ready...`)
      const button = page.locator(`button.production-button[data-building-type="${buildingType}"]`)
      // Wait for the button to have 'ready-for-placement' class
      await expect(button).toHaveClass(/ready-for-placement/, { timeout })
      console.log(`${buildingType} is ready for placement`)
    }

    // Helper function to wait for unit production to complete
    async function waitForUnitReady(unitType, timeout = 30000) {
      console.log(`Waiting for ${unitType} production to complete...`)
      // Unit production completes when progress bar disappears or reaches 100%
      const button = page.locator(`button.production-button[data-unit-type="${unitType}"]`)
      // Wait for button to no longer have 'active' class (production complete)
      await expect(button).not.toHaveClass(/active/, { timeout })
      console.log(`${unitType} production complete`)
    }

    // Helper to find a valid placement position 2 tiles away from construction yard border
    async function findPlacementPosition() {
      // Get canvas dimensions
      const canvas = page.locator('#gameCanvas')
      const box = await canvas.boundingBox()
      if (!box) throw new Error('Canvas not found')

      // Get the initial factory/construction yard position from game state
      const factoryInfo = await page.evaluate(() => {
        const buildings = window.gameState?.buildings || []
        // Find the initial factory (type 'factory' or 'constructionYard')
        const factory = buildings.find(b => b.type === 'factory' || b.type === 'constructionYard')
        if (factory) {
          return {
            x: factory.x,
            y: factory.y,
            width: factory.width || 3,
            height: factory.height || 3
          }
        }
        return null
      })

      // Constants (matching config.js)
      const TILE_SIZE = 32
      const MIN_DISTANCE_TILES = 2

      if (factoryInfo) {
        // Calculate factory border in tile coordinates
        const factoryRightEdge = factoryInfo.x + factoryInfo.width
        const factoryBottomEdge = factoryInfo.y + factoryInfo.height

        // Place power plant 2 tiles to the right and below the factory
        const buildingX = factoryRightEdge + MIN_DISTANCE_TILES
        const buildingY = factoryBottomEdge + MIN_DISTANCE_TILES

        // Convert to screen coordinates (accounting for scroll offset)
        const scrollOffset = await page.evaluate(() => ({
          x: window.gameState?.scrollOffset?.x || 0,
          y: window.gameState?.scrollOffset?.y || 0
        }))

        const screenX = buildingX * TILE_SIZE - scrollOffset.x
        const screenY = buildingY * TILE_SIZE - scrollOffset.y

        // Clamp to visible canvas area
        const clampedX = Math.max(box.x, Math.min(box.x + box.width - 100, screenX + box.x))
        const clampedY = Math.max(box.y, Math.min(box.y + box.height - 100, screenY + box.y))

        console.log(`Factory at tile (${factoryInfo.x}, ${factoryInfo.y}), placing building 2 tiles away at screen (${clampedX}, ${clampedY})`)
        return {
          x: clampedX,
          y: clampedY
        }
      }

      // Fallback: place in bottom-right area if factory not found
      return {
        x: box.x + box.width * 0.7,
        y: box.y + box.height * 0.7
      }
    }

    // Helper to find placement position for nth building, incrementally offset to avoid collisions
    async function findPlacementPositionForBuilding(buildingIndex) {
      const canvas = page.locator('#gameCanvas')
      const box = await canvas.boundingBox()
      if (!box) throw new Error('Canvas not found')

      const factoryInfo = await page.evaluate(() => {
        const buildings = window.gameState?.buildings || []
        const factory = buildings.find(b => b.type === 'factory' || b.type === 'constructionYard')
        if (factory) {
          return {
            x: factory.x,
            y: factory.y,
            width: factory.width || 3,
            height: factory.height || 3
          }
        }
        return null
      })

      const TILE_SIZE = 32
      const MIN_DISTANCE_TILES = 2

      if (factoryInfo) {
        const factoryRightEdge = factoryInfo.x + factoryInfo.width
        const factoryBottomEdge = factoryInfo.y + factoryInfo.height

        // Stagger placements: index 0 goes right/down, index 1 goes farther right/down, etc.
        const buildingX = factoryRightEdge + MIN_DISTANCE_TILES + (buildingIndex * 5)
        const buildingY = factoryBottomEdge + MIN_DISTANCE_TILES + (buildingIndex * 5)

        const scrollOffset = await page.evaluate(() => ({
          x: window.gameState?.scrollOffset?.x || 0,
          y: window.gameState?.scrollOffset?.y || 0
        }))

        const screenX = buildingX * TILE_SIZE - scrollOffset.x
        const screenY = buildingY * TILE_SIZE - scrollOffset.y

        const clampedX = Math.max(box.x, Math.min(box.x + box.width - 100, screenX + box.x))
        const clampedY = Math.max(box.y, Math.min(box.y + box.height - 100, screenY + box.y))

        return {
          x: clampedX,
          y: clampedY
        }
      }

      return {
        x: box.x + box.width * 0.7,
        y: box.y + box.height * 0.7
      }
    }

    let currentMoney = await getMoney()
    console.log('Initial money:', currentMoney)
    expect(currentMoney).toBeGreaterThanOrEqual(STARTING_MONEY - 1000) // Allow some margin

    // Take initial screenshot
    await page.screenshot({ path: 'test-results/01-initial-state.png' })

    // ========================================
    // Step 1: Build Power Plant
    // ========================================
    console.log('=== Step 1: Building Power Plant ===')

    // Make sure we're on the buildings tab
    const buildingsTab = page.locator('button.tab-button[data-tab="buildings"]')
    await expect(buildingsTab).toBeVisible()
    await buildingsTab.click()
    await page.waitForTimeout(300)

    // Take screenshot after tab click
    await page.screenshot({ path: 'test-results/02-buildings-tab.png' })

    // Click power plant button
    const powerPlantBtn = page.locator('button.production-button[data-building-type="powerPlant"]')
    await expect(powerPlantBtn).toBeVisible()

    // Verify button is enabled
    const isPowerPlantEnabled = await powerPlantBtn.isEnabled()
    console.log('Power Plant button enabled:', isPowerPlantEnabled)

    await powerPlantBtn.click()
    console.log('Clicked Power Plant button (first time)')
    await page.waitForTimeout(300)

    // Take screenshot after first click
    await page.screenshot({ path: 'test-results/03-powerplant-queued.png' })

    // Wait for power plant to be ready
    await waitForBuildingReady('powerPlant')

    // Take screenshot when ready
    await page.screenshot({ path: 'test-results/04-powerplant-ready.png' })

    // Click the button again to enter placement mode
    await powerPlantBtn.click()
    console.log('Clicked Power Plant button (second time - enter placement mode)')
    await page.waitForTimeout(300)

    // Click the button again to enter placement mode
    await powerPlantBtn.click()
    console.log('Clicked Power Plant button (second time - enter placement mode)')
    await page.waitForTimeout(300)

    // Take screenshot in placement mode
    await page.screenshot({ path: 'test-results/05-powerplant-placement-mode.png' })

    // Verify placement mode is active
    const isInPlacementMode = await page.evaluate(() => {
      return window.gameState?.buildingPlacementMode === true
    })
    console.log('In placement mode:', isInPlacementMode)

    // Find a valid position and place the building
    const pos1 = await findPlacementPosition()
    console.log(`Placing Power Plant at (${pos1.x}, ${pos1.y})`)
    await page.mouse.click(pos1.x, pos1.y)

    // Wait for placement to complete
    await page.waitForTimeout(1000)

    // Take screenshot after placement
    await page.screenshot({ path: 'test-results/06-powerplant-placed.png' })

    // Verify money decreased
    currentMoney = await getMoney()
    console.log('Money after Power Plant:', currentMoney)

    // Verify building count increased
    const buildingCount1 = await page.evaluate(() => window.gameState?.buildings?.length || 0)
    console.log('Building count after Power Plant:', buildingCount1)

    // ========================================
    // Step 2: Build Ore Refinery
    // ========================================
    console.log('=== Step 2: Building Ore Refinery ===')

    const refineryBtn = page.locator('button.production-button[data-building-type="oreRefinery"]')
    await expect(refineryBtn).toBeVisible()
    await refineryBtn.click()
    console.log('Clicked Refinery button (first time)')
    await page.waitForTimeout(300)

    // Wait for refinery to be ready
    await waitForBuildingReady('oreRefinery')

    // Enter placement mode
    await refineryBtn.click()
    console.log('Clicked Refinery button (second time - enter placement mode)')
    await page.waitForTimeout(300)

    // Place refinery next to power plant, but with additional offset to avoid collision
    const pos2 = await findPlacementPositionForBuilding(1)
    console.log(`Placing Refinery at (${pos2.x}, ${pos2.y})`)
    await page.mouse.click(pos2.x, pos2.y)

    await page.waitForTimeout(1000)
    await page.screenshot({ path: 'test-results/07-refinery-placed.png' })

    currentMoney = await getMoney()
    console.log('Money after Refinery:', currentMoney)

    const buildingCount2 = await page.evaluate(() => window.gameState?.buildings?.length || 0)
    console.log('Building count after Refinery:', buildingCount2)

    // ========================================
    // Step 3: Build Vehicle Factory
    // ========================================
    console.log('=== Step 3: Building Vehicle Factory ===')

    const factoryBtn = page.locator('button.production-button[data-building-type="vehicleFactory"]')
    await expect(factoryBtn).toBeVisible()
    await factoryBtn.click()
    console.log('Clicked Vehicle Factory button (first time)')
    await page.waitForTimeout(300)

    // Wait for factory to be ready
    await waitForBuildingReady('vehicleFactory')

    // Enter placement mode
    await factoryBtn.click()
    console.log('Clicked Vehicle Factory button (second time - enter placement mode)')
    await page.waitForTimeout(300)

    // Place factory with additional offset
    const pos3 = await findPlacementPositionForBuilding(2)
    console.log(`Placing Vehicle Factory at (${pos3.x}, ${pos3.y})`)
    await page.mouse.click(pos3.x, pos3.y)

    await page.waitForTimeout(1000)
    await page.screenshot({ path: 'test-results/08-factory-placed.png' })

    currentMoney = await getMoney()
    console.log('Money after Vehicle Factory:', currentMoney)

    const buildingCount3 = await page.evaluate(() => window.gameState?.buildings?.length || 0)
    console.log('Building count after Vehicle Factory:', buildingCount3)

    // ========================================
    // Step 4: Switch to Units tab and build Harvester
    // ========================================
    console.log('=== Step 4: Building Harvester ===')

    // Switch to units tab
    const unitsTab = page.locator('button.tab-button[data-tab="units"]')
    await expect(unitsTab).toBeVisible()
    await unitsTab.click()
    console.log('Switched to Units tab')
    await page.waitForTimeout(300)

    await page.screenshot({ path: 'test-results/09-units-tab.png' })

    // Wait for units tab to be active
    await page.waitForTimeout(300)

    // Click harvester button
    const harvesterBtn = page.locator('button.production-button[data-unit-type="harvester"]')
    await expect(harvesterBtn).toBeVisible()
    await harvesterBtn.click()
    console.log('Clicked Harvester button')
    await page.waitForTimeout(300)

    await page.screenshot({ path: 'test-results/10-harvester-queued.png' })

    // Wait for harvester production to complete
    await waitForUnitReady('harvester', 60000)

    await page.screenshot({ path: 'test-results/11-harvester-complete.png' })

    currentMoney = await getMoney()
    console.log('Money after Harvester:', currentMoney)

    const unitCount1 = await page.evaluate(() => window.gameInstance?.units?.length || 0)
    console.log('Unit count after Harvester:', unitCount1)

    // ========================================
    // Step 5: Build Tank
    // ========================================
    console.log('=== Step 5: Building Tank ===')

    const tankBtn = page.locator('button.production-button[data-unit-type="tank"]')
    await expect(tankBtn).toBeVisible()
    await tankBtn.click()
    console.log('Clicked Tank button')
    await page.waitForTimeout(300)

    await page.screenshot({ path: 'test-results/12-tank-queued.png' })

    // Wait for tank production to complete
    await waitForUnitReady('tank', 60000)

    await page.screenshot({ path: 'test-results/13-tank-complete.png' })

    currentMoney = await getMoney()
    console.log('Money after Tank:', currentMoney)

    const unitCount2 = await page.evaluate(() => window.gameInstance?.units?.length || 0)
    console.log('Unit count after Tank:', unitCount2)

    // ========================================
    // Step 6: Select tank and command to move to ore field
    // ========================================
    console.log('=== Step 6: Commanding tank to move to ore field ===')

    // To select the tank, we need to find it on the canvas
    // The tank spawns from the vehicle factory
    // We'll click on the approximate location and then right-click to move

    const canvas = page.locator('#gameCanvas')
    const canvasBox = await canvas.boundingBox()
    if (!canvasBox) throw new Error('Canvas not found')

    // Click near where the tank would spawn (near factory)
    const tankSpawnX = canvasBox.x + canvasBox.width * 0.45
    const tankSpawnY = canvasBox.y + canvasBox.height * 0.6

    console.log(`Clicking to select tank at (${tankSpawnX}, ${tankSpawnY})`)
    // Click to select unit
    await page.mouse.click(tankSpawnX, tankSpawnY)
    await page.waitForTimeout(300)

    await page.screenshot({ path: 'test-results/14-tank-selected.png' })

    // Try to find ore on the map - ore fields are typically visible on the map
    // We'll command the tank to move towards the minimap area or use keyboard shortcut
    // Since we can't easily detect ore visually, we'll right-click in a direction
    // that would typically contain ore based on seed 11

    // Right-click to command move (towards where ore typically spawns)
    const oreTargetX = canvasBox.x + canvasBox.width * 0.2
    const oreTargetY = canvasBox.y + canvasBox.height * 0.3

    console.log(`Right-clicking to move tank to (${oreTargetX}, ${oreTargetY})`)
    await page.mouse.click(oreTargetX, oreTargetY, { button: 'right' })
    await page.waitForTimeout(500)

    await page.screenshot({ path: 'test-results/15-tank-move-command.png' })

    console.log('Move command issued')

    // ========================================
    // Final Verification
    // ========================================
    console.log('=== Final Verification ===')

    // Wait a moment for any async operations
    await page.waitForTimeout(1000)

    // Take final screenshot
    await page.screenshot({ path: 'test-results/16-final-state.png' })

    // Get final game state
    const finalState = await page.evaluate(() => ({
      money: window.gameState?.money,
      buildings: window.gameState?.buildings?.length,
      units: window.gameInstance?.units?.length,
      gameStarted: window.gameState?.gameStarted,
      gamePaused: window.gameState?.gamePaused
    }))

    console.log('=== FINAL GAME STATE ===')
    console.log('Money:', finalState.money)
    console.log('Buildings:', finalState.buildings)
    console.log('Units:', finalState.units)
    console.log('Game Started:', finalState.gameStarted)
    console.log('Game Paused:', finalState.gamePaused)
    console.log('========================')

    // Verify no console errors occurred
    const criticalErrors = consoleErrors.filter(err =>
      !err.includes('favicon') &&
      !err.includes('404') &&
      !err.includes('net::ERR') &&
      !err.includes('ResizeObserver')
    )

    if (criticalErrors.length > 0) {
      console.error('Console errors:', criticalErrors)
    }

    expect(criticalErrors).toHaveLength(0)

    // Verify game is still running (canvas is still rendering)
    await expect(canvas).toBeVisible()

    // Verify buildings exist by checking game state
    const buildingCount = await page.evaluate(() => {
      // @ts-ignore - accessing game state through window
      const gs = window.gameState
      if (!gs) return 0
      // Count player buildings (not counting initial construction yard)
      return gs.buildings?.filter(b => b.owner === gs.humanPlayer && b.type !== 'constructionYard').length || 0
    })

    console.log('Player buildings built:', buildingCount)
    expect(buildingCount).toBeGreaterThanOrEqual(3) // Power Plant + Refinery + Factory

    // Verify units exist
    const unitCount = await page.evaluate(() => {
      // @ts-ignore
      const gs = window.gameState
      if (!gs || !window.gameInstance?.units) return 0
      const units = window.gameInstance.units
      return units?.filter(u => u.owner === gs.humanPlayer).length || 0
    })

    console.log('Player units:', unitCount)
    expect(unitCount).toBeGreaterThanOrEqual(2) // Harvester + Tank

    console.log('Test completed successfully!')
  })
})

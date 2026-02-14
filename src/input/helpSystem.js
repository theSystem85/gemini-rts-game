// helpSystem.js
import { gameState } from '../gameState.js'

export class HelpSystem {
  constructor() {
    this.setupStyles()
  }

  setupStyles() {
    // Inject CSS styles for the help dialog
    if (!document.getElementById('help-dialog-styles')) {
      const style = document.createElement('style')
      style.id = 'help-dialog-styles'
      style.textContent = `
        .help-dialog-overlay {
          z-index: 1600;
        }

        .help-dialog__body {
          gap: 16px;
          overflow-x: hidden;
          scrollbar-width: none;
          -ms-overflow-style: none;
        }

        .help-dialog__body::-webkit-scrollbar {
          width: 0;
          height: 0;
        }

        .help-dialog__title {
          margin: 0;
          font-size: 18px;
          font-weight: 600;
          letter-spacing: 0.4px;
        }
      `
      document.head.appendChild(style)
    }
  }
  showControlsHelp() {
    let helpOverlay = document.getElementById('helpOverlay')
    if (!helpOverlay) {
      helpOverlay = document.createElement('div')
      helpOverlay.id = 'helpOverlay'
      helpOverlay.className = 'config-modal config-modal--open help-dialog-overlay'
      helpOverlay.setAttribute('aria-hidden', 'false')

      const dialog = document.createElement('div')
      dialog.className = 'config-modal__dialog help-dialog'

      dialog.innerHTML = `
        <div class="config-modal__header">
          <div class="config-modal__title-group">
            <h2 class="help-dialog__title">Game Controls</h2>
          </div>
          <button class="config-modal__close" id="help-close" aria-label="Close help">×</button>
        </div>
        <div class="config-modal__body help-dialog__body">
          <ul>
            <li><strong>Left Click:</strong> Select unit or factory</li>
            <li><strong>Double Click:</strong> Select all visible units of same type</li>
            <li><strong>Shift + Click:</strong> Add/remove unit to/from selection</li>
            <li><strong>Shift + Double Click:</strong> Add all visible units of same type to selection</li>
            <li><strong>Left Click + Drag:</strong> Select multiple units</li>
            <li><strong>Right Click:</strong> Move units / Attack enemy</li>
            <li><strong>Shift + Right Click:</strong> Retreat selected combat units</li>
            <li><strong>Alt + Command:</strong> Queue orders (Path Planning)</li>
            <li><strong>CTRL + Left Click:</strong> Force Attack (attack friendly units/buildings)</li>
            <li><strong>A Key:</strong> Toggle alert mode on selected tanks and service vehicles</li>
            <li><strong>X Key:</strong> Make selected units dodge</li>
            <li><strong>G Key:</strong> Toggle map grid visibility</li>
            <li><strong>O Key:</strong> Toggle occupancy map visibility (red glow on occupied tiles)</li>
            <li><strong>H Key:</strong> Focus view on your factory</li>
            <li><strong>I Key:</strong> Show this help (press again to close)</li>
            <li><strong>S Key:</strong> Stop selected units (cancel attack & movement, units slow to stop) / Toggle sell mode when none selected</li>
            <li><strong>R Key:</strong> Toggle repair mode</li>
            <li><strong>CTRL + 1-9:</strong> Assign selected units to control group</li>
            <li><strong>1-9 Keys:</strong> Select units in that control group</li>
            <li><strong>F Key:</strong> Toggle formation mode for selected units</li>
            <li><strong>T Key:</strong> Toggle tank image rendering (3-layer tank graphics)</li>
            <li><strong>P Key:</strong> Toggle FPS display (performance monitor)</li>
            <li><strong>L Key:</strong> Toggle logging for selected units</li>
          </ul>
          <h3>Map Editor Controls (when Edit Mode is active)</h3>
          <ul>
            <li><strong>Left Click:</strong> Paint selected tile type</li>
            <li><strong>Command/Ctrl + Left Click:</strong> Erase tiles (paint grass)</li>
            <li><strong>Shift + Left Click + Drag:</strong> Select rectangular area to paint</li>
            <li><strong>Right Click:</strong> Pipette tool (sample tile) + Scroll map</li>
            <li><strong>Shift + Right Click:</strong> Erase tiles (paint grass)</li>
            <li><strong>Mouse Wheel:</strong> Change brush size</li>
          </ul>
          <p>Press I again to close and resume the game</p>
        </div>
      `

      helpOverlay.appendChild(dialog)
      document.body.appendChild(helpOverlay)
      document.body.classList.add('config-modal-open')

      // Add event listeners
      this.setupDialogEventListeners(helpOverlay)

      // Prevent game inputs while dialog is open
      this.pauseGameInput(true)
    } else {
      this.closeDialog()
    }
  }

  setupDialogEventListeners(overlay) {
    const closeButton = document.getElementById('help-close')

    const closeDialog = () => {
      this.closeDialog()
    }

    closeButton.addEventListener('click', closeDialog)

    // Click overlay to close
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        closeDialog()
      }
    })

    // ESC key to close
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !overlay.classList.contains('hidden')) {
        closeDialog()
      }
    }, { once: true })
  }

  closeDialog() {
    const overlay = document.getElementById('helpOverlay')
    if (overlay) {
      overlay.remove()
    }
    document.body.classList.remove('config-modal-open')
    this.pauseGameInput(false)
  }

  pauseGameInput(paused) {
    if (paused) {
      gameState.helpDialogOpen = true
    } else {
      gameState.helpDialogOpen = false
    }
  }
}

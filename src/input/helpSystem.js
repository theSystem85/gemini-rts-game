// helpSystem.js
import { gameState } from '../gameState.js'

export class HelpSystem {
  showControlsHelp() {
    let helpOverlay = document.getElementById('helpOverlay')
    if (!helpOverlay) {
      helpOverlay = document.createElement('div')
      helpOverlay.id = 'helpOverlay'
      // Updated futuristic styling
      helpOverlay.style.position = 'absolute'
      helpOverlay.style.top = '50%'
      helpOverlay.style.left = '50%'
      helpOverlay.style.transform = 'translate(-50%, -50%)'
      helpOverlay.style.background = 'linear-gradient(135deg, #0f2027, #203a43, #2c5364)'
      helpOverlay.style.color = '#fff'
      helpOverlay.style.padding = '20px'
      helpOverlay.style.borderRadius = '10px'
      helpOverlay.style.boxShadow = '0 4px 15px rgba(0, 255, 255, 0.2)'
      helpOverlay.style.fontFamily = 'Roboto, sans-serif'
      helpOverlay.style.zIndex = '1000'
      helpOverlay.style.maxWidth = '80%'
      helpOverlay.style.maxHeight = '80%'
      helpOverlay.style.overflow = 'auto'

      helpOverlay.innerHTML = `
        <h2 style="margin-top:0;">Game Controls</h2>
        <ul>
          <li><strong>Left Click:</strong> Select unit or factory</li>
          <li><strong>Double Click:</strong> Select all visible units of same type</li>
          <li><strong>Shift + Click:</strong> Add/remove unit to/from selection</li>
          <li><strong>Shift + Double Click:</strong> Add all visible units of same type to selection</li>
          <li><strong>Left Click + Drag:</strong> Select multiple units</li>
          <li><strong>Right Click:</strong> Move units / Attack enemy</li>
          <li><strong>CTRL + Left Click:</strong> Force Attack (attack friendly units/buildings)</li>
          <li><strong>A Key:</strong> Toggle alert mode on selected tanks</li>
          <li><strong>D Key:</strong> Make selected units dodge</li>
          <li><strong>G Key:</strong> Toggle map grid visibility</li>
          <li><strong>H Key:</strong> Focus view on your factory</li>
          <li><strong>I Key:</strong> Show this help (press again to close)</li>
          <li><strong>S Key:</strong> Toggle sell mode (sell buildings for 70% of cost)</li>
          <li><strong>CTRL + 1-9:</strong> Assign selected units to control group</li>
          <li><strong>1-9 Keys:</strong> Select units in that control group</li>
          <li><strong>F Key:</strong> Toggle formation mode for selected units</li>
        </ul>
        <p>Press I again to close and resume the game</p>
      `
      document.body.appendChild(helpOverlay)
    } else {
      helpOverlay.style.display = helpOverlay.style.display === 'none' ? 'block' : 'none'
    }

    // Toggle game pause state
    gameState.paused = !gameState.paused
  }
}

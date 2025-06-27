// inputUtils.js
// Utility functions for input handling

/**
 * Check if any input field or textarea is currently focused
 * This prevents keyboard shortcuts from firing when user is typing
 */
export function isInputFieldFocused() {
  const activeElement = document.activeElement
  if (!activeElement) return false

  const tagName = activeElement.tagName.toLowerCase()
  const inputTypes = ['input', 'textarea', 'select']

  return inputTypes.includes(tagName) ||
         activeElement.contentEditable === 'true' ||
         activeElement.hasAttribute('contenteditable')
}

/**
 * Track whether the self‑attack modifier key (Ctrl/Cmd) is currently held down.
 * For mouse events we rely on cached state from the most recent key event.
 */
let forceAttackKeyActive = false

/**
 * Determine if the self-attack modifier is active. Provide keyboard or mouse
 * events so the internal state can update accordingly. For calls without an
 * event, the cached state is returned.
 *
 * @param {KeyboardEvent|MouseEvent} [e]
 * @returns {boolean} True if Ctrl or Cmd is held
 */
export function isForceAttackModifierActive(e) {
  if (e && (e.type === 'keydown' || e.type === 'keyup')) {
    const isModifier = e.key === 'Control' || e.key === 'Meta'
    if (isModifier) {
      forceAttackKeyActive = e.type === 'keydown'
    } else {
      forceAttackKeyActive = e.ctrlKey || e.metaKey
    }
  } else if (e && typeof e.ctrlKey === 'boolean') {
    forceAttackKeyActive = e.ctrlKey || e.metaKey
  }
  return forceAttackKeyActive
}

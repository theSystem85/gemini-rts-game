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
 * Track whether the self‑attack modifier key ("v") is currently held down.
 * Mouse events won't contain this information, so we persist the state when
 * key events occur and simply return it otherwise.
 */
let forceAttackKeyActive = false

/**
 * Determine if the self-attack modifier key is active. Pass any keyboard event
 * so the internal state can be updated. For non-keyboard events, simply return
 * the cached value.
 *
 * @param {KeyboardEvent|MouseEvent} [e] - Optional event that may update state
 * @returns {boolean} True if the "v" key is currently held
 */
export function isForceAttackModifierActive(e) {
  if (e && (e.type === 'keydown' || e.type === 'keyup')) {
    if (e.key && e.key.toLowerCase() === 'v') {
      forceAttackKeyActive = e.type === 'keydown'
    }
  }
  return forceAttackKeyActive
}

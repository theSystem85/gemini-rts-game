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
 * Determine if the self-attack modifier key is active.
 * Ctrl is used on Windows/Linux while Cmd or Option are used on macOS.
 * @param {KeyboardEvent|MouseEvent} e - The event to inspect
 * @returns {boolean} True if the modifier is active
 */
export function isForceAttackModifierActive(e) {
  const isMac = typeof navigator !== 'undefined' && /Mac/.test(navigator.platform)
  if (isMac) {
    return e.metaKey || e.altKey || e.ctrlKey
  }
  return e.ctrlKey
}

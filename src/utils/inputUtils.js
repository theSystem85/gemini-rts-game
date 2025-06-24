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

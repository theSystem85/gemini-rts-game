export function readFromStorage(key, fallback) {
  if (typeof localStorage === 'undefined') {
    return fallback
  }
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return fallback
    return { ...fallback, ...JSON.parse(raw) }
  } catch (err) {
    window.logger?.warn?.('Failed to read tutorial storage:', err)
    return fallback
  }
}

export function writeToStorage(key, payload) {
  if (typeof localStorage === 'undefined') {
    return
  }
  try {
    localStorage.setItem(key, JSON.stringify(payload))
  } catch (err) {
    window.logger?.warn?.('Failed to write tutorial storage:', err)
  }
}

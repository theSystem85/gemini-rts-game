const MAX_SEED_VALUE = 0x7fffffff

function clampSeed(value) {
  const normalized = Math.abs(Math.floor(value))
  if (!normalized) {
    return 1
  }
  return Math.min(normalized, MAX_SEED_VALUE)
}

export function generateRandomSeed() {
  return clampSeed(Math.floor(Math.random() * MAX_SEED_VALUE) + 1)
}

export function hashSeedString(text) {
  if (!text) {
    return 1
  }
  let hash = 0
  for (let i = 0; i < text.length; i++) {
    hash = (hash * 31 + text.charCodeAt(i)) | 0
  }
  return clampSeed(hash || text.length)
}

export function sanitizeSeed(rawSeed, { allowRandomKeyword = false } = {}) {
  if (typeof rawSeed === 'number' && Number.isFinite(rawSeed)) {
    return { value: clampSeed(rawSeed), reason: 'number', randomized: false }
  }

  const str = rawSeed != null ? String(rawSeed).trim() : ''
  if (!str) {
    return { value: generateRandomSeed(), reason: 'empty', randomized: true }
  }

  if (allowRandomKeyword && str.toLowerCase() === 'random') {
    return { value: generateRandomSeed(), reason: 'random', randomized: true }
  }

  const parsed = Number.parseInt(str, 10)
  if (!Number.isNaN(parsed)) {
    return { value: clampSeed(parsed), reason: 'parsed', randomized: false }
  }

  return { value: hashSeedString(str), reason: 'hashed', randomized: false }
}

export { MAX_SEED_VALUE }

/**
 * QR Code Generator for invite links
 * Uses a minimal QR code generation approach via Canvas
 * Based on QR code standard (ISO/IEC 18004:2015)
 */

// Galois Field operations for Reed-Solomon error correction
const GF_EXP = new Uint8Array(512)
const GF_LOG = new Uint8Array(256)

// Initialize Galois Field tables
;(function initGF() {
  let x = 1
  for (let i = 0; i < 255; i++) {
    GF_EXP[i] = x
    GF_LOG[x] = i
    x <<= 1
    if (x & 0x100) x ^= 0x11d
  }
  for (let i = 255; i < 512; i++) {
    GF_EXP[i] = GF_EXP[i - 255]
  }
})()

function gfMul(a, b) {
  if (a === 0 || b === 0) return 0
  return GF_EXP[GF_LOG[a] + GF_LOG[b]]
}

// RS polynomial generation
function rsGeneratorPoly(nsym) {
  let g = [1]
  for (let i = 0; i < nsym; i++) {
    const factor = [1, GF_EXP[i]]
    const newG = Array.from({ length: g.length + 1 }, () => 0)
    for (let j = 0; j < g.length; j++) {
      newG[j] ^= g[j]
      newG[j + 1] ^= gfMul(g[j], factor[1])
    }
    g = newG
  }
  return g
}

function rsEncode(data, nsym) {
  const gen = rsGeneratorPoly(nsym)
  const res = Array.from({ length: data.length + nsym }, () => 0)
  for (let i = 0; i < data.length; i++) {
    res[i] = data[i]
  }
  for (let i = 0; i < data.length; i++) {
    const coef = res[i]
    if (coef !== 0) {
      for (let j = 0; j < gen.length; j++) {
        res[i + j] ^= gfMul(gen[j], coef)
      }
    }
  }
  return res.slice(data.length)
}

// QR code version info
const QR_VERSIONS = [
  null, // version 0 doesn't exist
  { size: 21, totalBytes: 26, dataBytes: 19, ecBytes: 7 },
  { size: 25, totalBytes: 44, dataBytes: 34, ecBytes: 10 },
  { size: 29, totalBytes: 70, dataBytes: 55, ecBytes: 15 },
  { size: 33, totalBytes: 100, dataBytes: 80, ecBytes: 20 },
  { size: 37, totalBytes: 134, dataBytes: 108, ecBytes: 26 },
  { size: 41, totalBytes: 172, dataBytes: 136, ecBytes: 36 },
  { size: 45, totalBytes: 196, dataBytes: 156, ecBytes: 40 }
]

function getVersion(dataLen) {
  // Byte mode capacity (with some margin for mode indicators)
  for (let v = 1; v < QR_VERSIONS.length; v++) {
    const info = QR_VERSIONS[v]
    if (dataLen + 3 <= info.dataBytes) return v
  }
  throw new Error('Data too long for QR code')
}

function encodeData(text, version) {
  const info = QR_VERSIONS[version]
  const bytes = new TextEncoder().encode(text)
  const data = []

  // Byte mode indicator (0100)
  data.push(0x40 | (bytes.length >> 4))
  data.push(((bytes.length & 0x0f) << 4) | (bytes[0] >> 4))

  for (let i = 0; i < bytes.length - 1; i++) {
    data.push(((bytes[i] & 0x0f) << 4) | (bytes[i + 1] >> 4))
  }
  data.push((bytes[bytes.length - 1] & 0x0f) << 4)

  // Terminator and padding
  while (data.length < info.dataBytes) {
    data.push(data.length % 2 === info.dataBytes % 2 ? 0xec : 0x11)
  }

  return data.slice(0, info.dataBytes)
}

function createMatrix(version) {
  const size = QR_VERSIONS[version].size
  const matrix = Array.from({ length: size }, () => Array(size).fill(null))

  // Add finder patterns
  const addFinderPattern = (row, col) => {
    for (let r = -1; r <= 7; r++) {
      for (let c = -1; c <= 7; c++) {
        const rr = row + r
        const cc = col + c
        if (rr < 0 || rr >= size || cc < 0 || cc >= size) continue

        if (r === -1 || r === 7 || c === -1 || c === 7) {
          matrix[rr][cc] = false // white separator
        } else if (r === 0 || r === 6 || c === 0 || c === 6 || (r >= 2 && r <= 4 && c >= 2 && c <= 4)) {
          matrix[rr][cc] = true // black
        } else {
          matrix[rr][cc] = false // white
        }
      }
    }
  }

  addFinderPattern(0, 0)
  addFinderPattern(0, size - 7)
  addFinderPattern(size - 7, 0)

  // Add timing patterns
  for (let i = 8; i < size - 8; i++) {
    matrix[6][i] = i % 2 === 0
    matrix[i][6] = i % 2 === 0
  }

  // Dark module
  matrix[size - 8][8] = true

  // Reserve format info areas
  for (let i = 0; i < 9; i++) {
    if (matrix[8][i] === null) matrix[8][i] = false
    if (matrix[i][8] === null) matrix[i][8] = false
    if (i < 8) {
      if (matrix[8][size - 1 - i] === null) matrix[8][size - 1 - i] = false
      if (matrix[size - 1 - i][8] === null) matrix[size - 1 - i][8] = false
    }
  }

  // Add alignment pattern for version >= 2
  if (version >= 2) {
    const pos = size - 7
    for (let r = -2; r <= 2; r++) {
      for (let c = -2; c <= 2; c++) {
        if (Math.abs(r) === 2 || Math.abs(c) === 2 || (r === 0 && c === 0)) {
          matrix[pos + r][pos + c] = true
        } else {
          matrix[pos + r][pos + c] = false
        }
      }
    }
  }

  return matrix
}

function placeData(matrix, data, ecData) {
  const size = matrix.length
  const allData = [...data, ...ecData]
  let bitIdx = 0

  // Place data in zigzag pattern
  let up = true
  for (let col = size - 1; col >= 1; col -= 2) {
    if (col === 6) col = 5 // Skip timing pattern column

    for (let row = 0; row < size; row++) {
      const r = up ? size - 1 - row : row

      for (let c = 0; c < 2; c++) {
        const cc = col - c
        if (matrix[r][cc] === null) {
          const byteIdx = Math.floor(bitIdx / 8)
          const bitPos = 7 - (bitIdx % 8)
          const bit = byteIdx < allData.length ? ((allData[byteIdx] >> bitPos) & 1) === 1 : false
          matrix[r][cc] = bit
          bitIdx++
        }
      }
    }
    up = !up
  }
}

function applyMask(matrix) {
  const size = matrix.length
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      // Check if this is a data module (not part of function patterns)
      if (isDataModule(r, c, size)) {
        // Mask pattern 0: (row + column) mod 2 == 0
        if ((r + c) % 2 === 0) {
          matrix[r][c] = !matrix[r][c]
        }
      }
    }
  }
}

function isDataModule(row, col, size) {
  // Finder patterns and separators
  if (row < 9 && col < 9) return false
  if (row < 9 && col >= size - 8) return false
  if (row >= size - 8 && col < 9) return false

  // Timing patterns
  if (row === 6 || col === 6) return false

  // Alignment pattern (for version >= 2)
  if (size > 21) {
    const pos = size - 7
    if (Math.abs(row - pos) <= 2 && Math.abs(col - pos) <= 2) return false
  }

  return true
}

function addFormatInfo(matrix) {
  const size = matrix.length
  // Format info for EC level L and mask pattern 0
  const formatBits = 0x77c4 // Pre-calculated for L and mask 0

  // Place format info around finder patterns
  const bits = []
  for (let i = 0; i < 15; i++) {
    bits.push(((formatBits >> (14 - i)) & 1) === 1)
  }

  // Top-left (horizontal)
  for (let i = 0; i <= 5; i++) matrix[8][i] = bits[i]
  matrix[8][7] = bits[6]
  matrix[8][8] = bits[7]
  matrix[7][8] = bits[8]

  // Top-left (vertical)
  for (let i = 9; i < 15; i++) matrix[14 - i][8] = bits[i]

  // Top-right
  for (let i = 0; i < 8; i++) matrix[8][size - 1 - i] = bits[i]

  // Bottom-left
  for (let i = 8; i < 15; i++) matrix[size - 15 + i][8] = bits[i]
}

/**
 * Generate a QR code matrix for the given text
 * @param {string} text - The text to encode
 * @returns {boolean[][]} - 2D array where true = black, false = white
 */
export function generateQRMatrix(text) {
  const version = getVersion(text.length)
  const info = QR_VERSIONS[version]

  const data = encodeData(text, version)
  const ecData = rsEncode(data, info.ecBytes)

  const matrix = createMatrix(version)
  placeData(matrix, data, ecData)
  applyMask(matrix)
  addFormatInfo(matrix)

  return matrix
}

/**
 * Render QR code to a canvas element
 * @param {HTMLCanvasElement} canvas - The canvas to render to
 * @param {string} text - The text to encode
 * @param {Object} options - Rendering options
 * @param {number} options.size - Canvas size in pixels (default: 150)
 * @param {string} options.foreground - Foreground color (default: '#000000')
 * @param {string} options.background - Background color (default: '#ffffff')
 * @param {number} options.margin - Margin in modules (default: 2)
 */
export function renderQRCode(canvas, text, options = {}) {
  const {
    size = 150,
    foreground = '#000000',
    background = '#ffffff',
    margin = 2
  } = options

  const matrix = generateQRMatrix(text)
  const moduleCount = matrix.length + margin * 2
  const moduleSize = size / moduleCount

  canvas.width = size
  canvas.height = size

  const ctx = canvas.getContext('2d')

  // Fill background
  ctx.fillStyle = background
  ctx.fillRect(0, 0, size, size)

  // Draw modules
  ctx.fillStyle = foreground
  for (let row = 0; row < matrix.length; row++) {
    for (let col = 0; col < matrix[row].length; col++) {
      if (matrix[row][col]) {
        const x = (col + margin) * moduleSize
        const y = (row + margin) * moduleSize
        ctx.fillRect(x, y, moduleSize + 0.5, moduleSize + 0.5)
      }
    }
  }
}

/**
 * Create a QR code canvas element for the given URL
 * @param {string} url - The URL to encode
 * @param {number} size - Size in pixels (default: 120)
 * @returns {HTMLCanvasElement} - Canvas element with rendered QR code
 */
export function createQRCodeCanvas(url, size = 120) {
  const canvas = document.createElement('canvas')
  renderQRCode(canvas, url, { size })
  return canvas
}

// rendering/apacheImageRenderer.js
// Image renderer for Apache helicopter unit with rotor animation and tilt caching

import { TILE_SIZE } from '../config.js'

const ROTATION_STEPS = 32
const TILT_VARIANTS = ['neutral', 'forward', 'backward', 'left', 'right']
const ROTOR_ANCHOR = { x: 31, y: 30 }
const DEFAULT_TILT_SCALE = {
  neutral: { x: 1, y: 1 },
  forward: { x: 1.02, y: 0.88 },
  backward: { x: 1.0, y: 1.12 },
  left: { x: 0.9, y: 1.0 },
  right: { x: 1.1, y: 1.0 }
}

let bodyImage = null
let rotorImage = null
let imagesLoaded = false
let imagesLoading = false

const bodySpriteCache = new Map()
let cacheBaseSize = null

function ensureCacheVariant(variant) {
  if (!bodySpriteCache.has(variant)) {
    bodySpriteCache.set(variant, new Array(ROTATION_STEPS))
  }
  return bodySpriteCache.get(variant)
}

function normalizeAngle(angle) {
  let a = angle % (Math.PI * 2)
  if (a < 0) a += Math.PI * 2
  return a
}

function createBodyFrame(angle, variant) {
  const scale = DEFAULT_TILT_SCALE[variant] || DEFAULT_TILT_SCALE.neutral
  const baseSize = Math.max(bodyImage.width, bodyImage.height)
  const canvasSize = Math.ceil(baseSize * 1.6)
  if (!cacheBaseSize) {
    cacheBaseSize = canvasSize
  }
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = canvasSize
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    return null
  }

  const rotation = angle - Math.PI / 2

  ctx.translate(canvasSize / 2, canvasSize / 2)
  ctx.scale(scale.x, scale.y)
  ctx.rotate(rotation)
  ctx.drawImage(bodyImage, -bodyImage.width / 2, -bodyImage.height / 2)

  const offsetX = (ROTOR_ANCHOR.x - bodyImage.width / 2) * scale.x
  const offsetY = (ROTOR_ANCHOR.y - bodyImage.height / 2) * scale.y
  const rotatedOffsetX = offsetX * Math.cos(rotation) - offsetY * Math.sin(rotation)
  const rotatedOffsetY = offsetX * Math.sin(rotation) + offsetY * Math.cos(rotation)

  return {
    canvas,
    rotorOffset: { x: rotatedOffsetX, y: rotatedOffsetY }
  }
}

function buildSpriteCache() {
  bodySpriteCache.clear()
  cacheBaseSize = null
  TILT_VARIANTS.forEach(variant => {
    const frames = ensureCacheVariant(variant)
    for (let step = 0; step < ROTATION_STEPS; step++) {
      const angle = (step / ROTATION_STEPS) * Math.PI * 2
      frames[step] = createBodyFrame(angle, variant)
    }
  })
}

export function preloadApacheImages(callback) {
  if (imagesLoaded) {
    if (callback) callback(true)
    return
  }
  if (imagesLoading) {
    return
  }

  imagesLoading = true
  let loaded = 0
  const total = 2

  const handleLoad = () => {
    loaded += 1
    if (loaded >= total) {
      imagesLoaded = true
      imagesLoading = false
      buildSpriteCache()
      if (callback) callback(true)
    }
  }

  const handleError = (type) => {
    console.error(`Failed to load Apache ${type} image`)
    imagesLoaded = false
    imagesLoading = false
    if (callback) callback(false)
  }

  bodyImage = new Image()
  bodyImage.onload = handleLoad
  bodyImage.onerror = () => handleError('body')
  bodyImage.src = 'images/map/units/apache-body-map.webp'

  rotorImage = new Image()
  rotorImage.onload = handleLoad
  rotorImage.onerror = () => handleError('rotor')
  rotorImage.src = 'images/map/units/apache-rotor-map.webp'
}

export function isApacheImageLoaded() {
  return imagesLoaded && bodyImage && rotorImage && bodyImage.complete && rotorImage.complete
}

function getFrameIndex(angle) {
  const normalized = normalizeAngle(angle)
  const fraction = normalized / (Math.PI * 2)
  return Math.floor(fraction * ROTATION_STEPS) % ROTATION_STEPS
}

function getBodyFrame(angle, tiltVariant = 'neutral') {
  if (!isApacheImageLoaded()) {
    return null
  }
  const variant = bodySpriteCache.has(tiltVariant) ? tiltVariant : 'neutral'
  const frames = bodySpriteCache.get(variant)
  if (!frames || frames.length === 0) {
    return null
  }
  const index = getFrameIndex(angle)
  return frames[index] || frames[0]
}

function drawShadow(ctx, centerX, centerY, unit) {
  const scale = Math.max(0.4, unit.shadowScale || 1)
  const offset = unit.shadowOffset || 0
  ctx.save()
  ctx.translate(centerX, centerY + offset)
  ctx.scale(scale, scale * 0.6)
  ctx.beginPath()
  ctx.ellipse(0, 0, TILE_SIZE * 0.45, TILE_SIZE * 0.35, 0, 0, Math.PI * 2)
  ctx.fillStyle = 'rgba(0, 0, 0, 0.28)'
  ctx.fill()
  ctx.restore()
}

function drawRotor(ctx, centerX, centerY, angle, rotorOffset, scale, unit) {
  if (!rotorImage) return
  const rotorScale = scale
  const drawWidth = rotorImage.width * rotorScale
  const drawHeight = rotorImage.height * rotorScale
  const offsetX = (rotorOffset?.x || 0) * scale
  const offsetY = (rotorOffset?.y || 0) * scale

  ctx.save()
  ctx.translate(centerX + offsetX, centerY + offsetY)
  ctx.rotate(unit.rotor?.phase || 0)
  ctx.drawImage(rotorImage, -drawWidth / 2, -drawHeight / 2, drawWidth, drawHeight)
  ctx.restore()
}

export function getApacheRocketMounts(unit, centerX, centerY) {
  if (!isApacheImageLoaded()) {
    return [
      { x: centerX - TILE_SIZE * 0.2, y: centerY + TILE_SIZE * 0.05 },
      { x: centerX + TILE_SIZE * 0.2, y: centerY + TILE_SIZE * 0.05 }
    ]
  }
  const frame = getBodyFrame(unit.direction || 0, unit.tiltState || 'neutral')
  if (!frame) {
    return [
      { x: centerX - TILE_SIZE * 0.2, y: centerY },
      { x: centerX + TILE_SIZE * 0.2, y: centerY }
    ]
  }

  const scale = TILE_SIZE / Math.max(bodyImage.width, bodyImage.height)
  const offsetLeft = { x: -0.35 * TILE_SIZE, y: TILE_SIZE * 0.02 }
  const offsetRight = { x: 0.35 * TILE_SIZE, y: TILE_SIZE * 0.02 }
  return [
    { x: centerX + offsetLeft.x, y: centerY + offsetLeft.y },
    { x: centerX + offsetRight.x, y: centerY + offsetRight.y }
  ]
}

export function renderApacheWithImage(ctx, unit, centerX, centerY) {
  if (!isApacheImageLoaded()) {
    return false
  }

  if (!bodySpriteCache.size) {
    buildSpriteCache()
  }

  const tilt = unit.tiltState || 'neutral'
  const frame = getBodyFrame(unit.direction || 0, tilt)
  if (!frame) {
    return false
  }

  const scale = TILE_SIZE / Math.max(bodyImage.width, bodyImage.height)
  const canvas = frame.canvas
  const drawWidth = canvas.width * scale
  const drawHeight = canvas.height * scale

  drawShadow(ctx, centerX, centerY, unit)

  ctx.save()
  ctx.globalAlpha = 1
  ctx.drawImage(canvas, centerX - drawWidth / 2, centerY - drawHeight / 2, drawWidth, drawHeight)
  ctx.restore()

  drawRotor(ctx, centerX, centerY, unit.direction || 0, frame.rotorOffset, scale, unit)
  return true
}

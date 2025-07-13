let spriteSheetImg = null
let spriteMap = null
let loadingPromise = null

function loadImage(path) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = path
  })
}

export function loadSpriteSheet() {
  if (loadingPromise) return loadingPromise
  loadingPromise = Promise.all([
    fetch('images/map/spriteMap.json').then(r => r.json()),
    loadImage('images/map/spriteSheet.png')
  ]).then(([map, img]) => {
    spriteMap = map
    spriteSheetImg = img
  })
  return loadingPromise
}

export function getSpriteSheetImage() {
  return spriteSheetImg
}

export function getSprite(path) {
  if (!spriteMap || !spriteSheetImg) return null
  const key = path.replace(/^images\/map\//, '')
  const data = spriteMap[key]
  if (!data) return null
  return { img: spriteSheetImg, ...data }
}

export function isSpriteSheetLoaded() {
  return !!(spriteMap && spriteSheetImg)
}

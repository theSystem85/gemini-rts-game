import { findPath } from '../units.js'

const MAX_EDGE_DISTANCE = 40
const MAX_EDGES_PER_NODE = 6
const EXTRA_EDGE_DISTANCE = 80

function getDistance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

function ensureAdjacencyEntry(adjacency, nodeId) {
  if (!adjacency.has(nodeId)) {
    adjacency.set(nodeId, [])
  }
  return adjacency.get(nodeId)
}

const ORTHOGONAL_DIRS = [
  { x: 1, y: 0 },
  { x: -1, y: 0 },
  { x: 0, y: 1 },
  { x: 0, y: -1 }
]

function isPassable(tile) {
  return tile && tile.type !== 'water' && tile.type !== 'rock' && !tile.building && !tile.seedCrystal
}

function connectNodes(mapGrid, start, end, edges, paths, adjacency, existingEdges, maxDistance) {
  const key = [start.id, end.id].sort().join('-')
  if (existingEdges.has(key)) return false

  const distance = getDistance(start, end)
  if (distance > maxDistance) return false

  const path = findPath({ x: start.x, y: start.y }, { x: end.x, y: end.y }, mapGrid, null)
  if (!path || path.length < 2) {
    return false
  }

  existingEdges.add(key)

  const forwardKey = `${start.id}-${end.id}`
  const reverseKey = `${end.id}-${start.id}`
  paths[forwardKey] = path
  paths[reverseKey] = path.slice().reverse()

  const cost = path.length

  ensureAdjacencyEntry(adjacency, start.id).push({ id: end.id, cost, edgeKey: forwardKey })
  ensureAdjacencyEntry(adjacency, end.id).push({ id: start.id, cost, edgeKey: reverseKey })

  edges.push({ from: start.id, to: end.id, path, cost })
  return true
}

function buildConnectivity(mapGrid, nodes, edges, paths, adjacency, existingEdges) {
  if (nodes.length === 0) return
  const visited = new Set()
  const queue = [nodes[0].id]

  while (queue.length > 0) {
    const current = queue.shift()
    if (visited.has(current)) continue
    visited.add(current)
    const neighbors = adjacency.get(current) || []
    neighbors.forEach(neighbor => {
      if (!visited.has(neighbor.id)) {
        queue.push(neighbor.id)
      }
    })
  }

  if (visited.size === nodes.length) {
    return
  }

  const visitedNodes = nodes.filter(node => visited.has(node.id))
  const unvisitedNodes = nodes.filter(node => !visited.has(node.id))

  unvisitedNodes.forEach(unvisited => {
    const candidates = visitedNodes
      .map(candidate => ({ candidate, distance: getDistance(unvisited, candidate) }))
      .sort((a, b) => a.distance - b.distance)

    for (const { candidate } of candidates) {
      let connected = connectNodes(
        mapGrid,
        unvisited,
        candidate,
        edges,
        paths,
        adjacency,
        existingEdges,
        EXTRA_EDGE_DISTANCE
      )

      if (!connected) {
        connected = connectNodes(
          mapGrid,
          unvisited,
          candidate,
          edges,
          paths,
          adjacency,
          existingEdges,
          Infinity
        )
      }

      if (connected) {
        visited.add(unvisited.id)
        visitedNodes.push(unvisited)
        break
      }
    }
  })
}

function findNetworkRoute(network, startId, endId) {
  if (!network || !network.adjacency) return null
  const adjacency = network.adjacency
  const hasNode = (id) => {
    if (typeof adjacency.has === 'function') {
      return adjacency.has(id)
    }
    return Array.isArray(adjacency[id])
  }
  const getNeighbors = (id) => {
    if (typeof adjacency.get === 'function') {
      return adjacency.get(id) || []
    }
    return adjacency[id] || []
  }

  if (!hasNode(startId) || !hasNode(endId)) return null

  const distances = new Map()
  const previous = new Map()
  const queue = []

  distances.set(startId, 0)
  queue.push({ id: startId, cost: 0 })

  while (queue.length > 0) {
    queue.sort((a, b) => a.cost - b.cost)
    const current = queue.shift()
    if (!current) break
    if (current.id === endId) break

    const neighbors = getNeighbors(current.id)
    neighbors.forEach(neighbor => {
      const nextCost = current.cost + neighbor.cost
      const best = distances.has(neighbor.id) ? distances.get(neighbor.id) : Infinity
      if (nextCost < best) {
        distances.set(neighbor.id, nextCost)
        previous.set(neighbor.id, { id: current.id, edgeKey: neighbor.edgeKey })
        queue.push({ id: neighbor.id, cost: nextCost })
      }
    })
  }

  if (!previous.has(endId) && startId !== endId) {
    return null
  }

  const segments = []
  let currentId = endId

  while (currentId !== startId) {
    const prev = previous.get(currentId)
    if (!prev) {
      return null
    }
    segments.push({ from: prev.id, to: currentId, edgeKey: prev.edgeKey })
    currentId = prev.id
  }

  segments.reverse()
  return segments
}

function addNode(nodes, x, y, type, label) {
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null
  const existing = nodes.find(node => Math.hypot(node.x - x, node.y - y) < 2)
  if (existing) {
    return existing
  }
  const node = {
    id: `${type}-${nodes.length}`,
    x: Math.round(x),
    y: Math.round(y),
    type,
    label
  }
  nodes.push(node)
  return node
}

function collectBaseNodes(mapGrid, factories) {
  const nodes = []
  factories.forEach(factory => {
    const centerX = factory.x + factory.width / 2
    const centerY = factory.y + factory.height / 2
    let bestTile = null
    let bestDistance = Infinity
    for (let y = Math.max(0, factory.y - 3); y <= Math.min(mapGrid.length - 1, factory.y + factory.height + 3); y++) {
      for (let x = Math.max(0, factory.x - 3); x <= Math.min(mapGrid[0].length - 1, factory.x + factory.width + 3); x++) {
        const tile = mapGrid[y][x]
        if (isPassable(tile) && tile.type === 'street') {
          const distance = Math.hypot(x - centerX, y - centerY)
          if (distance < bestDistance) {
            bestDistance = distance
            bestTile = { x, y }
          }
        }
      }
    }
    if (!bestTile) {
      for (let radius = 1; radius <= 4 && !bestTile; radius++) {
        for (let dy = -radius; dy <= radius; dy++) {
          for (let dx = -radius; dx <= radius; dx++) {
            const x = Math.round(centerX + dx)
            const y = Math.round(centerY + dy)
            if (y >= 0 && y < mapGrid.length && x >= 0 && x < mapGrid[0].length) {
              const tile = mapGrid[y][x]
              if (isPassable(tile)) {
                bestTile = { x, y }
                break
              }
            }
          }
          if (bestTile) break
        }
      }
    }
    if (bestTile) {
      addNode(nodes, bestTile.x, bestTile.y, 'base', factory.owner)
    }
  })
  return nodes
}

function collectOreNodes(mapGrid) {
  const visited = new Set()
  const nodes = []
  const height = mapGrid.length
  const width = mapGrid[0].length

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const tile = mapGrid[y][x]
      if (!tile || !tile.ore || tile.seedCrystal) continue
      const key = `${x},${y}`
      if (visited.has(key)) continue

      const queue = [{ x, y }]
      const cluster = []
      visited.add(key)

      while (queue.length) {
        const current = queue.shift()
        cluster.push(current)
        for (const dir of ORTHOGONAL_DIRS) {
          const nx = current.x + dir.x
          const ny = current.y + dir.y
          if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue
          const neighbor = mapGrid[ny][nx]
          if (!neighbor || !neighbor.ore || neighbor.seedCrystal) continue
          const neighborKey = `${nx},${ny}`
          if (visited.has(neighborKey)) continue
          visited.add(neighborKey)
          queue.push({ x: nx, y: ny })
        }
      }

      if (cluster.length === 0) continue
      const avgX = cluster.reduce((sum, point) => sum + point.x, 0) / cluster.length
      const avgY = cluster.reduce((sum, point) => sum + point.y, 0) / cluster.length
      const node = addNode(nodes, avgX, avgY, 'ore', `ore-${nodes.length}`)
      if (node) {
        const tile = mapGrid[node.y][node.x]
        if (!isPassable(tile)) {
          for (const dir of ORTHOGONAL_DIRS) {
            const nx = node.x + dir.x
            const ny = node.y + dir.y
            if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
              const candidate = mapGrid[ny][nx]
              if (isPassable(candidate)) {
                node.x = nx
                node.y = ny
                break
              }
            }
          }
        }
      }
    }
  }
  return nodes
}

function collectStreetIntersections(mapGrid) {
  const nodes = []
  const height = mapGrid.length
  const width = mapGrid[0].length

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const tile = mapGrid[y][x]
      if (!tile || tile.type !== 'street') continue

      let orthCount = 0
      const orthConnections = []
      for (const dir of ORTHOGONAL_DIRS) {
        const nx = x + dir.x
        const ny = y + dir.y
        const neighbor = mapGrid[ny][nx]
        if (neighbor && neighbor.type === 'street') {
          orthCount++
          orthConnections.push(dir)
        }
      }

      const hasTurn = (
        orthConnections.some(d => d.x !== 0) &&
        orthConnections.some(d => d.y !== 0)
      )
      if (orthCount >= 3 || (orthCount === 2 && hasTurn)) {
        addNode(nodes, x, y, 'street', `street-${nodes.length}`)
      }
    }
  }
  return nodes
}

function buildEdgeMap(mapGrid, nodes) {
  const edges = []
  const paths = {}
  const adjacency = new Map()
  const existingEdges = new Set()

  nodes.forEach((node, index) => {
    ensureAdjacencyEntry(adjacency, node.id)

    const candidates = nodes
      .filter((candidate, candidateIndex) => candidateIndex !== index)
      .map(candidate => ({
        node: candidate,
        distance: getDistance(node, candidate)
      }))
      .sort((a, b) => a.distance - b.distance)

    let edgesAdded = 0

    for (const candidate of candidates) {
      const connected = connectNodes(
        mapGrid,
        node,
        candidate.node,
        edges,
        paths,
        adjacency,
        existingEdges,
        MAX_EDGE_DISTANCE
      )

      if (connected) {
        edgesAdded++
      }

      if (edgesAdded >= MAX_EDGES_PER_NODE) {
        break
      }
    }
  })

  buildConnectivity(mapGrid, nodes, edges, paths, adjacency, existingEdges)

  return { edges, paths, adjacency }
}

export function buildCheckpointNetwork(mapGrid, factories = []) {
  if (!mapGrid || mapGrid.length === 0 || mapGrid[0].length === 0) {
    return null
  }

  const nodes = []
  collectBaseNodes(mapGrid, factories).forEach(node => addNode(nodes, node.x, node.y, node.type, node.label))
  collectOreNodes(mapGrid).forEach(node => addNode(nodes, node.x, node.y, node.type, node.label))
  collectStreetIntersections(mapGrid).forEach(node => addNode(nodes, node.x, node.y, node.type, node.label))

  if (nodes.length < 2) {
    return { nodes, edges: [], paths: {}, adjacency: new Map(), routeCache: new Map() }
  }

  const { edges, paths, adjacency } = buildEdgeMap(mapGrid, nodes)
  return { nodes, edges, paths, adjacency, routeCache: new Map() }
}

function findClosestNode(point, nodes) {
  if (!nodes || nodes.length === 0) return null
  let closest = null
  let minDistance = Infinity
  nodes.forEach(node => {
    const distance = Math.hypot(point.x - node.x, point.y - node.y)
    if (distance < minDistance) {
      minDistance = distance
      closest = node
    }
  })
  return closest
}

function combineSegments(segments) {
  const combined = []
  segments.forEach((segment, segmentIndex) => {
    if (!segment || segment.length === 0) return
    segment.forEach((point, pointIndex) => {
      if (segmentIndex > 0 && pointIndex === 0) {
        if (combined.length > 0) {
          const last = combined[combined.length - 1]
          if (last.x === point.x && last.y === point.y) {
            return
          }
        }
      }
      if (combined.length > 0) {
        const last = combined[combined.length - 1]
        if (last.x === point.x && last.y === point.y) {
          return
        }
      }
      combined.push({ x: point.x, y: point.y })
    })
  })
  return combined
}

export function planPathWithCheckpoints(start, target, mapGrid, occupancyMap, network) {
  if (!network || !network.nodes || network.nodes.length < 2) return []
  if (!start || !target) return []

  const startNode = findClosestNode(start, network.nodes)
  const endNode = findClosestNode(target, network.nodes)

  if (!startNode || !endNode || startNode.id === endNode.id) {
    return []
  }

  const routeKey = `${startNode.id}-${endNode.id}`
  const routeCache = network.routeCache
  let route = null

  if (routeCache && typeof routeCache.get === 'function') {
    const cached = routeCache.get(routeKey)
    if (cached && cached.length > 0) {
      route = cached.map(segment => ({ ...segment }))
    }
  }

  if (!route) {
    const computedRoute = findNetworkRoute(network, startNode.id, endNode.id)
    if (!computedRoute || computedRoute.length === 0) {
      return []
    }
    route = computedRoute

    if (routeCache && typeof routeCache.set === 'function') {
      const storedRoute = computedRoute.map(segment => ({ ...segment }))
      routeCache.set(routeKey, storedRoute)
      const reverseRoute = storedRoute.slice().reverse().map(segment => ({
        from: segment.to,
        to: segment.from,
        edgeKey: `${segment.to}-${segment.from}`
      }))
      routeCache.set(`${endNode.id}-${startNode.id}`, reverseRoute)
    }
  }

  let startSegment = []
  if (start.x === startNode.x && start.y === startNode.y) {
    startSegment = [{ x: start.x, y: start.y }]
  } else {
    startSegment = findPath(start, { x: startNode.x, y: startNode.y }, mapGrid, null)
    if (!startSegment || startSegment.length === 0) {
      return []
    }
  }

  const segments = []
  route.forEach(segment => {
    const edgePath = network.paths[segment.edgeKey]
    if (edgePath && edgePath.length > 0) {
      segments.push(edgePath)
    }
  })

  if (segments.length === 0) {
    return []
  }

  const endSegment = findPath({ x: endNode.x, y: endNode.y }, target, mapGrid, occupancyMap)
  if (!endSegment || endSegment.length === 0) {
    return []
  }

  const combined = combineSegments([startSegment, ...segments, endSegment])
  return combined
}

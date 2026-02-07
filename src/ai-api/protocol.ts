export type ProtocolVersion = '1.0'

export type Verbosity = 'minimal' | 'normal' | 'full'

export type CoordinateSpace = 'tile' | 'world'

export interface Position {
  x: number
  y: number
  space: CoordinateSpace
}

export interface PowerSnapshot {
  supply: number
  production: number
  consumption: number
}

export interface ResourceSnapshot {
  money: number
  power: PowerSnapshot
}

export interface UnitSnapshot {
  id: string
  type: string
  owner: string
  health: number
  maxHealth: number
  position: Position
  tilePosition: Position
  status?: {
    ammo?: number
    fuel?: number
    crew?: Record<string, boolean>
    isAirUnit?: boolean
  }
  orders?: {
    moveTarget?: Position
    targetId?: string | null
  }
}

export interface BuildingSnapshot {
  id: string
  type: string
  owner: string
  health: number
  maxHealth: number
  tilePosition: Position
  size: { width: number; height: number }
  constructionFinished: boolean
  rallyPoint?: Position | null
}

export interface MapMeta {
  tilesX: number
  tilesY: number
  tileSize: number
  coordinateSystem: {
    tileOrigin: 'top-left'
    worldOrigin: 'top-left'
    worldUnits: 'pixels'
  }
  fogOfWarEnabled: boolean
  catalogVersion: string
}

export interface TransitionEventBase {
  id: string
  tick: number
  timeSeconds: number
}

export interface UnitCreatedEvent extends TransitionEventBase {
  type: 'unit_created'
  unitId: string
  unitType: string
  owner: string
  position: Position
}

export interface BuildingStartedEvent extends TransitionEventBase {
  type: 'building_started'
  buildingId: string
  buildingType: string
  owner: string
  tilePosition: Position
}

export interface BuildingCompletedEvent extends TransitionEventBase {
  type: 'building_completed'
  buildingId: string
  buildingType: string
  owner: string
  tilePosition: Position
}

export interface DamageEvent extends TransitionEventBase {
  type: 'damage'
  attackerId?: string
  targetId: string
  targetKind: 'unit' | 'building' | 'factory'
  amount: number
  weapon?: string
  position: Position
}

export interface DestroyedEvent extends TransitionEventBase {
  type: 'destroyed'
  killerId?: string
  victimId: string
  victimKind: 'unit' | 'building' | 'factory'
  cause?: string
  position: Position
}

export type TransitionEvent =
  | UnitCreatedEvent
  | BuildingStartedEvent
  | BuildingCompletedEvent
  | DamageEvent
  | DestroyedEvent

export interface TransitionSummary {
  totalDamage: number
  unitsDestroyed: number
  buildingsDestroyed: number
}

export interface TransitionLog {
  events: TransitionEvent[]
  summary: TransitionSummary
}

export interface BuildQueueSnapshot {
  unitItems: Array<{ type: string; rallyPoint?: Position | null }>
  buildingItems: Array<{ type: string; blueprint?: { type: string; x: number; y: number } | null }>
  currentUnit: { type: string; progress: number; duration: number; rallyPoint?: Position | null } | null
  currentBuilding: { type: string; progress: number; duration: number; blueprint?: { type: string; x: number; y: number } | null } | null
  pausedUnit: boolean
  pausedBuilding: boolean
}

export interface GameSnapshot {
  resources: ResourceSnapshot
  units: UnitSnapshot[]
  buildings: BuildingSnapshot[]
  buildQueues: BuildQueueSnapshot
  map?: {
    oreTiles?: Array<{ x: number; y: number }>
    obstacles?: Array<{ x: number; y: number; type: string }>
  }
}

export interface GameTickInput {
  protocolVersion: ProtocolVersion
  matchId: string
  playerId: string
  tick: number
  sinceTick: number
  verbosity: Verbosity
  meta: MapMeta
  snapshot: GameSnapshot
  transitions: TransitionLog
  constraints: {
    maxActionsPerTick: number
    allowQueuedCommands: boolean
    maxQueuedCommands: number
  }
}

export type ActionQueueMode = 'replace' | 'append'

export interface BuildPlaceAction {
  actionId: string
  type: 'build_place'
  buildingType: string
  tilePosition: Position
  rallyPoint?: Position | null
}

export interface BuildQueueAction {
  actionId: string
  type: 'build_queue'
  factoryId?: string | null
  unitType: string
  count: number
  priority?: 'low' | 'normal' | 'high'
  rallyPoint?: Position | null
}

export interface UnitCommandAction {
  actionId: string
  type: 'unit_command'
  unitIds: string[]
  command: 'move' | 'attack' | 'stop' | 'hold' | 'guard' | 'patrol'
  targetId?: string
  targetPos?: Position
  queueMode?: ActionQueueMode
}

export interface SetRallyAction {
  actionId: string
  type: 'set_rally'
  buildingId: string
  rallyPoint: Position
}

export interface CancelAction {
  actionId: string
  type: 'cancel'
  queueId?: string
}

export interface AbilityAction {
  actionId: string
  type: 'ability'
  unitId: string
  abilityId: string
  targetId?: string
  targetPos?: Position
}

export type GameAction =
  | BuildPlaceAction
  | BuildQueueAction
  | UnitCommandAction
  | SetRallyAction
  | CancelAction
  | AbilityAction

export interface GameTickOutput {
  protocolVersion: ProtocolVersion
  tick: number
  intent?: string
  confidence?: number
  actions: GameAction[]
  notes?: string
}

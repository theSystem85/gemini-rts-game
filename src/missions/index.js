import { mission01 } from './mission_01.js'

export const builtinMissions = [mission01]

export function getBuiltinMissionById(id) {
  return builtinMissions.find(mission => mission.id === id) || null
}

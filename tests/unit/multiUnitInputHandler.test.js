import { describe, it, expect, vi } from 'vitest'
import {
  filterEligibleUnits,
  applyCommandsToUnit,
  distributeCommandsToUnits
} from '../../src/input/multiUnitInputHandler.js'

describe('multiUnitInputHandler', () => {
  describe('filterEligibleUnits', () => {
    it('filters out dead units and buildings by default', () => {
      const aliveUnit = { id: 'u1', health: 100 }
      const deadUnit = { id: 'u2', health: 0 }
      const building = { id: 'b1', health: 100, isBuilding: true }

      const result = filterEligibleUnits([aliveUnit, deadUnit, building, null])

      expect(result).toEqual([aliveUnit])
    })

    it('allows buildings when configured', () => {
      const building = { id: 'b1', health: 100, isBuilding: true }
      const result = filterEligibleUnits([building], { allowBuildings: true })

      expect(result).toEqual([building])
    })

    it('returns an empty array for non-arrays', () => {
      expect(filterEligibleUnits(null)).toEqual([])
    })
  })

  describe('applyCommandsToUnit', () => {
    it('replaces the command queue and clears current command when not queueing', () => {
      const unit = {
        id: 'u1',
        commandQueue: [{ type: 'move', x: 1, y: 1 }],
        currentCommand: { type: 'move', x: 1, y: 1 }
      }
      const commands = [{ type: 'attack', targetId: 'enemy1' }]

      applyCommandsToUnit(unit, commands, { queue: false })

      expect(unit.commandQueue).toEqual(commands)
      expect(unit.currentCommand).toBeNull()
    })

    it('appends commands when queueing and preserves current command', () => {
      const unit = {
        id: 'u1',
        commandQueue: [{ type: 'move', x: 2, y: 2 }],
        currentCommand: { type: 'move', x: 2, y: 2 }
      }
      const commands = [{ type: 'attack', targetId: 'enemy2' }]

      applyCommandsToUnit(unit, commands, { queue: true })

      expect(unit.commandQueue).toEqual([
        { type: 'move', x: 2, y: 2 },
        { type: 'attack', targetId: 'enemy2' }
      ])
      expect(unit.currentCommand).toEqual({ type: 'move', x: 2, y: 2 })
    })
  })

  describe('distributeCommandsToUnits', () => {
    it('distributes commands in round-robin order and resets queues when not queueing', () => {
      const units = [
        { id: 'u1', health: 100, commandQueue: [{ type: 'move', x: 0, y: 0 }], currentCommand: { type: 'move', x: 0, y: 0 } },
        { id: 'u2', health: 100, commandQueue: [], currentCommand: { type: 'move', x: 1, y: 1 } }
      ]
      const targets = [{ x: 5 }, { x: 6 }, { x: 7 }]
      const createCommand = vi.fn((target) => ({ type: 'move', x: target.x }))

      const assignments = distributeCommandsToUnits(units, targets, createCommand, { queue: false })

      expect(createCommand).toHaveBeenCalledTimes(3)
      expect(units[0].commandQueue).toEqual([
        { type: 'move', x: 5 },
        { type: 'move', x: 7 }
      ])
      expect(units[1].commandQueue).toEqual([{ type: 'move', x: 6 }])
      expect(units[0].currentCommand).toBeNull()
      expect(units[1].currentCommand).toBeNull()
      expect(assignments).toEqual([
        { unit: units[0], commands: [{ type: 'move', x: 5 }, { type: 'move', x: 7 }] },
        { unit: units[1], commands: [{ type: 'move', x: 6 }] }
      ])
    })

    it('skips null commands and ignores ineligible units', () => {
      const aliveUnit = { id: 'u1', health: 100, commandQueue: [] }
      const deadUnit = { id: 'u2', health: 0, commandQueue: [{ type: 'move', x: 9 }] }
      const building = { id: 'b1', health: 100, isBuilding: true, commandQueue: [{ type: 'move', x: 8 }] }
      const secondUnit = { id: 'u3', health: 100, commandQueue: [] }
      const targets = [{ x: 1 }, { x: 2 }]

      const assignments = distributeCommandsToUnits(
        [aliveUnit, deadUnit, building, secondUnit],
        targets,
        (target, index) => (index === 1 ? null : { type: 'move', x: target.x }),
        { queue: false }
      )

      expect(aliveUnit.commandQueue).toEqual([{ type: 'move', x: 1 }])
      expect(secondUnit.commandQueue).toEqual([])
      expect(deadUnit.commandQueue).toEqual([{ type: 'move', x: 9 }])
      expect(building.commandQueue).toEqual([{ type: 'move', x: 8 }])
      expect(assignments).toEqual([
        { unit: aliveUnit, commands: [{ type: 'move', x: 1 }] },
        { unit: secondUnit, commands: [] }
      ])
    })

    it('appends commands when queueing', () => {
      const units = [
        { id: 'u1', health: 100, commandQueue: [{ type: 'move', x: 1 }] },
        { id: 'u2', health: 100, commandQueue: [{ type: 'move', x: 2 }] }
      ]
      const targets = [{ x: 3 }, { x: 4 }]

      distributeCommandsToUnits(units, targets, (target) => ({ type: 'move', x: target.x }), { queue: true })

      expect(units[0].commandQueue).toEqual([{ type: 'move', x: 1 }, { type: 'move', x: 3 }])
      expect(units[1].commandQueue).toEqual([{ type: 'move', x: 2 }, { type: 'move', x: 4 }])
    })
  })
})

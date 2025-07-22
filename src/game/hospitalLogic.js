import { TILE_SIZE } from '../config.js'
import { playSound } from '../sound.js'
import { logPerformance } from '../performanceUtils.js'
export const updateHospitalLogic = logPerformance(function(units, buildings, gameState, delta){
  const hospitals = buildings.filter(b=>b.type==='hospital')
  if(hospitals.length===0) return
  hospitals.forEach(hospital=>{
    const healRow = hospital.y + hospital.height
    units.forEach(unit=>{
      if(!unit.crew) return
      if(unit.tileY===healRow && unit.tileX>=hospital.x && unit.tileX<hospital.x+hospital.width){
        unit.healTimer = (unit.healTimer||0)+delta
        const missing = Object.entries(unit.crew).filter(([_,alive])=>!alive)
        while(missing.length>0 && unit.healTimer>=10000){
          const [role]=missing.shift()
          unit.crew[role]=true
          unit.healTimer-=10000
          if(gameState.money>=100){gameState.money-=100}
        }
      }
    })
  })
})

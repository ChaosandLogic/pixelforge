import type { PortType } from './types'

/** Trigger outputs may drive float trigger inputs (Ramp/Hold rising-edge ports). */
export function portsCompatible(sourceType: PortType, targetType: PortType): boolean {
  if (sourceType === targetType) return true
  if (sourceType === 'trigger' && targetType === 'float') return true
  return false
}

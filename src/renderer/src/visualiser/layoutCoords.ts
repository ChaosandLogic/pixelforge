import type { PatchPoint } from '@shared/patch/types'
import { Vector3 } from 'three'

/**
 * Map patch layout coordinates into Three.js space.
 * Layout previews treat +Y as downward on screen; Three.js uses Y-up.
 */
export function patchPointToThree(p: PatchPoint, out = new Vector3()): Vector3 {
  return out.set(p.x, -p.y, p.z)
}

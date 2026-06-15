import { Box3, Mesh, MeshStandardMaterial, Vector3 } from 'three'
import { STLLoader } from 'three/addons/loaders/STLLoader.js'

const _box = new Box3()
const _center = new Vector3()

export function loadStlMesh(data: ArrayBuffer): Mesh {
  const geometry = new STLLoader().parse(data)
  geometry.computeVertexNormals()
  geometry.computeBoundingBox()

  const material = new MeshStandardMaterial({
    color: 0x6b7f96,
    metalness: 0.15,
    roughness: 0.65,
    transparent: true,
    opacity: 0.32,
    depthWrite: false
  })

  const mesh = new Mesh(geometry, material)
  mesh.name = 'reference-stl'
  return mesh
}

/** Centre an STL mesh on the origin (pixels and model share world space). */
export function centerMesh(mesh: Mesh): Box3 {
  const box = geometryBox(mesh)
  box.getCenter(_center)
  mesh.position.sub(_center)
  mesh.updateMatrixWorld(true)
  return geometryBox(mesh)
}

function geometryBox(mesh: Mesh): Box3 {
  mesh.geometry.computeBoundingBox()
  _box.copy(mesh.geometry.boundingBox ?? new Box3())
  _box.translate(mesh.position)
  return _box.clone()
}

export function disposeStlMesh(mesh: Mesh | null): void {
  if (mesh === null) return
  mesh.geometry.dispose()
  ;(mesh.material as MeshStandardMaterial).dispose()
}

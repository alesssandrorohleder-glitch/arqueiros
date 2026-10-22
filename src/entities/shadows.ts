// Sombras só das partes que importam: peças pequenas (olhos, botões, penas,
// enfeites) não fazem sombra. Cada peça com sombra é desenhada de novo no mapa
// de sombras, então isso corta muitas chamadas de desenho por quadro.
import * as THREE from 'three';

/** Raio mínimo (m, já com a escala) para uma peça fazer sombra. */
const MIN_SHADOW_RADIUS = 0.16;

const tmpScale = new THREE.Vector3();

export function trimShadows(root: THREE.Object3D, minRadius = MIN_SHADOW_RADIUS): void {
  root.updateMatrixWorld(true);
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    // Malhas com esqueleto (corpo dos modelos) sempre fazem sombra.
    if ((mesh as THREE.SkinnedMesh).isSkinnedMesh) {
      mesh.castShadow = true;
      return;
    }
    const geo = mesh.geometry;
    if (!geo.boundingSphere) geo.computeBoundingSphere();
    mesh.getWorldScale(tmpScale);
    const r = (geo.boundingSphere?.radius ?? 0) * Math.max(tmpScale.x, tmpScale.y, tmpScale.z);
    mesh.castShadow = r >= minRadius;
  });
}

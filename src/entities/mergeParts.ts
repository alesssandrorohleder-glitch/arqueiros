// Junta as peças geométricas fixas de um personagem (cabeça, equipamentos, enfeites
// da skin) em poucas malhas, uma por material: dezenas de chamadas de desenho viram
// meia dúzia. Partes que se mexem sozinhas (cauda, asas, orbes) ficam de fora.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/**
 * Junta as malhas abaixo de `socket` (exceto as que estão dentro de `keep`) por
 * material e assinatura de atributos, no espaço do próprio `socket`.
 */
export function mergeStaticParts(socket: THREE.Object3D, keep: Set<THREE.Object3D>): void {
  socket.updateMatrixWorld(true);
  const inv = socket.matrixWorld.clone().invert();
  const groups = new Map<string, { material: THREE.Material; geos: THREE.BufferGeometry[]; boxes: THREE.Box3[]; shadow: boolean; order: number }>();
  const remove: THREE.Mesh[] = [];
  const visit = (o: THREE.Object3D) => {
    if (keep.has(o) || o.userData.animated) return;
    const mesh = o as THREE.Mesh;
    if (mesh.isMesh && !(mesh as THREE.SkinnedMesh).isSkinnedMesh && !Array.isArray(mesh.material) && mesh.visible) {
      const g = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry.clone();
      g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, mesh.matrixWorld));
      for (const name of Object.keys(g.attributes)) if (!['position', 'normal', 'uv', 'color'].includes(name)) g.deleteAttribute(name);
      g.morphAttributes = {};
      const key = `${mesh.material.uuid}|${Object.keys(g.attributes).sort().join(',')}|${mesh.renderOrder}`;
      let entry = groups.get(key);
      if (!entry) groups.set(key, (entry = { material: mesh.material, geos: [], boxes: [], shadow: false, order: mesh.renderOrder }));
      entry.geos.push(g);
      g.computeBoundingBox();
      entry.boxes.push(g.boundingBox!.clone());
      entry.shadow ||= mesh.castShadow;
      remove.push(mesh);
    }
    for (const child of [...o.children]) visit(child);
  };
  for (const child of [...socket.children]) visit(child);
  if (remove.length < 2) return;

  for (const mesh of remove) {
    mesh.removeFromParent();
    mesh.geometry.dispose();
  }
  // Grupos que ficaram vazios (olhos, ombreiras...) saem também.
  const prune = (o: THREE.Object3D) => {
    for (const child of [...o.children]) {
      if (keep.has(child) || child.userData.animated) continue;
      prune(child);
      if (child.type === 'Group' && child.children.length === 0) child.removeFromParent();
    }
  };
  prune(socket);

  for (const { material, geos, boxes, shadow, order } of groups.values()) {
    const merged = geos.length === 1 ? geos[0] : mergeGeometries(geos, false);
    if (!merged) continue;
    const m = new THREE.Mesh(merged, material);
    m.castShadow = shadow;
    m.receiveShadow = true;
    m.renderOrder = order;
    m.name = 'merged-parts';
    // Caixas das peças originais: a capa (ModelRig) mede peça por peça, não o conjunto.
    m.userData.partBoxes = boxes;
    socket.add(m);
  }
}

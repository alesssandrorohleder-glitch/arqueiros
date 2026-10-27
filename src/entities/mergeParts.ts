// Junta as peças geométricas fixas de um personagem (cabeça, equipamentos, enfeites
// da skin) em poucas malhas, uma por material: dezenas de chamadas de desenho viram
// meia dúzia. Partes que se mexem sozinhas (cauda, asas, orbes) ficam de fora.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/**
 * "Assinatura" de um material: dois materiais com a mesma assinatura desenham igual
 * (cada peça cria o seu, então sem isto quase nada se juntava). `pulse`: materiais
 * que piscam (luzes) só se juntam entre si.
 */
function materialSignature(m: THREE.Material, pulse: Set<THREE.Material>): string {
  const s = m as THREE.MeshStandardMaterial;
  if (!s.isMeshStandardMaterial) return m.uuid;
  const tex = (t: THREE.Texture | null) => (t ? t.uuid : '-');
  const prem = s.userData.premiumUniforms as Record<string, { value: unknown }> | undefined;
  return [
    s.type, s.color.getHexString(), s.emissive.getHexString(), s.emissiveIntensity.toFixed(3), s.roughness.toFixed(3), s.metalness.toFixed(3),
    tex(s.map), tex(s.bumpMap), s.bumpScale, s.vertexColors, s.transparent, s.opacity.toFixed(3), s.depthWrite, s.side, s.flatShading,
    s.customProgramCacheKey(), s.userData.premium ? 1 : 0, s.userData.premiumDetail ?? '',
    prem ? Object.values(prem).map((u) => (u.value instanceof THREE.Color ? u.value.getHexString() : String(u.value))).join('/') : '',
    pulse.has(m) ? 'pulse' : '',
  ].join('|');
}

/**
 * Material liso sem textura, sem transparência e sem brilho próprio: a cor dele pode ir
 * para os vértices, e peças de cores diferentes passam a ser uma malha só.
 */
function bakeable(m: THREE.Material, pulse: Set<THREE.Material>): m is THREE.MeshStandardMaterial {
  const s = m as THREE.MeshStandardMaterial;
  return !!s.isMeshStandardMaterial && !s.map && !s.bumpMap && !s.normalMap && !s.transparent && !pulse.has(m) && (s.emissiveIntensity === 0 || s.emissive.getHex() === 0);
}

/** Assinatura de um material "assável": acabamento parecido (aspereza/metal em faixas), sem a cor. */
function bakeSignature(s: THREE.MeshStandardMaterial): string {
  const prem = s.userData.premiumUniforms as Record<string, { value: unknown }> | undefined;
  return [
    'bake', Math.round(s.roughness * 5), Math.round(s.metalness * 4), s.side, s.flatShading, s.customProgramCacheKey(), s.userData.premiumDetail ?? '',
    prem ? Object.entries(prem).filter(([k]) => k !== 'uRimColor').map(([, u]) => String(u.value)).join('/') : '',
  ].join('|');
}

/**
 * Junta as malhas abaixo de `socket` (exceto as que estão dentro de `keep`) por
 * material e assinatura de atributos, no espaço do próprio `socket`.
 */
export function mergeStaticParts(socket: THREE.Object3D, keep: Set<THREE.Object3D>, pulse: Set<THREE.Material> = new Set(), allowBake = true): THREE.Material[] {
  socket.updateMatrixWorld(true);
  const inv = socket.matrixWorld.clone().invert();
  const groups = new Map<string, { material: THREE.Material; geos: THREE.BufferGeometry[]; boxes: THREE.Box3[]; shadow: boolean; order: number; bake: boolean }>();
  const created: THREE.Material[] = [];
  const remove: THREE.Mesh[] = [];
  const visit = (o: THREE.Object3D) => {
    if (keep.has(o) || o.userData.animated) return;
    const mesh = o as THREE.Mesh;
    if (mesh.isMesh && !(mesh as THREE.SkinnedMesh).isSkinnedMesh && !Array.isArray(mesh.material) && mesh.visible) {
      const g = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry.clone();
      g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, mesh.matrixWorld));
      for (const name of Object.keys(g.attributes)) if (!['position', 'normal', 'uv', 'color'].includes(name)) g.deleteAttribute(name);
      g.morphAttributes = {};
      const bake = allowBake && bakeable(mesh.material, pulse);
      if (bake) {
        // Cor do material nos vértices (multiplica a cor que já houver).
        const col = (mesh.material as THREE.MeshStandardMaterial).color;
        const n = g.getAttribute('position').count;
        const had = (mesh.material as THREE.MeshStandardMaterial).vertexColors ? g.getAttribute('color') : null;
        const arr = new Float32Array(n * 3);
        for (let i = 0; i < n; i++) {
          arr[i * 3] = col.r * (had ? had.getX(i) : 1);
          arr[i * 3 + 1] = col.g * (had ? had.getY(i) : 1);
          arr[i * 3 + 2] = col.b * (had ? had.getZ(i) : 1);
        }
        g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
        if (g.getAttribute('uv')) g.deleteAttribute('uv');
      }
      const sig = bake ? bakeSignature(mesh.material as THREE.MeshStandardMaterial) : materialSignature(mesh.material, pulse);
      const key = `${sig}|${Object.keys(g.attributes).sort().join(',')}|${mesh.renderOrder}`;
      let entry = groups.get(key);
      if (!entry) groups.set(key, (entry = { material: mesh.material, geos: [], boxes: [], shadow: false, order: mesh.renderOrder, bake }));
      entry.geos.push(g);
      g.computeBoundingBox();
      entry.boxes.push(g.boundingBox!.clone());
      entry.shadow ||= mesh.castShadow;
      remove.push(mesh);
    }
    for (const child of [...o.children]) visit(child);
  };
  for (const child of [...socket.children]) visit(child);
  if (remove.length < 2) return created;

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

  for (const { material, geos, boxes, shadow, order, bake } of groups.values()) {
    const merged = geos.length === 1 ? geos[0] : mergeGeometries(geos, false);
    if (!merged) continue;
    let mat = material;
    if (bake) {
      // Material branco com cor por vértice (mantém o shader premium e o mesmo programa).
      const src = material as THREE.MeshStandardMaterial;
      const baked = src.clone();
      baked.color.set(0xffffff);
      baked.vertexColors = true;
      baked.onBeforeCompile = src.onBeforeCompile;
      baked.customProgramCacheKey = src.customProgramCacheKey;
      baked.userData = { ...src.userData };
      created.push(baked);
      mat = baked;
    }
    const m = new THREE.Mesh(merged, mat);
    m.castShadow = shadow;
    m.receiveShadow = true;
    m.renderOrder = order;
    m.name = 'merged-parts';
    // Caixas das peças originais: a capa (ModelRig) mede peça por peça, não o conjunto.
    m.userData.partBoxes = boxes;
    socket.add(m);
  }
  return created;
}

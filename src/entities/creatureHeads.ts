// Cabeças esculpidas dos personagens-criatura (lagarto, homem-tubarão e urso
// esqueleto). Cada uma parte de uma esfera bem dividida que é "esculpida"
// (focinho puxado para a frente, base achatada...) e pintada por vértice
// (barriga clara, sombras nas reentrâncias), com detalhes por cima.
//
// Espaço da cabeça: origem no pescoço, +Y para cima, -Z para a frente.
import * as THREE from 'three';
import type { PartsContext } from './characterParts';

type Sculpt = (v: THREE.Vector3) => void;

const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** Esfera unitária esculpida por `fn`, depois escalada por `r` e movida para `center`. */
function sculpted(
  fn: Sculpt,
  r: number,
  center: THREE.Vector3,
  segs = 48,
  /** Cor de cada vértice pela direção ORIGINAL na esfera (não deforma junto com a escultura). */
  color?: (u: THREE.Vector3, out: THREE.Color) => void,
): { geo: THREE.BufferGeometry; at: (x: number, y: number, z: number, out?: number) => THREE.Vector3 } {
  const geo = new THREE.SphereGeometry(1, segs, Math.round(segs * 0.75));
  const pos = geo.getAttribute('position');
  const v = new THREE.Vector3();
  const u = new THREE.Vector3();
  const col = new THREE.Color();
  const colors = color ? new Float32Array(pos.count * 3) : null;
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    if (color && colors) {
      u.copy(v);
      color(u, col);
      colors.set([col.r, col.g, col.b], i * 3);
    }
    fn(v);
    pos.setXYZ(i, v.x * r + center.x, v.y * r + center.y, v.z * r + center.z);
  }
  if (colors) geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  /** Ponto da superfície na direção (x, y, z) da esfera original, `out` m para fora. */
  const at = (x: number, y: number, z: number, out = 0) => {
    const p = new THREE.Vector3(x, y, z).normalize();
    const dir = p.clone();
    fn(p);
    return p.multiplyScalar(r).add(center).addScaledVector(dir, out);
  };
  return { geo, at };
}

/** Pinta cada vértice com `color(posição local, normal)`. */
function paintVertices(geo: THREE.BufferGeometry, color: (p: THREE.Vector3, n: THREE.Vector3, out: THREE.Color) => void): void {
  const pos = geo.getAttribute('position');
  const nrm = geo.getAttribute('normal');
  const colors = new Float32Array(pos.count * 3);
  const p = new THREE.Vector3();
  const n = new THREE.Vector3();
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    p.fromBufferAttribute(pos, i);
    n.fromBufferAttribute(nrm, i);
    color(p, n, c);
    colors.set([c.r, c.g, c.b], i * 3);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
}

/** Ruído barato e estável (manchas, rachaduras). */
function noise(x: number, y: number, z: number): number {
  return Math.sin(x * 37.1 + y * 11.7) * Math.sin(y * 29.3 - z * 17.9) * Math.sin(z * 23.7 + x * 13.1);
}

/** Textura de escamas (pequenos círculos sobrepostos) para o lagarto. */
let scaleTex: THREE.CanvasTexture | null = null;
function scaleTexture(): THREE.CanvasTexture {
  if (scaleTex) return scaleTex;
  const size = 128;
  const cv = document.createElement('canvas');
  cv.width = cv.height = size;
  const g = cv.getContext('2d')!;
  g.fillStyle = '#ffffff';
  g.fillRect(0, 0, size, size);
  const step = 12;
  for (let row = 0; row < size / step + 1; row++) {
    for (let col = 0; col < size / step + 1; col++) {
      const x = col * step + (row % 2 ? step / 2 : 0);
      const y = row * step * 0.85;
      const grad = g.createRadialGradient(x - 2, y - 2, 1, x, y, step * 0.62);
      grad.addColorStop(0, '#ffffff');
      grad.addColorStop(0.75, '#e2e2e2');
      grad.addColorStop(1, '#9a9a9a');
      g.fillStyle = grad;
      g.beginPath();
      g.arc(x, y, step * 0.6, 0, Math.PI * 2);
      g.fill();
    }
  }
  scaleTex = new THREE.CanvasTexture(cv);
  scaleTex.wrapS = scaleTex.wrapT = THREE.RepeatWrapping;
  scaleTex.repeat.set(6, 3);
  scaleTex.colorSpace = THREE.SRGBColorSpace;
  return scaleTex;
}

function mesh(geo: THREE.BufferGeometry, m: THREE.Material, parent: THREE.Object3D, at?: THREE.Vector3): THREE.Mesh {
  const me = new THREE.Mesh(geo, m);
  if (at) me.position.copy(at);
  me.castShadow = true;
  parent.add(me);
  return me;
}

/** Tubo fino passando pelos pontos (linhas de boca, guelras, rachaduras). */
function line(points: THREE.Vector3[], radius: number, m: THREE.Material, parent: THREE.Object3D): THREE.Mesh {
  const curve = new THREE.CatmullRomCurve3(points);
  return mesh(new THREE.TubeGeometry(curve, points.length * 6, radius, 6, false), m, parent);
}

/** Olho com pálpebra, íris e pupila, olhando para `dir`. */
function eye(c: PartsContext, at: THREE.Vector3, dir: THREE.Vector3, size: number, lid: THREE.Material, iris: number, slit: boolean): void {
  const g = new THREE.Group();
  g.position.copy(at);
  g.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, -1), dir.clone().normalize());
  c.head.add(g);
  mesh(new THREE.SphereGeometry(size * 1.25, 16, 12), lid, g);
  mesh(new THREE.SphereGeometry(size, 16, 12), c.mat(iris, { roughness: 0.15, emissive: iris, emissiveIntensity: 0.25 }), g, new THREE.Vector3(0, 0, -size * 0.45));
  const pupil = mesh(new THREE.SphereGeometry(size * 0.5, 12, 10), c.mat(0x050505, { roughness: 0.05 }), g, new THREE.Vector3(0, 0, -size * 0.92));
  pupil.scale.set(slit ? 0.35 : 1, slit ? 1.5 : 1, 0.4);
  mesh(new THREE.SphereGeometry(size * 0.18, 8, 6), c.mat(0xffffff, { emissive: 0xffffff, emissiveIntensity: 0.6 }), g, new THREE.Vector3(size * 0.3, size * 0.35, -size * 1.0));
}

// ------------------------------------------------------------------ lagarto

export function lizardHead(c: PartsContext): void {
  const skinColor = new THREE.Color(c.palette.skin);
  const belly = skinColor.clone().lerp(new THREE.Color(0xf2e7a0), 0.65);
  const dark = skinColor.clone().multiplyScalar(0.55);
  const center = new THREE.Vector3(0, 0.2, 0.03);
  const R = 0.19;
  // Focinho longo e achatado, bochechas largas, base reta.
  const { geo, at } = sculpted((v) => {
    const front = smooth(-0.1, 1, -v.z);
    v.z -= front * front * 0.95;
    v.y = v.y * (1 - 0.38 * front) - 0.1 * front;
    v.x *= 1 - 0.3 * front + 0.08 * (1 - front);
    if (v.y < -0.45) v.y = -0.45 + (v.y + 0.45) * 0.35;
  }, R, center);
  paintVertices(geo, (p, _n, out) => {
    const ly = (p.y - center.y) / R;
    // Barriga/maxilar claros abaixo da linha da boca; manchas escuras no alto.
    const k = smooth(-0.12, -0.28, ly);
    out.copy(skinColor).lerp(belly, k);
    const spot = noise(p.x * 3, p.y * 3, p.z * 3);
    if (ly > 0 && spot > 0.35) out.lerp(dark, 0.55);
  });
  mesh(geo, c.mat(0xffffff, { vertexColors: true, map: scaleTexture(), roughness: 0.55 }), c.head);
  // Pescoço.
  mesh(new THREE.CylinderGeometry(0.1, 0.12, 0.08, 16), c.mat(c.palette.skin, { map: scaleTexture(), roughness: 0.6 }), c.head, new THREE.Vector3(0, 0.03, 0.04));

  // Sorriso: linha escura em volta do focinho.
  const mouth: THREE.Vector3[] = [];
  for (let i = 0; i <= 14; i++) {
    const a = -1.45 + (i / 14) * 2.9;
    mouth.push(at(Math.sin(a), -0.24, -Math.cos(a), 0.003));
  }
  line(mouth, 0.006, c.mat(0x2a1a14, { roughness: 0.9 }), c.head);
  // Narinas.
  for (const s of [-1, 1]) mesh(new THREE.SphereGeometry(0.011, 8, 6), c.mat(0x1a120c), c.head, at(s * 0.18, 0.05, -1, -0.002));
  // Olhos de camaleão saltados (turrets) com pupila em fenda.
  const lid = c.mat(c.palette.skin, { map: scaleTexture(), roughness: 0.5 });
  for (const s of [-1, 1]) {
    const p = at(s * 0.62, 0.55, -0.42, 0.012);
    eye(c, p, new THREE.Vector3(s * 0.75, 0.25, -0.75), 0.042, lid, c.palette.eyes, true);
  }
  // Crista de babados do alto da cabeça até a nuca.
  const frill = c.mat(c.palette.accent, { roughness: 0.45, side: THREE.DoubleSide });
  for (let i = 0; i < 6; i++) {
    const t = 0.25 + i * 0.32;
    const p = at(0, Math.cos(t), Math.sin(t), -0.01);
    const h = 0.11 - i * 0.012;
    const f = mesh(new THREE.ConeGeometry(0.045, h, 4).scale(0.25, 1, 1).translate(0, h / 2, 0), frill, c.head, p);
    f.rotation.x = t * 0.85;
  }
}

// ------------------------------------------------------------------ tubarão

export function sharkHead(c: PartsContext): void {
  const top = new THREE.Color(c.palette.skin);
  const white = new THREE.Color(c.palette.accent);
  const center = new THREE.Vector3(0, 0.21, 0.05);
  const R = 0.19;
  // Cabeça hidrodinâmica: focinho comprido e pontudo, um pouco erguido; base achatada.
  const sculpt: Sculpt = (v) => {
    const front = smooth(-0.2, 1, -v.z);
    v.z -= front * front * 1.15;
    v.y = v.y * (1 - 0.32 * front) + 0.06 * front;
    v.x *= 1 - 0.5 * front * front;
    if (v.y < -0.5) v.y = -0.5 + (v.y + 0.5) * 0.4;
  };
  const { geo, at } = sculpted(sculpt, R, center);
  // Contra-sombreamento: azul em cima, branco embaixo, com borda ondulada.
  paintVertices(geo, (p, _n, out) => {
    const ly = (p.y - center.y) / R;
    const edge = -0.08 + 0.07 * Math.sin(p.z * 40);
    out.copy(top).lerp(white, smooth(edge + 0.06, edge - 0.06, ly));
    out.multiplyScalar(0.92 + 0.08 * noise(p.x * 4, p.y * 4, p.z * 4));
  });
  mesh(geo, c.mat(0xffffff, { vertexColors: true, roughness: 0.35, metalness: 0.05 }), c.head);
  mesh(new THREE.CylinderGeometry(0.11, 0.13, 0.08, 16), c.mat(c.palette.skin, { roughness: 0.4 }), c.head, new THREE.Vector3(0, 0.03, 0.06));

  // Boca em meia-lua embaixo do focinho, com duas fileiras de dentes.
  const gum = c.mat(0x5a1820, { roughness: 0.7 });
  const toothMat = c.mat(0xfbf8ef, { roughness: 0.3 });
  const arc = (yUnit: number, out: number) => {
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i <= 12; i++) {
      const a = -1.05 + (i / 12) * 2.1;
      pts.push(at(Math.sin(a), yUnit, -Math.cos(a), out));
    }
    return pts;
  };
  const upper = arc(-0.33, 0.0);
  const lower = arc(-0.47, 0.0);
  // Interior escuro da boca: faixa entre as duas linhas.
  const inner = new THREE.BufferGeometry();
  const verts: number[] = [];
  for (let i = 0; i < upper.length - 1; i++) {
    const [a, b, d, e] = [upper[i], upper[i + 1], lower[i], lower[i + 1]];
    verts.push(a.x, a.y, a.z, d.x, d.y, d.z, b.x, b.y, b.z, b.x, b.y, b.z, d.x, d.y, d.z, e.x, e.y, e.z);
  }
  inner.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  inner.computeVertexNormals();
  mesh(inner, c.mat(0x2a0a10, { side: THREE.DoubleSide, roughness: 1 }), c.head);
  line(upper, 0.008, gum, c.head);
  line(lower, 0.008, gum, c.head);
  for (let i = 1; i < upper.length - 1; i++) {
    const up = mesh(new THREE.ConeGeometry(0.009, 0.032, 4).rotateX(Math.PI), toothMat, c.head, upper[i].clone().add(new THREE.Vector3(0, -0.014, 0)));
    up.rotation.y = i * 0.7;
    const lo = mesh(new THREE.ConeGeometry(0.008, 0.026, 4), toothMat, c.head, lower[i].clone().add(new THREE.Vector3(0, 0.012, 0)));
    lo.rotation.y = i * 0.5;
  }
  // Olhos pretos brilhantes nas laterais.
  for (const s of [-1, 1]) {
    const p = at(s * 0.7, 0.12, -0.55, -0.004);
    mesh(new THREE.SphereGeometry(0.026, 14, 10), c.mat(0x020304, { roughness: 0.02, metalness: 0.3 }), c.head, p);
    mesh(new THREE.SphereGeometry(0.007, 8, 6), c.mat(0xffffff, { emissive: 0xffffff, emissiveIntensity: 0.8 }), c.head, p.clone().add(new THREE.Vector3(s * 0.012, 0.012, -0.016)));
    // Narina.
    mesh(new THREE.SphereGeometry(0.008, 8, 6), c.mat(0x0c1418), c.head, at(s * 0.35, -0.12, -1, -0.002));
    // Guelras: três fendas curvas atrás da boca.
    const gillMat = c.mat(0x24384a, { roughness: 0.6 });
    for (let k = 0; k < 3; k++) {
      const z = 0.05 + k * 0.17;
      line([at(s, -0.32, z, 0.002), at(s, -0.08, z + 0.03, 0.004), at(s * 0.95, 0.16, z + 0.01, 0.002)], 0.005, gillMat, c.head);
    }
  }
  // Barbatana dorsal recortada no alto da cabeça (perfil curvo, varrida para trás).
  const fin = new THREE.Shape();
  fin.moveTo(0, 0);
  fin.quadraticCurveTo(0.03, 0.17, 0.17, 0.27);
  fin.quadraticCurveTo(0.12, 0.12, 0.2, 0.0);
  fin.lineTo(0, 0);
  const finGeo = new THREE.ExtrudeGeometry(fin, { depth: 0.018, bevelEnabled: true, bevelThickness: 0.008, bevelSize: 0.006, bevelSegments: 2, curveSegments: 10 });
  finGeo.translate(-0.06, 0, -0.009).rotateY(-Math.PI / 2);
  mesh(finGeo, c.mat(c.palette.skin, { roughness: 0.4 }), c.head, at(0, 1, 0.15, -0.03));
}

// ------------------------------------------------------------------ urso esqueleto

export function bearSkullHead(c: PartsContext): void {
  const bone = new THREE.Color(c.palette.skin);
  const shade = new THREE.Color(0x7a6a52);
  const deep = new THREE.Color(0x2a2018);
  const center = new THREE.Vector3(0, 0.21, 0.04);
  const R = 0.19;
  const sockets = [new THREE.Vector3(-0.45, 0.2, -0.87), new THREE.Vector3(0.45, 0.2, -0.87)].map((v) => v.normalize());
  // Crânio de urso: largo e baixo, sobrancelha óssea, maçãs do rosto e focinho curto e largo.
  const sculpt: Sculpt = (v) => {
    const u = v.clone();
    const front = smooth(0.05, 1, -u.z);
    v.y *= 0.95;
    v.x *= 1.04;
    v.z -= Math.pow(front, 1.8) * 0.5;
    v.y = v.y * (1 - 0.3 * front) - 0.1 * front;
    v.x *= 1 - 0.28 * front;
    // Sobrancelha: saliência acima das órbitas.
    v.z -= smooth(0.2, 0.42, u.y) * smooth(0.62, 0.42, u.y) * smooth(0.3, 0.75, -u.z) * 0.1;
    // Maçãs do rosto (arcos zigomáticos) dos lados, na altura dos olhos.
    v.x *= 1 + smooth(0.45, 0.85, Math.abs(u.x)) * smooth(-0.3, -0.05, u.y) * smooth(0.25, 0.0, u.y) * 0.07;
    // Órbitas fundas.
    for (const s of sockets) v.addScaledVector(s, -0.2 * smooth(0.86, 0.975, u.dot(s)));
    if (v.y < -0.36) v.y = -0.36 + (v.y + 0.36) * 0.25;
  };
  // Osso com sombra só onde afunda (órbitas, base) e algumas rachaduras finas.
  const paint = (u: THREE.Vector3, out: THREE.Color) => {
    out.copy(bone);
    let socket = 0;
    for (const s of sockets) socket = Math.max(socket, smooth(0.86, 0.96, u.dot(s)));
    out.lerp(deep, socket * 0.9);
    out.lerp(shade, smooth(-0.15, -0.5, u.y) * 0.55);
    // Rachadura: faixa fina e sinuosa no alto do crânio.
    const crack = Math.abs(u.x - 0.25 - 0.08 * Math.sin(u.z * 14));
    if (u.y > 0.3 && u.z > -0.6 && crack < 0.018) out.lerp(deep, 0.7);
    out.multiplyScalar(0.94 + 0.06 * noise(u.x * 3, u.y * 3, u.z * 3));
  };
  const { geo, at } = sculpted(sculpt, R, center, 56, paint);
  mesh(geo, c.mat(0xffffff, { vertexColors: true, roughness: 0.8 }), c.head);
  // Vértebras do pescoço.
  const boneMat = c.mat(c.palette.skin, { roughness: 0.8 });
  for (let i = 0; i < 2; i++) mesh(new THREE.CylinderGeometry(0.05, 0.055, 0.035, 12), boneMat, c.head, new THREE.Vector3(0, 0.0 + i * 0.04, 0.06));

  // Brasas no fundo das órbitas, com um brilho discreto.
  const ember = c.mat(c.palette.eyes, { emissive: c.palette.eyes, emissiveIntensity: 3.2 });
  const glow = new THREE.MeshBasicMaterial({ color: c.palette.eyes, transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false });
  for (const s of sockets) {
    const p = at(s.x, s.y, s.z, 0.004);
    mesh(new THREE.SphereGeometry(0.016, 12, 10), ember, c.head, p);
    const halo = new THREE.Mesh(new THREE.SphereGeometry(0.03, 12, 10), glow);
    halo.position.copy(p);
    c.head.add(halo);
  }
  // Cavidade nasal (coração invertido) na ponta do focinho.
  const nose = mesh(new THREE.ConeGeometry(0.028, 0.045, 3).rotateZ(Math.PI).scale(1.1, 1, 0.5), c.mat(0x1a120c, { roughness: 1 }), c.head, at(0, 0.0, -1, -0.006));
  nose.rotation.x = -0.3;
  // Dentes de cima na borda do focinho, com caninos grandes nas pontas.
  const toothMat = c.mat(0xf3eedb, { roughness: 0.5 });
  const upperRow: THREE.Vector3[] = [];
  for (let i = 0; i <= 6; i++) {
    const a = -0.7 + (i / 6) * 1.4;
    upperRow.push(at(Math.sin(a), -0.5, -Math.cos(a), -0.006));
  }
  upperRow.forEach((p, i) => {
    const big = i === 0 || i === upperRow.length - 1;
    mesh(new THREE.ConeGeometry(big ? 0.015 : 0.008, big ? 0.06 : 0.025, 5).rotateX(Math.PI), toothMat, c.head, p.clone().add(new THREE.Vector3(0, big ? -0.026 : -0.01, 0)));
  });
  // Mandíbula separada, aberta, logo abaixo do focinho (tigela com dentes virados para cima).
  const jawBase = at(0, -0.5, 0.15, 0);
  const jaw = new THREE.Group();
  jaw.position.set(0, jawBase.y - 0.035, jawBase.z);
  jaw.rotation.x = 0.22;
  c.head.add(jaw);
  const jawGeo = new THREE.SphereGeometry(1, 28, 12, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2);
  jawGeo.scale(0.13, 0.055, 0.21).translate(0, 0.012, -0.13);
  mesh(jawGeo, boneMat, jaw);
  for (let i = 0; i <= 5; i++) {
    const a = -0.85 + (i / 5) * 1.7;
    const big = i === 0 || i === 5;
    mesh(new THREE.ConeGeometry(big ? 0.013 : 0.007, big ? 0.05 : 0.022, 5), toothMat, jaw, new THREE.Vector3(Math.sin(a) * 0.11, 0.012 + (big ? 0.022 : 0.009), -0.13 - Math.cos(a) * 0.19));
  }
  // Orelhas redondas de urso (ossinhos) no alto.
  for (const s of [-1, 1]) {
    const p = at(s * 0.6, 0.75, 0.15, -0.025);
    const ear = mesh(new THREE.SphereGeometry(0.06, 16, 12), boneMat, c.head, p);
    ear.scale.set(1, 1, 0.42);
    ear.rotation.y = s * 0.3;
    const innerEar = mesh(new THREE.SphereGeometry(0.034, 12, 10), c.mat(0x3a2e24, { roughness: 1 }), c.head, p.clone().add(new THREE.Vector3(0, 0, -0.022)));
    innerEar.scale.set(1, 1, 0.4);
  }
}

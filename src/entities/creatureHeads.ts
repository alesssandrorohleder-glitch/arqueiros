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

// ------------------------------------------------------------------ Áurion (pássaro-alien dourado)

export function goldbirdHead(c: PartsContext): void {
  const gold = new THREE.Color(c.palette.skin);
  const rose = new THREE.Color(0xd8642a);
  const pale = new THREE.Color(0xfff2b8);
  const glowColor = c.palette.eyes;
  const center = new THREE.Vector3(0, 0.22, 0.02);
  const R = 0.18;
  // Crânio alto e liso de alienígena: testa grande, rosto afinando para o bico, nuca arredondada.
  const sculpt: Sculpt = (v) => {
    const u = v.clone();
    v.y *= 1.12;
    v.y += smooth(0.2, 1, u.y) * 0.12 * smooth(-0.2, 0.6, u.z + 0.3); // cúpula da cabeça
    const face = smooth(0.1, 1, -u.z) * smooth(0.4, -0.6, u.y);
    v.x *= 1 - 0.35 * face; // rosto em "coração" afinando para baixo
    v.z -= smooth(0.3, 1, -u.z) * 0.08;
    if (v.y < -0.55) v.y = -0.55 + (v.y + 0.55) * 0.4;
  };
  // Dourado com reflexo: claro no alto, puxando para laranja-rosado embaixo.
  const paint = (u: THREE.Vector3, out: THREE.Color) => {
    out.copy(gold).lerp(pale, smooth(0.4, 1, u.y) * 0.5).lerp(rose, smooth(0, -0.8, u.y) * 0.45);
  };
  const { geo, at } = sculpted(sculpt, R, center, 56, paint);
  mesh(geo, c.mat(0xffffff, { vertexColors: true, metalness: 0.45, roughness: 0.25, emissive: 0x8a5a10, emissiveIntensity: 0.35 }), c.head);
  mesh(new THREE.CylinderGeometry(0.085, 0.105, 0.06, 16), c.mat(c.palette.skin, { metalness: 0.45, roughness: 0.3, emissive: 0x8a5a10, emissiveIntensity: 0.3 }), c.head, new THREE.Vector3(0, 0.02, 0.03));

  const glow = c.mat(glowColor, { emissive: glowColor, emissiveIntensity: 2.4, roughness: 0.05 });
  // Olhos grandes amendoados (alien), inclinados, brilhando, com reflexo.
  for (const s of [-1, 1]) {
    const p = at(s * 0.5, 0.12, -0.86, -0.012);
    const g = new THREE.Group();
    g.position.copy(p);
    g.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, -1), new THREE.Vector3(s * 0.45, 0.05, -1).normalize());
    g.rotateZ(s * 0.45);
    c.head.add(g);
    // Amêndoa preta e brilhante (olho de alien) com um núcleo turquesa luminoso.
    const eyeBall = mesh(new THREE.SphereGeometry(0.068, 24, 16), c.mat(0x02060a, { roughness: 0.02, metalness: 0.2 }), g);
    eyeBall.scale.set(0.6, 1, 0.42);
    const core = mesh(new THREE.SphereGeometry(0.03, 16, 12), c.mat(glowColor, { emissive: glowColor, emissiveIntensity: 1.4, roughness: 0.1 }), g, new THREE.Vector3(0, -0.012, -0.02));
    core.scale.set(0.55, 0.9, 0.4);
    mesh(new THREE.SphereGeometry(0.011, 8, 6), c.mat(0xffffff, { emissive: 0xffffff, emissiveIntensity: 1 }), g, new THREE.Vector3(0.012, 0.03, -0.026));
    // Três pontinhos luminosos na bochecha.
    for (let k = 0; k < 3; k++) mesh(new THREE.SphereGeometry(0.008, 8, 6), glow, c.head, at(s * (0.6 + k * 0.06), -0.2 - k * 0.07, -0.72 + k * 0.1, 0.002));
  }
  // Bico curvo dourado-alaranjado (parte de cima maior, ponta virada para baixo).
  const beakMat = c.mat(0xffa632, { metalness: 0.6, roughness: 0.28 });
  const tip = at(0, -0.25, -1, 0);
  const upper = new THREE.CatmullRomCurve3([tip.clone().add(new THREE.Vector3(0, 0.03, 0.04)), tip.clone().add(new THREE.Vector3(0, 0.02, -0.06)), tip.clone().add(new THREE.Vector3(0, -0.035, -0.1))]);
  const beakGeo = new THREE.TubeGeometry(upper, 16, 1, 10, false);
  const bp = beakGeo.getAttribute('position');
  const cp = new THREE.Vector3();
  for (let i = 0; i <= 16; i++) {
    upper.getPointAt(i / 16, cp);
    const r = 0.034 * (1 - i / 16) + 0.004;
    for (let j = 0; j <= 10; j++) {
      const k = i * 11 + j;
      bp.setXYZ(k, cp.x + (bp.getX(k) - cp.x) * r * 1.1, cp.y + (bp.getY(k) - cp.y) * r * 0.8, cp.z + (bp.getZ(k) - cp.z) * r);
    }
  }
  beakGeo.computeVertexNormals();
  mesh(beakGeo, beakMat, c.head);
  const lower = mesh(new THREE.ConeGeometry(0.02, 0.07, 10).rotateX(-Math.PI / 2), c.mat(0xd8782a, { metalness: 0.5, roughness: 0.35 }), c.head, tip.clone().add(new THREE.Vector3(0, -0.02, -0.02)));
  lower.scale.set(1, 0.6, 1);

  // Antenas curvas com orbes brilhantes.
  const antMat = c.mat(c.palette.skin, { metalness: 0.85, roughness: 0.2 });
  for (const s of [-1, 1]) {
    const base = at(s * 0.32, 0.92, -0.1, -0.005);
    const pts = [base, base.clone().add(new THREE.Vector3(s * 0.03, 0.08, -0.02)), base.clone().add(new THREE.Vector3(s * 0.09, 0.14, 0.02)), base.clone().add(new THREE.Vector3(s * 0.12, 0.16, 0.07))];
    line(pts, 0.007, antMat, c.head);
    mesh(new THREE.SphereGeometry(0.022, 12, 10), glow, c.head, pts[3]);
    const halo = new THREE.Mesh(new THREE.SphereGeometry(0.04, 12, 10), new THREE.MeshBasicMaterial({ color: glowColor, transparent: true, opacity: 0.25, blending: THREE.AdditiveBlending, depthWrite: false }));
    halo.position.copy(pts[3]);
    c.head.add(halo);
  }
  // Crista de penas longas e curvas na nuca, com pontas brilhantes.
  const crestMat = c.mat(c.palette.accent, { emissive: c.palette.accent, emissiveIntensity: 0.5, roughness: 0.3 });
  for (let i = 0; i < 5; i++) {
    const side = (i - 2) * 0.12;
    const base = at(side, 0.75, 0.45, -0.01);
    const len = 0.22 - Math.abs(i - 2) * 0.04;
    const pts = [base, base.clone().add(new THREE.Vector3(side * 0.3, len * 0.55, len * 0.25)), base.clone().add(new THREE.Vector3(side * 0.6, len * 0.85, len * 0.75))];
    const curve = new THREE.CatmullRomCurve3(pts);
    const fg = new THREE.TubeGeometry(curve, 12, 1, 6, false);
    const fp = fg.getAttribute('position');
    for (let k = 0; k <= 12; k++) {
      curve.getPointAt(k / 12, cp);
      const r = 0.018 * Math.sin(Math.PI * Math.min(1, 0.15 + (k / 12) * 0.9)) + 0.003;
      for (let j = 0; j <= 6; j++) {
        const q = k * 7 + j;
        fp.setXYZ(q, cp.x + (fp.getX(q) - cp.x) * r * 0.5, cp.y + (fp.getY(q) - cp.y) * r, cp.z + (fp.getZ(q) - cp.z) * r);
      }
    }
    fg.computeVertexNormals();
    mesh(fg, crestMat, c.head);
    mesh(new THREE.SphereGeometry(0.012, 8, 6), glow, c.head, pts[2]);
  }
}

// ------------------------------------------------------------------ pelo (raposa, manto do caçador)

let furTex: THREE.CanvasTexture | null = null;
/** Fios de pelo claros/escuros sobre branco (multiplica a cor dos vértices) + relevo. */
function furTexture(): THREE.CanvasTexture {
  if (furTex) return furTex;
  const size = 128;
  const cv = document.createElement('canvas');
  cv.width = cv.height = size;
  const g = cv.getContext('2d')!;
  g.fillStyle = '#ffffff';
  g.fillRect(0, 0, size, size);
  for (let i = 0; i < 1600; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const k = 175 + Math.random() * 80;
    g.strokeStyle = `rgba(${k},${k},${k},0.6)`;
    g.lineWidth = 1;
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x + (Math.random() - 0.5) * 2, y + 4 + Math.random() * 5);
    g.stroke();
  }
  furTex = new THREE.CanvasTexture(cv);
  furTex.wrapS = furTex.wrapT = THREE.RepeatWrapping;
  furTex.repeat.set(4, 2);
  furTex.colorSpace = THREE.SRGBColorSpace;
  return furTex;
}

// ------------------------------------------------------------------ raposa (Fenna)

export function foxHead(c: PartsContext): void {
  const orange = new THREE.Color(c.palette.skin);
  const white = new THREE.Color(0xfbf4ea);
  const dark = new THREE.Color(0x2a1810);
  const center = new THREE.Vector3(0, 0.2, 0.03);
  const R = 0.17;
  // Focinho fino e comprido, bochechas peludas dos lados, testa arredondada.
  const sculpt: Sculpt = (v) => {
    const u = v.clone();
    const front = smooth(0, 1, -u.z);
    v.z -= front * front * 0.85;
    v.x *= 1 - 0.6 * front * front;
    v.y = v.y * (1 - 0.45 * front) - 0.13 * front;
    v.x *= 1 + 0.24 * smooth(0.45, 0.9, Math.abs(u.x)) * smooth(0.15, -0.4, u.y) * smooth(-0.5, 0.3, -u.z);
    if (v.y < -0.5) v.y = -0.5 + (v.y + 0.5) * 0.4;
  };
  // Laranja em cima; focinho de baixo e bochechas brancos; leve sombra em volta dos olhos.
  const paint = (u: THREE.Vector3, out: THREE.Color) => {
    const front = smooth(0, 1, -u.z);
    const whiteMuzzle = smooth(-0.02, -0.18, u.y) * smooth(0.15, 0.45, front);
    const whiteCheek = smooth(0.5, 0.75, Math.abs(u.x)) * smooth(0.05, -0.25, u.y);
    out.copy(orange).lerp(white, Math.max(whiteMuzzle, whiteCheek));
    out.multiplyScalar(0.92 + 0.08 * noise(u.x * 3, u.y * 3, u.z * 3));
  };
  const { geo, at } = sculpted(sculpt, R, center, 56, paint);
  const furMat = c.mat(0xffffff, { vertexColors: true, map: furTexture(), bumpMap: furTexture(), bumpScale: 0.8, roughness: 0.9 });
  mesh(geo, furMat, c.head);
  mesh(new THREE.CylinderGeometry(0.09, 0.11, 0.08, 16), c.mat(c.palette.skin, { map: furTexture(), roughness: 0.9 }), c.head, new THREE.Vector3(0, 0.03, 0.04));
  // Nariz preto brilhante e boquinha.
  mesh(new THREE.SphereGeometry(0.022, 14, 10).scale(1.3, 0.9, 1), c.mat(0x0c0806, { roughness: 0.1 }), c.head, at(0, 0.0, -1, 0.006));
  const mouth: THREE.Vector3[] = [];
  for (let i = 0; i <= 8; i++) {
    const a = -0.7 + (i / 8) * 1.4;
    mouth.push(at(Math.sin(a), -0.3, -Math.cos(a), 0.002));
  }
  line(mouth, 0.004, c.mat(0x2a1810), c.head);
  // Olhos amendoados rentes à cabeça: contorno escuro puxado para cima, íris âmbar, pupila em fenda.
  const liner = c.mat(0x140c08, { roughness: 0.4 });
  const iris = c.mat(0xf2a020, { roughness: 0.15, emissive: 0x6a3a00, emissiveIntensity: 0.3 });
  const pupil = c.mat(0x050302, { roughness: 0.05 });
  const shine = c.mat(0xffffff, { emissive: 0xffffff, emissiveIntensity: 0.7 });
  for (const s of [-1, 1]) {
    const g = new THREE.Group();
    // Na testa (fora da parte que estica para o focinho), virados um pouco para os lados.
    g.position.copy(at(s * 0.55, 0.4, -0.6, -0.006));
    g.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, -1), new THREE.Vector3(s * 0.65, 0.2, -1).normalize());
    g.rotateZ(s * 0.32); // canto de fora mais alto
    c.head.add(g);
    mesh(new THREE.SphereGeometry(1, 24, 14).scale(0.06, 0.037, 0.016), liner, g);
    mesh(new THREE.SphereGeometry(1, 24, 14).scale(0.054, 0.033, 0.016), iris, g, new THREE.Vector3(0, 0, -0.005));
    mesh(new THREE.SphereGeometry(1, 14, 10).scale(0.01, 0.028, 0.012), pupil, g, new THREE.Vector3(0, 0, -0.011));
    mesh(new THREE.SphereGeometry(0.008, 10, 8), shine, g, new THREE.Vector3(0.016, 0.012, -0.02));
  }
  // Orelhas grandes: laranja com ponta escura e interior branco e fofo.
  for (const s of [-1, 1]) {
    const base = at(s * 0.5, 0.78, 0.05, -0.02);
    const ear = new THREE.Group();
    ear.position.copy(base);
    ear.rotation.set(-0.15, 0, -s * 0.28);
    c.head.add(ear);
    const outer = new THREE.ConeGeometry(0.075, 0.21, 14).translate(0, 0.105, 0);
    paintVertices(outer, (p, _n, out) => out.copy(orange).lerp(dark, smooth(0.13, 0.17, p.y)));
    const o = mesh(outer, c.mat(0xffffff, { vertexColors: true, roughness: 0.85, map: furTexture() }), ear);
    o.scale.set(1, 1, 0.55);
    const inner = mesh(new THREE.ConeGeometry(0.05, 0.15, 12).translate(0, 0.075, 0), c.mat(0xf6ecdc, { roughness: 1, map: furTexture() }), ear, new THREE.Vector3(0, 0.01, -0.02));
    inner.scale.set(1, 1, 0.4);
  }
  // Tufos brancos nas bochechas.
  for (const s of [-1, 1]) {
    for (let k = 0; k < 2; k++) {
      const t = mesh(new THREE.ConeGeometry(0.035, 0.09, 8).translate(0, 0.045, 0), c.mat(0xfbf4ea, { map: furTexture(), roughness: 1 }), c.head, at(s * 0.85, -0.3 - k * 0.12, -0.15 + k * 0.1, -0.02));
      t.rotation.set(0.3, 0, -s * (1.6 + k * 0.3));
    }
  }
}

/** Cauda de raposa bem peluda: grossa no meio, ponta branca. */
export function foxTail(c: PartsContext): THREE.Group {
  const root = new THREE.Group();
  root.position.set(0, 0.0, 0.3);
  root.rotation.x = 1.0;
  const len = 0.85;
  const geo = new THREE.SphereGeometry(1, 28, 20);
  const pos = geo.getAttribute('position');
  const orange = new THREE.Color(c.palette.skin);
  const white = new THREE.Color(0xfbf4ea);
  const colors = new Float32Array(pos.count * 3);
  const col = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const t = (z + 1) / 2; // 0 = base, 1 = ponta
    const r = 0.06 + 0.17 * Math.sin(Math.PI * Math.pow(t, 0.75));
    pos.setXYZ(i, x * r, y * r + Math.sin(t * 2.2) * 0.06, t * len);
    col.copy(orange).lerp(white, smooth(0.72, 0.82, t));
    colors.set([col.r, col.g, col.b], i * 3);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  mesh(geo, c.mat(0xffffff, { vertexColors: true, map: furTexture(), bumpMap: furTexture(), bumpScale: 0.8, roughness: 0.95 }), root);
  c.hips.add(root);
  return root;
}

// ------------------------------------------------------------------ robô (Cobalto)

/** Cabeça de robô: cubo arredondado de metal, tela de vidro com olhos de luz, fones, antena. Devolve as luzes que pulsam. */
export function robotHead(c: PartsContext): THREE.MeshStandardMaterial[] {
  const metal = new THREE.Color(c.palette.skin);
  const seam = new THREE.Color(0x3a4048);
  const center = new THREE.Vector3(0, 0.22, 0.01);
  const R = 0.19;
  // Cubo de cantos arredondados (mistura de esfera com cubo), um pouco mais largo.
  const sculpt: Sculpt = (v) => {
    const m = Math.max(Math.abs(v.x), Math.abs(v.y), Math.abs(v.z));
    const cube = v.clone().divideScalar(m);
    v.lerp(cube, 0.72).multiplyScalar(0.82);
    v.x *= 1.12;
  };
  // Metal com linhas de junta: uma faixa no meio do alto da cabeça e outra em volta, na altura do queixo.
  const paint = (u: THREE.Vector3, out: THREE.Color) => {
    out.copy(metal);
    if (Math.abs(u.x) < 0.035 && u.y > 0.2 && u.z > -0.6) out.lerp(seam, 0.85);
    if (Math.abs(u.y + 0.45) < 0.03) out.lerp(seam, 0.85);
    out.multiplyScalar(0.95 + 0.05 * noise(u.x * 5, u.y * 5, u.z * 5));
  };
  const { geo, at } = sculpted(sculpt, R, center, 48, paint);
  mesh(geo, c.mat(0xffffff, { vertexColors: true, metalness: 0.75, roughness: 0.3 }), c.head);
  // Pescoço articulado.
  const dark = c.mat(0x2a3038, { metalness: 0.6, roughness: 0.4 });
  for (let i = 0; i < 2; i++) mesh(new THREE.CylinderGeometry(0.06, 0.07, 0.03, 14), dark, c.head, new THREE.Vector3(0, 0.0 + i * 0.04, 0.02));

  const lights: THREE.MeshStandardMaterial[] = [];
  const glow = c.mat(c.palette.eyes, { emissive: c.palette.eyes, emissiveIntensity: 2.4, roughness: 0.1 });
  lights.push(glow);
  // Tela de vidro escuro no rosto, com moldura.
  const face = at(0, 0.02, -1, 0);
  mesh(new THREE.BoxGeometry(0.31, 0.2, 0.02), c.mat(0x22262c, { metalness: 0.8, roughness: 0.3 }), c.head, face.clone().add(new THREE.Vector3(0, 0, -0.004)));
  mesh(new THREE.BoxGeometry(0.28, 0.17, 0.012), c.mat(0x05080c, { roughness: 0.02, metalness: 0.3 }), c.head, face.clone().add(new THREE.Vector3(0, 0, -0.014)));
  // Olhos de luz (cápsulas deitadas) e "boca" de barrinhas.
  for (const s of [-1, 1]) {
    mesh(new THREE.CapsuleGeometry(0.018, 0.04, 4, 10).rotateZ(Math.PI / 2), glow, c.head, face.clone().add(new THREE.Vector3(s * 0.065, 0.03, -0.022)));
  }
  for (let i = 0; i < 5; i++) {
    const h = [0.012, 0.024, 0.034, 0.024, 0.012][i];
    mesh(new THREE.BoxGeometry(0.012, h, 0.004), glow, c.head, face.clone().add(new THREE.Vector3(-0.04 + i * 0.02, -0.045, -0.022)));
  }
  // Fones laterais com anel de luz.
  const ring = c.mat(c.palette.accent, { emissive: c.palette.accent, emissiveIntensity: 1.6 });
  lights.push(ring);
  for (const s of [-1, 1]) {
    const p = at(s, 0, 0, 0.01);
    mesh(new THREE.CylinderGeometry(0.06, 0.065, 0.04, 20).rotateZ(Math.PI / 2), dark, c.head, p);
    mesh(new THREE.TorusGeometry(0.045, 0.008, 8, 24).rotateY(Math.PI / 2), ring, c.head, p.clone().add(new THREE.Vector3(s * 0.022, 0, 0)));
  }
  // Antena com luz piscando.
  const base = at(0.4, 1, 0.3, 0);
  mesh(new THREE.CylinderGeometry(0.006, 0.01, 0.16, 8).translate(0, 0.08, 0), dark, c.head, base);
  const tipMat = c.mat(c.palette.accent, { emissive: c.palette.accent, emissiveIntensity: 2.5 });
  lights.push(tipMat);
  mesh(new THREE.SphereGeometry(0.022, 12, 10), tipMat, c.head, base.clone().add(new THREE.Vector3(0, 0.17, 0)));
  // Núcleo de energia no peito.
  const core = c.mat(c.palette.eyes, { emissive: c.palette.eyes, emissiveIntensity: 2 });
  lights.push(core);
  mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.03, 24).rotateX(Math.PI / 2), dark, c.torso, new THREE.Vector3(0, 0.43, -0.19));
  mesh(new THREE.SphereGeometry(0.05, 18, 12).scale(1, 1, 0.5), core, c.torso, new THREE.Vector3(0, 0.43, -0.205));
  return lights;
}

// ------------------------------------------------------------------ acessórios (elfa Sylwen, caçador Kael)

/** Aljava nas costas com flechas (penas na cor `fletch`). */
function quiver(c: PartsContext, leather: number, trim: number, fletch: number): void {
  const g = new THREE.Group();
  g.position.set(0.12, 0.5, 0.36);
  g.rotation.set(0.2, 0, -0.45);
  g.scale.setScalar(1.3);
  c.torso.add(g);
  mesh(new THREE.CylinderGeometry(0.075, 0.06, 0.42, 14), c.mat(leather, { roughness: 0.8 }), g);
  for (const y of [-0.18, 0.18]) mesh(new THREE.TorusGeometry(0.073, 0.012, 6, 18).rotateX(Math.PI / 2), c.mat(trim, { metalness: 0.7, roughness: 0.35 }), g, new THREE.Vector3(0, y, 0));
  const shaft = c.mat(0xc9a36b, { roughness: 0.7 });
  const feather = c.mat(fletch, { roughness: 0.8, side: THREE.DoubleSide });
  for (let i = 0; i < 5; i++) {
    const x = (i - 2) * 0.022;
    const z = (i % 2 ? 1 : -1) * 0.02;
    mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.16, 5), shaft, g, new THREE.Vector3(x, 0.26, z));
    const f = mesh(new THREE.PlaneGeometry(0.035, 0.08), feather, g, new THREE.Vector3(x, 0.33, z));
    f.rotation.y = i * 0.6;
  }
}

/** Sylwen (elfa): orelhas longas com brincos, tiara com joia brilhante, ombreiras de folhas, aljava élfica. */
export function elfExtras(c: PartsContext): THREE.MeshStandardMaterial[] {
  const skin = c.mat(0xb47a56, { roughness: 0.6 });
  const gold = c.mat(0xe0b040, { metalness: 0.85, roughness: 0.25 });
  for (const s of [-1, 1]) {
    // Orelha longa e fina, curvada para trás e para cima.
    const ear = new THREE.Group();
    ear.position.set(s * 0.2, 0.21, 0.04);
    ear.rotation.set(0.45, 0, -s * 0.75);
    c.head.add(ear);
    const g = new THREE.SphereGeometry(1, 16, 12);
    const pos = g.getAttribute('position');
    for (let i = 0; i < pos.count; i++) {
      const y = (pos.getY(i) + 1) / 2; // 0 base → 1 ponta
      const w = 0.032 * (1 - y * 0.85);
      pos.setXYZ(i, pos.getX(i) * w, y * 0.15, pos.getZ(i) * w * 0.45 + y * y * 0.03);
    }
    g.computeVertexNormals();
    mesh(g, skin, ear);
    mesh(new THREE.TorusGeometry(0.014, 0.004, 6, 14), gold, ear, new THREE.Vector3(0, 0.05, 0.01));
  }
  // Tiara dourada na testa, com joia verde brilhante.
  const tiara = mesh(new THREE.TorusGeometry(0.205, 0.008, 6, 40, Math.PI * 0.9).rotateX(Math.PI / 2), gold, c.head, new THREE.Vector3(0, 0.33, 0.02));
  tiara.rotation.y = Math.PI * 0.55;
  const gem = c.mat(0x2bd97a, { emissive: 0x2bd97a, emissiveIntensity: 1.8, roughness: 0.1 });
  mesh(new THREE.OctahedronGeometry(0.03).scale(0.8, 1.2, 0.6), gem, c.head, new THREE.Vector3(0, 0.33, -0.19));
  // Ombreiras de folhas douradas.
  for (const s of [-1, 1]) {
    for (let k = 0; k < 3; k++) {
      const leaf = mesh(new THREE.SphereGeometry(0.07, 12, 8).scale(0.5, 0.14, 1), gold, c.torso, new THREE.Vector3(s * (0.32 + k * 0.025), 0.62 - k * 0.04, -0.03 + k * 0.05));
      leaf.rotation.set(0.3, s * (0.4 + k * 0.3), s * 0.5);
    }
  }
  quiver(c, 0xe8e0c8, 0xe0b040, 0x2f8f6a);
  return [gem];
}

/** Kael (arqueiro do mal): manto de pele preta, pena vermelha, aljava preta e dourada, olhos vermelhos no capuz. */
export function hunterExtras(c: PartsContext): THREE.MeshStandardMaterial[] {
  const fur = c.mat(0x2a2224, { map: furTexture(), bumpMap: furTexture(), bumpScale: 0.8, roughness: 1 });
  // Manto de pele: tufos em volta dos ombros e do pescoço.
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    if (Math.sin(a) < -0.5) continue; // deixa a frente do peito livre
    const t = mesh(new THREE.ConeGeometry(0.08, 0.16, 8).translate(0, 0.08, 0), fur, c.torso, new THREE.Vector3(Math.cos(a) * 0.3, 0.5, Math.sin(a) * 0.22 + 0.03));
    t.rotation.set(Math.sin(a) * 1.4, 0, -Math.cos(a) * 1.4);
  }
  // Pena vermelha presa no capuz.
  const feather = new THREE.SphereGeometry(1, 12, 8);
  feather.scale(0.025, 0.1, 0.007).translate(0, 0.09, 0);
  const f = mesh(feather, c.mat(0xb01020, { roughness: 0.6, emissive: 0x400008, emissiveIntensity: 0.6 }), c.head, new THREE.Vector3(0.2, 0.3, 0.06));
  f.rotation.set(0.5, 0.3, -0.5);
  mesh(new THREE.CylinderGeometry(0.003, 0.003, 0.19, 5).translate(0, 0.09, 0), c.mat(0xf0e6d0), c.head, new THREE.Vector3(0.2, 0.3, 0.06)).rotation.set(0.5, 0.3, -0.5);
  quiver(c, 0x1a1416, 0xd4a020, 0xb01020);
  // Olhos vermelhos brilhando na sombra do capuz.
  const glow = c.mat(c.palette.eyes, { emissive: c.palette.eyes, emissiveIntensity: 2.6 });
  for (const s of [-1, 1]) {
    mesh(new THREE.SphereGeometry(0.018, 10, 8).scale(1.1, 1.1, 0.5), glow, c.head, new THREE.Vector3(s * 0.072, 0.158, -0.205));
  }
  // Ombreiras pretas com borda e espinhos dourados.
  const black = c.mat(0x141012, { metalness: 0.6, roughness: 0.35 });
  const gold = c.mat(0xd4a020, { metalness: 0.9, roughness: 0.25 });
  for (const s of [-1, 1]) {
    const p = new THREE.Vector3(s * 0.34, 0.6, 0.0);
    const shell = mesh(new THREE.SphereGeometry(0.11, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2), black, c.torso, p);
    shell.rotation.z = -s * 0.5;
    const rim = mesh(new THREE.TorusGeometry(0.105, 0.012, 6, 24).rotateX(Math.PI / 2), gold, c.torso, p);
    rim.rotation.z = -s * 0.5;
    for (let k = 0; k < 2; k++) {
      const spike = mesh(new THREE.ConeGeometry(0.022, 0.09, 6).translate(0, 0.045, 0), gold, c.torso, p.clone().add(new THREE.Vector3(s * 0.03, 0.07, -0.04 + k * 0.08)));
      spike.rotation.z = -s * 0.6;
    }
  }
  // Broche dourado com pedra vermelha no peito.
  mesh(new THREE.TorusGeometry(0.035, 0.01, 8, 20), gold, c.torso, new THREE.Vector3(0, 0.5, -0.27));
  mesh(new THREE.SphereGeometry(0.024, 12, 10), glow, c.torso, new THREE.Vector3(0, 0.5, -0.275));
  return [glow];
}

// ------------------------------------------------------------------ coruja (Noctua)

export function owlHead(c: PartsContext): void {
  const brown = new THREE.Color(c.palette.skin);
  const cream = new THREE.Color(0xf0e2c6);
  const dark = new THREE.Color(0x4a3420);
  // Centro um pouco à frente: o rosto achatado e as penas da nuca deixavam o peso da cabeça atrás do
  // pescoço, e andando (o corpo balança) ela parecia solta/deslocada para trás.
  const center = new THREE.Vector3(0, 0.21, -0.055);
  const R = 0.19;
  // Cabeça larga e menos redonda: topo achatado, rosto largo e côncavo (disco facial),
  // sobrancelha em "V" saliente e base afinando para o pescoço.
  const sculpt: Sculpt = (v) => {
    const u = v.clone();
    v.x *= 1.18;
    v.y *= 0.9;
    if (v.y > 0.5) v.y = 0.5 + (v.y - 0.5) * 0.45; // topo achatado
    const face = smooth(0.3, 0.8, -u.z);
    v.z += face * 0.2 * (1 - Math.abs(u.x) * 0.5); // achata a frente
    v.z += smooth(0.72, 0.95, -u.z) * 0.07; // côncavo no centro do rosto
    v.z -= smooth(0.25, 0.45, u.y) * smooth(0.6, 0.15, Math.abs(u.x)) * face * 0.09; // sobrancelha em V
    v.x *= 1 - 0.25 * smooth(-0.15, -0.85, u.y); // afina embaixo
    if (v.y < -0.55) v.y = -0.55 + (v.y + 0.55) * 0.4;
  };
  // Penas marrons pintadas; disco facial creme com borda escura; "V" escuro entre os olhos.
  const paint = (u: THREE.Vector3, out: THREE.Color) => {
    const facing = -u.z;
    out.copy(brown).multiplyScalar(0.9 + 0.12 * noise(u.x * 6, u.y * 6, u.z * 6));
    if (noise(u.x * 9, u.y * 9, u.z * 9) > 0.45) out.lerp(dark, 0.5); // pintinhas
    const disc = smooth(0.42, 0.62, facing);
    out.lerp(cream, disc);
    const rim = smooth(0.36, 0.44, facing) * smooth(0.52, 0.44, facing);
    out.lerp(dark, rim * 0.8);
    const v = smooth(0.06, 0.0, Math.abs(Math.abs(u.x) - (0.32 - u.y) * 0.35)) * smooth(0.0, 0.25, u.y) * disc;
    out.lerp(brown, v * 0.8);
  };
  const { geo, at } = sculpted(sculpt, R, center, 56, paint);
  const feathers = featherTexture();
  mesh(geo, c.mat(0xffffff, { vertexColors: true, map: feathers, bumpMap: feathers, bumpScale: 1.6, roughness: 0.9 }), c.head);
  mesh(new THREE.CylinderGeometry(0.1, 0.12, 0.07, 16), c.mat(c.palette.skin, { map: feathers, roughness: 0.95 }), c.head, new THREE.Vector3(0, 0.025, -0.01));
  // Colar de penas em volta do disco facial (quebra o contorno redondo).
  const ruffMat = c.mat(0xffffff, { vertexColors: true, map: feathers, bumpMap: feathers, bumpScale: 1.2, roughness: 0.9, side: THREE.DoubleSide });
  const n = 26;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    if (Math.sin(a) > 0.82) continue; // deixa o alto livre para a sobrancelha
    const dir = new THREE.Vector3(Math.cos(a) * 0.86, Math.sin(a) * 0.8, -0.62);
    const p = at(dir.x, dir.y, dir.z, -0.01);
    const geoF = feather(0.05, 0.1, i % 2 ? cream : new THREE.Color(0xd8c0a0), dark);
    const f = mesh(geoF, ruffMat, c.head, p);
    // Pena "deitada" apontando para fora do disco.
    f.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(Math.cos(a), Math.sin(a), 0.35).normalize());
  }
  // Fileiras de penas na nuca e no alto da cabeça (pontas escuras).
  const backMat = c.mat(0xffffff, { vertexColors: true, map: feathers, bumpMap: feathers, bumpScale: 1.2, roughness: 0.9, side: THREE.DoubleSide });
  for (let row = 0; row < 4; row++) {
    const count = 7 + row;
    for (let i = 0; i < count; i++) {
      const a = -1.2 + (i / (count - 1)) * 2.4;
      const yv = 0.55 - row * 0.32;
      const dir = new THREE.Vector3(Math.sin(a) * 0.9, yv, Math.cos(a) * 0.9);
      const p = at(dir.x, dir.y, dir.z, -0.012);
      const f = mesh(feather(0.05, 0.085, brown.clone().multiplyScalar(0.95 + (i % 3) * 0.05), dark), backMat, c.head, p);
      f.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(Math.sin(a) * 0.3, -1, Math.cos(a) * 0.45).normalize());
    }
  }
  // Olhos enormes cor de laranja, com pupila grande e brilho.
  for (const s of [-1, 1]) {
    const p = at(s * 0.38, 0.12, -0.92, -0.01);
    const g = new THREE.Group();
    g.position.copy(p);
    g.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, -1), new THREE.Vector3(s * 0.25, 0.05, -1).normalize());
    c.head.add(g);
    mesh(new THREE.SphereGeometry(0.058, 20, 14).scale(1, 1, 0.45), c.mat(0x1a1008, { roughness: 0.5 }), g);
    mesh(new THREE.SphereGeometry(0.05, 20, 14).scale(1, 1, 0.45), c.mat(c.palette.eyes, { roughness: 0.1, emissive: c.palette.eyes, emissiveIntensity: 0.35 }), g, new THREE.Vector3(0, 0, -0.006));
    mesh(new THREE.SphereGeometry(0.028, 16, 12).scale(1, 1, 0.4), c.mat(0x030202, { roughness: 0.05 }), g, new THREE.Vector3(0, 0, -0.016));
    mesh(new THREE.SphereGeometry(0.009, 8, 6), c.mat(0xffffff, { emissive: 0xffffff, emissiveIntensity: 0.8 }), g, new THREE.Vector3(0.015, 0.018, -0.026));
    // Sobrancelha de penas (cara séria de coruja).
    const brow = mesh(new THREE.ConeGeometry(0.02, 0.11, 6).rotateZ(Math.PI / 2), c.mat(dark.getHex(), { roughness: 0.9 }), c.head, at(s * 0.4, 0.42, -0.8, 0.0));
    brow.rotation.y = s * 0.3;
    brow.rotation.z = s * 0.35;
  }
  // Bico curvo pequeno, amarelado.
  const beakTip = at(0, -0.12, -1, 0.0);
  const beak = mesh(new THREE.ConeGeometry(0.022, 0.07, 10).translate(0, -0.035, 0), c.mat(0xd8a630, { roughness: 0.35 }), c.head, beakTip.clone().add(new THREE.Vector3(0, 0.03, -0.01)));
  beak.rotation.x = -0.45;
  beak.scale.set(1, 1, 0.8);
  // Tufos de "orelha": penas compridas com ponta escura.
  for (const s of [-1, 1]) {
    for (let k = 0; k < 3; k++) {
      const f = new THREE.ConeGeometry(0.03 - k * 0.006, 0.15 - k * 0.025, 6).translate(0, 0.07, 0);
      paintVertices(f, (pp, _n, out) => out.copy(brown).lerp(dark, smooth(0.06, 0.12, pp.y)));
      const t = mesh(f, c.mat(0xffffff, { vertexColors: true, roughness: 0.9 }), c.head, at(s * (0.55 - k * 0.08), 0.75, 0.05 + k * 0.08, -0.02));
      t.rotation.set(0.2 + k * 0.15, 0, -s * (0.45 + k * 0.1));
    }
  }
}

/** Asa de coruja: camadas de penas (escuras em cima, claras nas pontas). Abre no pulo. */
export function owlWing(c: PartsContext, side: number): THREE.Group {
  const brown = new THREE.Color(c.palette.skin);
  const tip = new THREE.Color(c.palette.accent);
  const wing = new THREE.Group();
  wing.position.set(side * 0.18, 0.5, 0.18);
  for (let k = 0; k < 5; k++) {
    const g = new THREE.SphereGeometry(1, 14, 10);
    g.scale(0.06, 0.22 - k * 0.02, 0.025).translate(0, -0.18 + k * 0.01, 0);
    paintVertices(g, (p, _n, out) => out.copy(brown).lerp(tip, smooth(-0.15, -0.35, p.y)));
    const f = mesh(g, c.mat(0xffffff, { vertexColors: true, map: featherTexture(), bumpMap: featherTexture(), bumpScale: 1.2, roughness: 0.9 }), wing, new THREE.Vector3(side * k * 0.03, 0, k * 0.012));
    f.rotation.z = side * (0.05 + k * 0.12);
  }
  c.torso.add(wing);
  return wing;
}

// ------------------------------------------------------------------ mago (Eldrin)

/** Eldrin: barba branca longa, estrela no chapéu e orbes mágicos girando em volta. */
export function mageExtras(c: PartsContext): { pulse: THREE.MeshStandardMaterial[]; spin: THREE.Object3D[] } {
  // Barba: cone ondulado, mais larga no rosto e terminando em ponta.
  // (Medidas menores: a escala da cabeça do mago inclui o chapéu alto.)
  const g = new THREE.ConeGeometry(0.06, 0.15, 18, 6).rotateX(Math.PI);
  const pos = g.getAttribute('position');
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    pos.setX(i, pos.getX(i) + Math.sin(y * 50) * 0.004);
    pos.setZ(i, pos.getZ(i) * 0.55);
  }
  g.computeVertexNormals();
  mesh(g, c.mat(0xf2f0ea, { roughness: 0.9 }), c.head, new THREE.Vector3(0, -0.01, -0.1));
  // Bigode.
  for (const s of [-1, 1]) {
    const m = mesh(new THREE.CapsuleGeometry(0.01, 0.035, 4, 8).rotateZ(Math.PI / 2), c.mat(0xf2f0ea, { roughness: 0.9 }), c.head, new THREE.Vector3(s * 0.025, 0.06, -0.12));
    m.rotation.z = s * -0.35;
  }
  // Estrela dourada brilhando no chapéu.
  const star = new THREE.Shape();
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2 + Math.PI / 2;
    const r = i % 2 ? 0.022 : 0.05;
    if (i === 0) star.moveTo(Math.cos(a) * r, Math.sin(a) * r);
    else star.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  const starMat = c.mat(0xffd24a, { emissive: 0xffb020, emissiveIntensity: 1.6, metalness: 0.6, roughness: 0.3 });
  const starMesh = mesh(new THREE.ExtrudeGeometry(star, { depth: 0.01, bevelEnabled: false }), starMat, c.head, new THREE.Vector3(0, 0.31, -0.125));
  starMesh.scale.setScalar(0.85);
  starMesh.rotation.x = -0.35;
  // Orbes mágicos girando em volta do corpo.
  const orbit = new THREE.Group();
  orbit.position.set(0, 0.45, 0);
  c.torso.add(orbit);
  const orbMat = c.mat(c.palette.accent, { emissive: c.palette.accent, emissiveIntensity: 2.4, roughness: 0.1 });
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    mesh(new THREE.SphereGeometry(0.035, 14, 10), orbMat, orbit, new THREE.Vector3(Math.cos(a) * 0.48, Math.sin(a * 2) * 0.08, Math.sin(a) * 0.48));
    const halo = new THREE.Mesh(new THREE.SphereGeometry(0.06, 12, 10), new THREE.MeshBasicMaterial({ color: c.palette.accent, transparent: true, opacity: 0.25, blending: THREE.AdditiveBlending, depthWrite: false }));
    halo.position.set(Math.cos(a) * 0.48, Math.sin(a * 2) * 0.08, Math.sin(a) * 0.48);
    orbit.add(halo);
  }
  return { pulse: [starMat, orbMat], spin: [orbit] };
}

// ------------------------------------------------------------------ penas

let featherTex: THREE.CanvasTexture | null = null;
/**
 * Textura de penas: fileiras de penas sobrepostas (centro claro, borda escura,
 * haste no meio). Branca: a cor vem dos vértices. Serve de cor e de relevo.
 */
function featherTexture(): THREE.CanvasTexture {
  if (featherTex) return featherTex;
  const size = 256;
  const cv = document.createElement('canvas');
  cv.width = cv.height = size;
  const g = cv.getContext('2d')!;
  g.fillStyle = '#b8b0a8';
  g.fillRect(0, 0, size, size);
  const fw = 32;
  const fh = 40;
  // De baixo para cima: cada fileira cobre a ponta da de baixo.
  for (let row = Math.ceil(size / (fh * 0.5)) + 1; row >= -1; row--) {
    for (let col = -1; col <= size / fw + 1; col++) {
      const x = col * fw + (row % 2 ? fw / 2 : 0);
      const y = row * fh * 0.5;
      const tone = 210 + Math.floor(Math.random() * 45);
      const grad = g.createRadialGradient(x, y + fh * 0.2, 2, x, y + fh * 0.35, fw * 0.75);
      grad.addColorStop(0, `rgb(${tone},${tone},${tone})`);
      grad.addColorStop(0.7, `rgb(${tone - 40},${tone - 40},${tone - 40})`);
      grad.addColorStop(1, `rgb(${tone - 110},${tone - 110},${tone - 110})`);
      g.fillStyle = grad;
      g.beginPath();
      g.moveTo(x - fw * 0.55, y);
      g.quadraticCurveTo(x - fw * 0.6, y + fh * 0.75, x, y + fh);
      g.quadraticCurveTo(x + fw * 0.6, y + fh * 0.75, x + fw * 0.55, y);
      g.closePath();
      g.fill();
      // Haste e barbas finas.
      g.strokeStyle = 'rgba(70,60,50,0.55)';
      g.lineWidth = 1.2;
      g.beginPath();
      g.moveTo(x, y + 2);
      g.lineTo(x, y + fh * 0.9);
      g.stroke();
      g.strokeStyle = 'rgba(90,80,70,0.25)';
      g.lineWidth = 0.8;
      for (let k = 1; k < 6; k++) {
        const yy = y + (k / 6) * fh * 0.85;
        g.beginPath();
        g.moveTo(x, yy);
        g.lineTo(x - fw * 0.38, yy + 5);
        g.moveTo(x, yy);
        g.lineTo(x + fw * 0.38, yy + 5);
        g.stroke();
      }
    }
  }
  featherTex = new THREE.CanvasTexture(cv);
  featherTex.wrapS = featherTex.wrapT = THREE.RepeatWrapping;
  featherTex.repeat.set(3, 2);
  featherTex.colorSpace = THREE.SRGBColorSpace;
  return featherTex;
}

/** Uma pena solta (lâmina curva com ponta arredondada), base em (0,0,0) apontando para +Y. */
function feather(width: number, length: number, color: THREE.Color, tip: THREE.Color): THREE.BufferGeometry {
  const g = new THREE.SphereGeometry(1, 10, 8);
  g.scale(width / 2, length / 2, width * 0.12).translate(0, length / 2, 0);
  // Curva levemente (pena não é plana).
  const pos = g.getAttribute('position');
  for (let i = 0; i < pos.count; i++) {
    const t = pos.getY(i) / length;
    pos.setZ(i, pos.getZ(i) + t * t * length * 0.25);
  }
  g.computeVertexNormals();
  paintVertices(g, (p, _n, out) => out.copy(color).lerp(tip, smooth(0.65, 1, p.y / length) * 0.75));
  return g;
}

/** Peito e ombros de coruja: penas listradas cobrindo a frente do tronco e os ombros. */
export function owlChest(c: PartsContext): void {
  const brown = new THREE.Color(c.palette.skin);
  const cream = new THREE.Color(0xf0e2c6);
  const bar = new THREE.Color(0x5a3e24);
  const mat = c.mat(0xffffff, { vertexColors: true, map: featherTexture(), bumpMap: featherTexture(), bumpScale: 1.2, roughness: 0.9, side: THREE.DoubleSide });
  // Babador de penas na frente do peito (claro com listras marrons).
  for (let row = 0; row < 5; row++) {
    const count = 6 - (row > 2 ? 1 : 0);
    for (let i = 0; i < count; i++) {
      const x = (i - (count - 1) / 2) * 0.075;
      const y = 0.62 - row * 0.07;
      const z = -0.23 - (1 - Math.abs(x) * 3) * 0.02;
      const base = row % 2 ? cream : cream.clone().lerp(brown, 0.25);
      const f = mesh(feather(0.08, 0.1, base, bar), mat, c.torso, new THREE.Vector3(x, y, z));
      f.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(x * 0.6, -1, -0.25).normalize());
    }
  }
  // Ombros: penas marrons caindo sobre os braços.
  for (const s of [-1, 1]) {
    for (let i = 0; i < 6; i++) {
      const a = (i / 5) * 1.4 - 0.7;
      const p = new THREE.Vector3(s * (0.27 + Math.cos(a) * 0.06), 0.66 - Math.abs(a) * 0.04, Math.sin(a) * 0.16);
      const f = mesh(feather(0.08, 0.14, brown.clone().multiplyScalar(0.9 + (i % 2) * 0.1), bar), mat, c.torso, p);
      f.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(s * 0.6, -1, Math.sin(a) * 0.3).normalize());
    }
  }
}

// ------------------------------------------------------------------ traje de astronauta (Fenna)

/** Traje metálico de astronauta (só o corpo): anel do pescoço, painel no peito, mochila de suporte de vida. */
export function astronautSuit(c: PartsContext): THREE.MeshStandardMaterial[] {
  const silver = c.mat(0xdfe4ea, { metalness: 0.6, roughness: 0.3 });
  const orange = c.mat(0xff8a2a, { metalness: 0.3, roughness: 0.4 });
  const dark = c.mat(0x2a3038, { metalness: 0.5, roughness: 0.4 });
  // Anel do pescoço (onde o capacete encaixaria).
  mesh(new THREE.TorusGeometry(0.13, 0.03, 10, 28).rotateX(Math.PI / 2), silver, c.torso, new THREE.Vector3(0, 0.66, 0.0));
  mesh(new THREE.TorusGeometry(0.13, 0.012, 8, 28).rotateX(Math.PI / 2), orange, c.torso, new THREE.Vector3(0, 0.68, 0.0));
  // Painel de controle no peito, com luzinhas.
  mesh(new THREE.BoxGeometry(0.16, 0.1, 0.04), silver, c.torso, new THREE.Vector3(0, 0.5, -0.25));
  mesh(new THREE.BoxGeometry(0.13, 0.07, 0.01), dark, c.torso, new THREE.Vector3(0, 0.5, -0.272));
  const lights: THREE.MeshStandardMaterial[] = [];
  [0x3affc8, 0xff3a3a, 0xffd23a].forEach((col, i) => {
    const m = c.mat(col, { emissive: col, emissiveIntensity: 2 });
    lights.push(m);
    mesh(new THREE.SphereGeometry(0.011, 8, 6), m, c.torso, new THREE.Vector3(-0.035 + i * 0.035, 0.51, -0.278));
  });
  // Mochila de suporte de vida nas costas, com dois tubos até o peito.
  const pack = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.32, 0.14), silver);
  pack.position.set(0, 0.5, 0.38);
  pack.castShadow = true;
  c.torso.add(pack);
  mesh(new THREE.BoxGeometry(0.31, 0.04, 0.15), orange, c.torso, new THREE.Vector3(0, 0.6, 0.38));
  for (const s of [-1, 1]) {
    mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.3, 14), silver, c.torso, new THREE.Vector3(s * 0.1, 0.48, 0.47));
    const tube = new THREE.CatmullRomCurve3([
      new THREE.Vector3(s * 0.13, 0.62, 0.33),
      new THREE.Vector3(s * 0.24, 0.6, 0.05),
      new THREE.Vector3(s * 0.14, 0.52, -0.22),
    ]);
    mesh(new THREE.TubeGeometry(tube, 16, 0.016, 8, false), dark, c.torso);
  }
  return lights;
}

// ------------------------------------------------------------------ panda-vermelho biônico (Faísca)

/**
 * Cabeça de panda-vermelho: rosto redondo e ruivo, focinho curto e bochechas
 * brancas, "sobrancelhas" brancas, as listras escuras que descem dos olhos e
 * orelhas com borda branca. O olho direito é biônico (lente ciano com aro de
 * metal e uma placa presa à têmpora, com antena). Devolve as luzes que pulsam.
 */
export function redPandaHead(c: PartsContext): THREE.MeshStandardMaterial[] {
  const rust = new THREE.Color(c.palette.skin);
  const white = new THREE.Color(0xf8f0e4);
  const dark = new THREE.Color(0x4a160c);
  const center = new THREE.Vector3(0, 0.2, 0.02);
  const R = 0.18;
  // Rosto largo e redondo, focinho curto e bochechas fofas.
  const sculpt: Sculpt = (v) => {
    const u = v.clone();
    const front = smooth(0, 1, -u.z);
    v.z -= front * front * 0.34;
    v.x *= 1 - 0.38 * front * front;
    v.y = v.y * (1 - 0.25 * front) - 0.08 * front;
    v.x *= 1 + 0.2 * smooth(0.4, 0.9, Math.abs(u.x)) * smooth(0.2, -0.4, u.y);
    if (v.y < -0.5) v.y = -0.5 + (v.y + 0.5) * 0.5;
  };
  const paint = (u: THREE.Vector3, out: THREE.Color) => {
    const front = smooth(0, 1, -u.z);
    const muzzle = smooth(-0.02, -0.22, u.y) * smooth(0.35, 0.7, front);
    const cheek = smooth(0.5, 0.78, Math.abs(u.x)) * smooth(0.12, -0.2, u.y) * smooth(-0.2, 0.3, -u.z);
    // Pinta branca em cima de cada olho.
    let brow = 0;
    for (const s of [-1, 1]) brow = Math.max(brow, 1 - smooth(0.06, 0.13, Math.hypot(u.x - s * 0.3, u.y - 0.5, u.z + 0.8)));
    // Listra escura que desce de cada olho até o canto da boca.
    const tear = smooth(0.13, 0.2, Math.abs(u.x)) * smooth(0.42, 0.3, Math.abs(u.x)) * smooth(0.32, 0.12, u.y) * smooth(-0.25, -0.05, u.y) * smooth(0.45, 0.75, front);
    out.copy(rust).lerp(white, Math.max(muzzle, cheek, brow));
    out.lerp(dark, tear * 0.85);
    out.multiplyScalar(0.92 + 0.08 * noise(u.x * 3, u.y * 3, u.z * 3));
  };
  const { geo, at } = sculpted(sculpt, R, center, 56, paint);
  const furMat = c.mat(0xffffff, { vertexColors: true, map: furTexture(), bumpMap: furTexture(), bumpScale: 0.8, roughness: 0.9 });
  mesh(geo, furMat, c.head);
  mesh(new THREE.CylinderGeometry(0.09, 0.11, 0.08, 16), c.mat(0x3a1a10, { map: furTexture(), roughness: 0.9 }), c.head, new THREE.Vector3(0, 0.03, 0.04));
  // Nariz preto e boquinha.
  mesh(new THREE.SphereGeometry(0.024, 14, 10).scale(1.3, 0.85, 1), c.mat(0x0c0806, { roughness: 0.1 }), c.head, at(0, 0.02, -1, 0.006));
  const mouth: THREE.Vector3[] = [];
  for (let i = 0; i <= 8; i++) {
    const a = -0.6 + (i / 8) * 1.2;
    mouth.push(at(Math.sin(a) * 0.8, -0.28, -Math.cos(a), 0.002));
  }
  line(mouth, 0.004, c.mat(0x2a1008), c.head);

  const lights: THREE.MeshStandardMaterial[] = [];
  const glow = c.mat(c.palette.eyes, { emissive: c.palette.eyes, emissiveIntensity: 2.4, roughness: 0.1 });
  lights.push(glow);
  const steel = c.mat(0xb8c4cc, { metalness: 0.8, roughness: 0.3 });
  const copper = c.mat(c.palette.accent, { metalness: 0.75, roughness: 0.35 });
  // Olho esquerdo: grande, escuro e brilhante (panda-vermelho de verdade).
  {
    const p = at(-0.33, 0.33, -0.85, -0.004);
    mesh(new THREE.SphereGeometry(0.034, 18, 14).scale(1, 1, 0.55), c.mat(0x120806, { roughness: 0.08 }), c.head, p);
    mesh(new THREE.SphereGeometry(0.009, 10, 8), c.mat(0xffffff, { emissive: 0xffffff, emissiveIntensity: 0.7 }), c.head, p.clone().add(new THREE.Vector3(0.01, 0.012, -0.016)));
  }
  // Olho direito biônico: aro de metal, lente que brilha e placa na têmpora com antena.
  {
    const p = at(0.33, 0.33, -0.85, 0.002);
    const g = new THREE.Group();
    g.position.copy(p);
    g.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, -1), new THREE.Vector3(0.3, 0.05, -1).normalize());
    c.head.add(g);
    mesh(new THREE.TorusGeometry(0.03, 0.008, 10, 24), steel, g);
    mesh(new THREE.CylinderGeometry(0.026, 0.026, 0.016, 20).rotateX(Math.PI / 2), c.mat(0x0a1418, { metalness: 0.5, roughness: 0.2 }), g, new THREE.Vector3(0, 0, 0.003));
    mesh(new THREE.SphereGeometry(0.018, 16, 12).scale(1, 1, 0.5), glow, g, new THREE.Vector3(0, 0, -0.005));
    // Parafusos de cobre em volta do aro.
    for (let k = 0; k < 4; k++) {
      const a = (k / 4) * Math.PI * 2 + Math.PI / 4;
      mesh(new THREE.SphereGeometry(0.006, 8, 6), copper, g, new THREE.Vector3(Math.cos(a) * 0.042, Math.sin(a) * 0.042, 0.002));
    }
    // Antena com ponta de luz.
    const base = at(0.62, 0.62, 0.1, 0);
    const ant = mesh(new THREE.CylinderGeometry(0.005, 0.007, 0.14, 8).translate(0, 0.07, 0), steel, c.head, base);
    ant.rotation.z = -0.35;
    mesh(new THREE.SphereGeometry(0.014, 10, 8), glow, ant, new THREE.Vector3(0, 0.145, 0));
  }
  // Orelhas arredondadas: borda branca por fora, ruivo-escuro por dentro.
  for (const s of [-1, 1]) {
    const ear = new THREE.Group();
    ear.position.copy(at(s * 0.6, 0.7, 0.05, -0.02));
    ear.rotation.set(-0.1, 0, -s * 0.38);
    c.head.add(ear);
    // Triângulo de pontas arredondadas (cone achatado), borda branca e miolo escuro.
    const rim = mesh(new THREE.ConeGeometry(0.062, 0.13, 16).translate(0, 0.065, 0), c.mat(0xf8f0e4, { map: furTexture(), roughness: 1 }), ear);
    rim.scale.set(1, 1, 0.45);
    const inner = mesh(new THREE.ConeGeometry(0.044, 0.095, 14).translate(0, 0.05, 0), c.mat(0x5a1e10, { map: furTexture(), roughness: 1 }), ear, new THREE.Vector3(0, 0.008, -0.016));
    inner.scale.set(1, 1, 0.35);
  }
  // Tufos brancos nas bochechas.
  for (const s of [-1, 1]) {
    for (let k = 0; k < 2; k++) {
      const t = mesh(new THREE.ConeGeometry(0.032, 0.08, 8).translate(0, 0.04, 0), c.mat(0xf8f0e4, { map: furTexture(), roughness: 1 }), c.head, at(s * 0.86, -0.25 - k * 0.12, -0.12 + k * 0.1, -0.02));
      t.rotation.set(0.3, 0, -s * (1.6 + k * 0.3));
    }
  }
  return lights;
}

/** Cauda de panda-vermelho: longa e peluda, com anéis ruivos e claros; dois anéis de metal na base. */
export function redPandaTail(c: PartsContext): THREE.Group {
  const root = new THREE.Group();
  root.position.set(0, 0.12, 0.3);
  // Para trás e um pouco para cima (o quadril do modelo é baixo; caída, ela arrastava no chão).
  root.rotation.x = -0.5;
  const len = 1.0;
  const geo = new THREE.SphereGeometry(1, 28, 24);
  const pos = geo.getAttribute('position');
  const rust = new THREE.Color(c.palette.skin);
  const pale = new THREE.Color(0xe8b48a);
  const tip = new THREE.Color(0x3a140a);
  const colors = new Float32Array(pos.count * 3);
  const col = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const t = (z + 1) / 2; // 0 = base, 1 = ponta
    const r = 0.08 + 0.13 * Math.sin(Math.PI * Math.pow(t, 0.7));
    pos.setXYZ(i, x * r, y * r + Math.sin(t * 2.4) * 0.2, t * len);
    // Anéis: alterna ruivo e claro; ponta escura.
    const ring = 0.5 + 0.5 * Math.cos(t * Math.PI * 2 * 4.5);
    col.copy(rust).lerp(pale, smooth(0.55, 0.85, ring)).lerp(tip, smooth(0.86, 0.96, t));
    colors.set([col.r, col.g, col.b], i * 3);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  mesh(geo, c.mat(0xffffff, { vertexColors: true, map: furTexture(), bumpMap: furTexture(), bumpScale: 0.8, roughness: 0.95 }), root);
  // Anéis de metal biônicos perto da base (um com faixa de luz).
  const steel = c.mat(0xb8c4cc, { metalness: 0.8, roughness: 0.3 });
  const glow = c.mat(c.palette.eyes, { emissive: c.palette.eyes, emissiveIntensity: 2 });
  for (const [z, light] of [[0.08, false], [0.16, true]] as const) {
    const rr = 0.08 + 0.13 * Math.sin(Math.PI * Math.pow(z / len, 0.7)) + 0.008;
    const y = Math.sin((z / len) * 2.4) * 0.2;
    mesh(new THREE.CylinderGeometry(rr, rr, 0.035, 20, 1, true).rotateX(Math.PI / 2), steel, root, new THREE.Vector3(0, y, z));
    if (light) mesh(new THREE.TorusGeometry(rr + 0.002, 0.006, 6, 24), glow, root, new THREE.Vector3(0, y, z));
  }
  c.hips.add(root);
  return root;
}

/** Peças biônicas do corpo: núcleo de energia no peito, ombreira mecânica no braço do arco e cabos. Devolve as luzes. */
export function bionicParts(c: PartsContext): THREE.MeshStandardMaterial[] {
  const steel = c.mat(0xb8c4cc, { metalness: 0.8, roughness: 0.3 });
  const copper = c.mat(c.palette.accent, { metalness: 0.75, roughness: 0.35 });
  const dark = c.mat(0x22282c, { metalness: 0.5, roughness: 0.45 });
  const glow = c.mat(c.palette.eyes, { emissive: c.palette.eyes, emissiveIntensity: 2.6, roughness: 0.1 });
  // Núcleo no peito: aro de cobre, vidro e luz.
  const core = new THREE.Vector3(0, 0.5, -0.27);
  mesh(new THREE.TorusGeometry(0.055, 0.014, 10, 28), copper, c.torso, core);
  mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.02, 24).rotateX(Math.PI / 2), dark, c.torso, core.clone().add(new THREE.Vector3(0, 0, 0.004)));
  mesh(new THREE.SphereGeometry(0.035, 16, 12).scale(1, 1, 0.5), glow, c.torso, core.clone().add(new THREE.Vector3(0, 0, -0.008)));
  // Ombreira mecânica (lado do arco): placas de aço em camadas e luzinhas.
  const sh = new THREE.Vector3(-0.34, 0.6, 0);
  for (let k = 0; k < 3; k++) {
    const plate = mesh(new THREE.SphereGeometry(0.115 - k * 0.012, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2), k % 2 ? copper : steel, c.torso, sh.clone().add(new THREE.Vector3(-k * 0.025, -k * 0.045, 0)));
    plate.rotation.z = 0.55 + k * 0.15;
  }
  for (let k = 0; k < 2; k++) mesh(new THREE.SphereGeometry(0.012, 8, 6), glow, c.torso, sh.clone().add(new THREE.Vector3(-0.07, 0.04 - k * 0.04, -0.07)));
  // Cabos do núcleo até a ombreira.
  for (const dz of [0, 0.03]) {
    const tube = new THREE.CatmullRomCurve3([
      core.clone().add(new THREE.Vector3(-0.05, 0.02, 0.02 + dz)),
      new THREE.Vector3(-0.2, 0.6, -0.22 + dz),
      sh.clone().add(new THREE.Vector3(0.02, -0.02, -0.08 + dz)),
    ]);
    mesh(new THREE.TubeGeometry(tube, 14, 0.011, 6, false), dz ? copper : dark, c.torso);
  }
  return [glow];
}

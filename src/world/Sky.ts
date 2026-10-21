// Céu em degradê, sol com sombras que acompanham o jogador, névoa e nuvens.
import * as THREE from 'three';
import { Random } from '../core/random';
import { cloudGeometry } from './props';

const HORIZON = new THREE.Color(0xd6ecf5);
const ZENITH = new THREE.Color(0x4f9ad8);
const SUN_DIR = new THREE.Vector3(-0.45, 0.75, 0.35).normalize();

export class Sky {
  readonly sun: THREE.DirectionalLight;
  private readonly clouds: THREE.Group;
  private readonly shadowRange = 45;

  constructor(scene: THREE.Scene, seed: number) {
    scene.background = HORIZON.clone();
    scene.fog = new THREE.Fog(HORIZON.clone(), 70, 290);

    const dome = new THREE.Mesh(
      new THREE.SphereGeometry(800, 32, 16),
      new THREE.ShaderMaterial({
        side: THREE.BackSide,
        depthWrite: false,
        fog: false,
        uniforms: {
          horizon: { value: HORIZON },
          zenith: { value: ZENITH },
          sunDir: { value: SUN_DIR },
        },
        vertexShader: /* glsl */ `
          varying vec3 vDir;
          void main() {
            vDir = normalize(position);
            vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            gl_Position = p.xyww;
          }`,
        fragmentShader: /* glsl */ `
          uniform vec3 horizon;
          uniform vec3 zenith;
          uniform vec3 sunDir;
          varying vec3 vDir;
          void main() {
            float h = max(vDir.y, 0.0);
            vec3 col = mix(horizon, zenith, pow(h, 0.6));
            float s = max(dot(normalize(vDir), sunDir), 0.0);
            col += vec3(1.0, 0.9, 0.7) * (pow(s, 600.0) * 1.5 + pow(s, 12.0) * 0.18);
            gl_FragColor = vec4(col, 1.0);
          }`,
      }),
    );
    dome.renderOrder = -1;
    dome.frustumCulled = false;
    dome.name = 'sky';
    scene.add(dome);

    scene.add(new THREE.HemisphereLight(0xcfe8ff, 0x5a6b3a, 1.1));

    this.sun = new THREE.DirectionalLight(0xfff1d6, 2.4);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    const cam = this.sun.shadow.camera;
    cam.left = -this.shadowRange;
    cam.right = this.shadowRange;
    cam.top = this.shadowRange;
    cam.bottom = -this.shadowRange;
    cam.near = 1;
    cam.far = 220;
    this.sun.shadow.bias = -0.0006;
    this.sun.shadow.normalBias = 0.04;
    scene.add(this.sun);
    scene.add(this.sun.target);

    // Nuvens low-poly que passam devagar.
    const rng = new Random(seed ^ 0x5eed);
    this.clouds = new THREE.Group();
    const cloudMat = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true, fog: false, emissive: 0x9aa8b8 });
    for (let i = 0; i < 16; i++) {
      const cloud = new THREE.Mesh(cloudGeometry(rng), cloudMat);
      const a = rng.range(0, Math.PI * 2);
      const d = rng.range(80, 330);
      cloud.position.set(Math.cos(a) * d, rng.range(75, 110), Math.sin(a) * d);
      cloud.rotation.y = rng.range(0, Math.PI * 2);
      cloud.scale.setScalar(rng.range(0.8, 1.6));
      this.clouds.add(cloud);
    }
    scene.add(this.clouds);
  }

  /** Mantém a área de sombra centrada no jogador e move as nuvens. */
  update(focus: THREE.Vector3, dt: number): void {
    // Encaixa o centro em múltiplos do texel da sombra para não "tremer".
    const texel = (this.shadowRange * 2) / this.sun.shadow.mapSize.x;
    const fx = Math.round(focus.x / texel) * texel;
    const fz = Math.round(focus.z / texel) * texel;
    this.sun.target.position.set(fx, focus.y, fz);
    this.sun.position.set(fx + SUN_DIR.x * 100, focus.y + SUN_DIR.y * 100, fz + SUN_DIR.z * 100);

    for (const cloud of this.clouds.children) {
      cloud.position.x += dt * 1.2;
      if (cloud.position.x > 340) cloud.position.x = -340;
    }
  }
}

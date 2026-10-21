// Céu com atmosfera física (espalhamento de luz) e nuvens, sol com sombras que
// acompanham o jogador, névoa de distância e iluminação ambiente tirada do
// próprio céu (os materiais refletem a cor do céu).
import * as THREE from 'three';
import { Sky as SkyMesh } from 'three/examples/jsm/objects/Sky.js';
import { windUniforms } from './materials';

/** Direção do sol (de onde vem a luz). Elevação ~35°, vindo do oeste/sul. */
const SUN_DIR = new THREE.Vector3(-0.55, 0.62, 0.42).normalize();
const FOG_COLOR = new THREE.Color(0xbfd2e2);

export class Sky {
  readonly sun: THREE.DirectionalLight;
  /** Cores usadas pela grama (que tem iluminação própria). */
  readonly sunColor = new THREE.Color(1.0, 0.92, 0.78);
  readonly ambientColor = new THREE.Color(0.42, 0.5, 0.62);
  private readonly sky: SkyMesh;
  private readonly shadowRange: number;

  constructor(scene: THREE.Scene, renderer: THREE.WebGLRenderer, shadowMapSize: number) {
    scene.background = FOG_COLOR.clone();
    scene.fog = new THREE.FogExp2(FOG_COLOR.clone(), 0.0032);

    this.sky = new SkyMesh();
    this.sky.scale.setScalar(900);
    const u = this.sky.material.uniforms;
    u.turbidity.value = 4.5;
    u.rayleigh.value = 1.4;
    u.mieCoefficient.value = 0.004;
    u.mieDirectionalG.value = 0.82;
    u.sunPosition.value.copy(SUN_DIR).multiplyScalar(450000);
    u.cloudCoverage.value = 0.38;
    u.cloudDensity.value = 0.55;
    u.cloudScale.value = 0.00025;
    this.sky.name = 'sky';
    scene.add(this.sky);

    // Iluminação ambiente a partir do céu (PBR).
    const pmrem = new THREE.PMREMGenerator(renderer);
    const envScene = new THREE.Scene();
    const envSky = new SkyMesh();
    envSky.scale.setScalar(900);
    for (const key of Object.keys(u)) {
      const v = u[key].value;
      envSky.material.uniforms[key].value = v instanceof THREE.Vector3 ? v.clone() : v;
    }
    envSky.material.uniforms.cloudCoverage.value = 0;
    envScene.add(envSky);
    scene.environment = pmrem.fromScene(envScene, 0, 0.1, 1000).texture;
    scene.environmentIntensity = 0.3;
    pmrem.dispose();

    scene.add(new THREE.HemisphereLight(0xbfd8ff, 0x4a5a32, 0.22));

    this.sun = new THREE.DirectionalLight(0xffe9cc, 3.2);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(shadowMapSize, shadowMapSize);
    this.shadowRange = shadowMapSize >= 4096 ? 55 : 42;
    const cam = this.sun.shadow.camera;
    cam.left = -this.shadowRange;
    cam.right = this.shadowRange;
    cam.top = this.shadowRange;
    cam.bottom = -this.shadowRange;
    cam.near = 1;
    cam.far = 260;
    this.sun.shadow.bias = -0.0004;
    this.sun.shadow.normalBias = 0.05;
    this.sun.shadow.radius = 2;
    scene.add(this.sun);
    scene.add(this.sun.target);
  }

  /** Mantém a área de sombra centrada no jogador e anima nuvens e vento. */
  update(focus: THREE.Vector3, dt: number): void {
    const texel = (this.shadowRange * 2) / this.sun.shadow.mapSize.x;
    const fx = Math.round(focus.x / texel) * texel;
    const fz = Math.round(focus.z / texel) * texel;
    this.sun.target.position.set(fx, focus.y, fz);
    this.sun.position.set(fx + SUN_DIR.x * 120, focus.y + SUN_DIR.y * 120, fz + SUN_DIR.z * 120);
    this.sky.material.uniforms.time.value += dt;
    windUniforms.uTime.value += dt;
  }
}

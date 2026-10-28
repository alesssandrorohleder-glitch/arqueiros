// Céu com atmosfera física (espalhamento de luz) e nuvens, sol com sombras que
// acompanham o jogador, névoa de distância e iluminação ambiente tirada do
// próprio céu (os materiais refletem a cor do céu).
import * as THREE from 'three';
import { Sky as SkyMesh } from 'three/examples/jsm/objects/Sky.js';
import { windUniforms } from './materials';

/** Direção do sol (de onde vem a luz). Elevação ~35°, vindo do oeste/sul. */
const SUN_DIR = new THREE.Vector3(-0.55, 0.62, 0.42).normalize();
// Névoa azul-clara (perspectiva aérea), mais leve: a paisagem não fica "lavada".
const FOG_COLOR = new THREE.Color(0xb6cde3);

export class Sky {
  readonly sun: THREE.DirectionalLight;
  /** Cores usadas pela grama (que tem iluminação própria): sol dourado, sombra azulada. */
  readonly sunColor = new THREE.Color(1.05, 0.88, 0.62);
  readonly ambientColor = new THREE.Color(0.34, 0.46, 0.66);
  private readonly sky: SkyMesh;
  private readonly shadowRange: number;
  private readonly hemi: THREE.HemisphereLight;
  private readonly scene: THREE.Scene;

  constructor(scene: THREE.Scene, renderer: THREE.WebGLRenderer, shadowMapSize: number) {
    this.scene = scene;
    scene.background = FOG_COLOR.clone();
    scene.fog = new THREE.FogExp2(FOG_COLOR.clone(), 0.0024);

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
    scene.environmentIntensity = 0.36;
    pmrem.dispose();

    // Céu azul preenchendo as sombras (sombras azuladas e suaves), chão verde refletindo.
    this.hemi = new THREE.HemisphereLight(0x9cc4ff, 0x3a5a26, 0.34);
    scene.add(this.hemi);

    // Sol de fim de tarde: dourado e quente.
    this.sun = new THREE.DirectionalLight(0xffd9a2, 3.4);
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
  /**
   * Modo Mínimo (PC muito fraco): sem o céu calculado (com nuvens, pesado em cada pixel
   * do alto da tela) e sem a luz ambiente refletida do céu; névoa mais perto esconde o
   * horizonte que deixa de ser desenhado. A luz azul do céu compensa o ambiente.
   */
  setMinimum(): void {
    this.sky.visible = false;
    (this.scene.fog as THREE.FogExp2).density = 0.011;
    this.scene.environment = null;
    this.hemi.intensity = 1.1;
  }

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

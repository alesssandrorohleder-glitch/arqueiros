// Parede da zona (modo Último de pé): cortina roxa listrada em volta do círculo
// seguro, que some para cima e perto da câmera (quando a câmera atravessa a
// parede ela não cobre a tela).
import * as THREE from 'three';
import type { ZoneState } from '../systems/zone';

const HEIGHT = 90;

export class ZoneView {
  readonly mesh: THREE.Mesh;
  private readonly uniforms = {
    uTime: { value: 0 },
    uColor: { value: new THREE.Color(0xa64dff) },
    uOpacity: { value: 0.45 },
  };

  constructor() {
    const geo = new THREE.CylinderGeometry(1, 1, 1, 128, 1, true).translate(0, 0.5, 0);
    const mat = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        varying float vDist;
        void main() {
          vUv = uv;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          vDist = -mv.z;
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: /* glsl */ `
        uniform float uTime;
        uniform vec3 uColor;
        uniform float uOpacity;
        varying vec2 vUv;
        varying float vDist;
        void main() {
          float stripes = 0.5 + 0.5 * sin(vUv.x * 900.0 + vUv.y * 60.0 - uTime * 3.0);
          float fadeUp = 1.0 - smoothstep(0.05, 0.6, vUv.y);
          float base = smoothstep(0.0, 0.02, vUv.y) * 0.6 + 0.4;
          float a = uOpacity * (0.45 + 0.55 * stripes) * fadeUp * base * smoothstep(1.5, 9.0, vDist);
          gl_FragColor = vec4(uColor * (1.0 + 0.4 * stripes), a);
        }`,
    });
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 3;
  }

  update(z: ZoneState, dt: number): void {
    this.uniforms.uTime.value += dt;
    // Fechando: mais forte e pulsando.
    this.uniforms.uOpacity.value = z.shrinking ? 0.55 + 0.1 * Math.sin(this.uniforms.uTime.value * 6) : 0.4;
    this.mesh.visible = z.r > 0.3;
    this.mesh.position.set(z.cx, -12, z.cz);
    this.mesh.scale.set(Math.max(0.3, z.r), HEIGHT, Math.max(0.3, z.r));
  }
}

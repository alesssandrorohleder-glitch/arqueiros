// Terreno em grade regular. A altura usada na física é interpolada pelos
// mesmos triângulos da malha desenhada, então o personagem pisa exatamente
// no chão que aparece na tela.

export class Heightfield {
  readonly cells: number;
  readonly cellSize: number;
  readonly halfSize: number;
  readonly heights: Float32Array;
  private readonly stride: number;

  constructor(halfSize: number, cellSize: number, heightFn: (x: number, z: number) => number) {
    this.halfSize = halfSize;
    this.cells = Math.round((halfSize * 2) / cellSize);
    this.cellSize = (halfSize * 2) / this.cells;
    this.stride = this.cells + 1;
    this.heights = new Float32Array(this.stride * this.stride);
    for (let j = 0; j <= this.cells; j++) {
      for (let i = 0; i <= this.cells; i++) {
        this.heights[j * this.stride + i] = heightFn(this.coord(i), this.coord(j));
      }
    }
  }

  /** Coordenada do mundo do vértice de índice `i`. */
  coord(i: number): number {
    return -this.halfSize + i * this.cellSize;
  }

  vertexHeight(i: number, j: number): number {
    return this.heights[j * this.stride + i];
  }

  /**
   * Altura do terreno em (x, z). Cada célula é dividida pela diagonal que vai
   * de (i+1, j) a (i, j+1) — a mesma usada em `forEachTriangle`.
   */
  sample(x: number, z: number): number {
    const fx = (x + this.halfSize) / this.cellSize;
    const fz = (z + this.halfSize) / this.cellSize;
    const i = Math.min(Math.max(Math.floor(fx), 0), this.cells - 1);
    const j = Math.min(Math.max(Math.floor(fz), 0), this.cells - 1);
    const tx = Math.min(Math.max(fx - i, 0), 1);
    const tz = Math.min(Math.max(fz - j, 0), 1);
    const h00 = this.vertexHeight(i, j);
    const h10 = this.vertexHeight(i + 1, j);
    const h01 = this.vertexHeight(i, j + 1);
    const h11 = this.vertexHeight(i + 1, j + 1);
    if (tx + tz <= 1) return h00 + (h10 - h00) * tx + (h01 - h00) * tz;
    return h11 + (h01 - h11) * (1 - tx) + (h10 - h11) * (1 - tz);
  }

  /** Percorre todos os triângulos em ordem anti-horária vista de cima. */
  forEachTriangle(cb: (ax: number, ay: number, az: number, bx: number, by: number, bz: number, cx: number, cy: number, cz: number) => void): void {
    for (let j = 0; j < this.cells; j++) {
      const z0 = this.coord(j);
      const z1 = this.coord(j + 1);
      for (let i = 0; i < this.cells; i++) {
        const x0 = this.coord(i);
        const x1 = this.coord(i + 1);
        const h00 = this.vertexHeight(i, j);
        const h10 = this.vertexHeight(i + 1, j);
        const h01 = this.vertexHeight(i, j + 1);
        const h11 = this.vertexHeight(i + 1, j + 1);
        cb(x0, h00, z0, x0, h01, z1, x1, h10, z0);
        cb(x1, h11, z1, x1, h10, z0, x0, h01, z1);
      }
    }
  }
}

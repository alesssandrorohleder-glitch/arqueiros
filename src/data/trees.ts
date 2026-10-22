// Árvores do mapa: tamanhos por idade e a árvore anciã que dá para escalar.

/** Classes de idade das árvores comuns. `weight` = chance relativa de cada uma. */
export interface TreeAge {
  name: string;
  weight: number;
  /** Escala do modelo (1 = pinheiro de ~7,5 m / árvore de copa de ~6 m). */
  scale: [number, number];
  /** Engrossa o tronco (só largura), para árvores velhas parecerem mais robustas. */
  girth: number;
}

export const TREE_AGES: TreeAge[] = [
  { name: 'nova', weight: 0.15, scale: [0.55, 0.75], girth: 0.85 },
  { name: 'adulta', weight: 0.55, scale: [0.85, 1.2], girth: 1 },
  { name: 'antiga', weight: 0.3, scale: [1.45, 2.0], girth: 1.3 },
];

/**
 * Árvore anciã escalável: tronco gigante com degraus de tábua em espiral até
 * uma plataforma com parapeito no topo (bom ponto de tiro, mas exposto).
 * Medidas em metros.
 */
export const ANCIENT_TREE = {
  /** Altura do piso da plataforma. */
  deckHeight: 12,
  /** Altura de cada degrau. Precisa ser menor que MOVEMENT.stepHeight (0,45) para subir andando. */
  stepRise: 0.4,
  /** Giro entre degraus (rad). Menor = escada mais "fechada". */
  stepAngle: 0.42,
  /** Largura do degrau (ao longo da volta) e até onde ele sai do centro do tronco. */
  stepWidth: 1.6,
  stepOuterRadius: 3.7,
  /** Raio da plataforma e altura do parapeito. */
  deckRadius: 5.8,
  railHeight: 1.0,
  /** Altura dos primeiros galhos e da copa acima do piso da plataforma (alto = vista livre lá em cima). */
  canopyClearance: 5.5,
  /** Raio do tronco (colisão) embaixo, no meio e em cima. */
  trunkRadius: [1.75, 1.5, 1.3] as [number, number, number],
};

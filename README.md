# Arqueiros

Jogo de tiro com arco PVP para navegador, feito com **Three.js + TypeScript + Vite**.
Visual estilizado-realista (céu físico, grama ao vento, texturas geradas por código), câmera em
terceira pessoa por cima do ombro.

## Rodar

```bash
npm install
npm run dev      # http://localhost:5174
npm run build    # build de produção em dist/
```

**Computador:** WASD andar · mouse mirar · segurar botão esquerdo puxa o arco, soltar atira · botão direito cancela ·
Shift correr · Espaço pular · Esc pausar · F3 informações.
**Celular:** arraste à esquerda para andar, à direita para mirar; botões Atirar (segurar/soltar), Pular e Pausar.

Parâmetros de teste na URL: `?debug=1`, `?skin=elf|mage|lizard|robot|fox|owl`, `?nolock=1`.

## Design e andamento

Tudo sobre o jogo — etapas, o que já existe e onde ajustar o balanceamento — está em
[`GAME_DESIGN.md`](GAME_DESIGN.md).

# Arqueiros — Documento de Design

> Documento vivo: deve ser atualizado a cada mudança no jogo.
> Rodar: `npm install` e `npm run dev` (abre em http://localhost:5174).

## Estado atual

**Etapa concluída:** 1 — projeto base, mapa, personagem andando com câmera em terceira pessoa.
**Próxima etapa:** 2 — mecânica do arco (segurar, carregar, soltar, flecha com física e acerto em alvos).

### O que já existe (etapa 1)
- Projeto Vite + TypeScript + Three.js, com a estrutura de pastas do design (abaixo).
- **Simulação separada da renderização**: passo fixo de 60 ticks/s (`core/GameLoop.ts`); o estado
  (`GameState`, `CharacterState`) é feito de objetos simples, sem Three.js. A entrada vira um
  `InputCommand` serializável, que é o que bots e jogadores em rede vão enviar no futuro.
  A renderização interpola entre os dois últimos ticks.
- **Mapa "Ruínas da Clareira"** (`data/maps/arena.ts`), gerado com semente fixa (sai sempre igual):
  arena jogável de 180 × 180 m cercada por montanhas; morros; templo central com colunas em dois
  níveis; torre de vigia com escada no morro nordeste (dá para subir até o topo); muros em ruínas,
  arcos e entulho como cobertura; 6 áreas de floresta (pinheiros e árvores frondosas); grupos de
  pedras; trilhas de terra; grama, flores e nuvens. Estética low-poly com sombreamento chapado.
- **Colisão própria** (`systems/collision.ts`): caixas giradas e cilindros + terreno. O personagem
  desliza nas paredes, sobe degraus de até 0,45 m andando e bate a cabeça em tetos.
  Também há **raycast** (usado pela câmera e, na etapa 2, pelas flechas).
- **Movimento** (`systems/movement.ts`): WASD relativo à câmera, aceleração/desaceleração suaves,
  Shift para correr (só para frente), pulo com *coyote time* e *jump buffer*, controle reduzido no ar.
- **Câmera por cima do ombro direito** (`core/CameraRig.ts`) com pointer lock; se aproxima quando
  há parede atrás e o campo de visão abre um pouco ao correr.
- **Personagem Humano caçador** com modelo geométrico (capuz, aljava, arco) e animação procedural
  (andar, correr inclinado, pular, respiração). Os 7 personagens já estão em `data/characters.ts`
  com atributos e cores; por enquanto todos usam o mesmo corpo (visual próprio na etapa 6).
- **HUD**: mira central, tela de início/pausa com controles, painel de informações (F3).

### Parâmetros de teste na URL
- `?debug=1` — mostra FPS, posição e estatísticas de renderização (também alterna com F3).
- `?skin=elf` (ou `mage`, `lizard`, `robot`, `fox`, `owl`) — joga com outro personagem.
- `?nolock=1` — aceita o teclado sem capturar o mouse (para testes automáticos).

### Onde mexer no balanceamento
| O quê | Arquivo |
|---|---|
| Velocidades, aceleração, pulo, gravidade, degrau | `src/data/movement.ts` |
| Distância/ombro/FOV da câmera | `src/data/camera.ts` |
| Vida, velocidade, pulo e hitbox de cada personagem | `src/data/characters.ts` |
| Layout do mapa (morros, ruínas, florestas, pedras, spawns) | `src/data/maps/arena.ts` |
| Sensibilidade do mouse, gráficos (salvos no `localStorage`) | `src/data/settings.ts` |

### Estrutura de pastas
```
src/
  core/      loop de passo fixo, entrada, câmera, orquestrador (Game.ts), matemática, aleatório
  entities/  estado puro dos personagens, comando de entrada, visual (CharacterView)
  systems/   colisão/raycast, física de movimento (futuro: combate, spawn, loot)
  data/      balanceamento e conteúdo (personagens, movimento, câmera, mapas, configurações)
  world/     geração do mapa: terreno, ruínas, vegetação, céu e luz
  ui/        HUD e menus
```

### Histórico
- **Etapa 1** — base do projeto, mapa, movimento e câmera.

---

## Pedido original (referência)

Você é um desenvolvedor de jogos sênior. Vamos construir, em etapas, um jogo de tiro com arco PVP para navegador. Crie o projeto do zero, com código organizado e fácil de modificar, porque vou evoluir o jogo aos poucos.

## Stack técnica
- **Three.js** para o 3D, **TypeScript** e **Vite** como bundler.
- Física simples própria (gravidade da flecha, colisão por caixas/esferas) ou **Rapier** se precisar.
- Arquitetura em módulos: `core/` (loop, input, câmera), `entities/` (jogador, bots, mobs, flechas), `systems/` (combate, spawn, loot), `data/` (personagens, arcos, raridades em JSON/TS), `ui/` (HUD, menus).
- Toda configuração de balanceamento (dano, velocidade, tempo de carga, taxas de drop) deve ficar em arquivos de dados, nunca fixa no código.
- Preparar o código para multiplayer futuro: separar estado do jogo da renderização e da entrada, para depois trocar bots por jogadores reais via WebSocket (Colyseus ou Socket.IO).

## Câmera e movimento
- Câmera em **terceira pessoa por cima do ombro** (estilo Fortnite/Archero 3D): vejo meu personagem e o campo de visão à frente.
- Movimento com **WASD** (frente, trás, lados), mouse para mirar/girar a câmera (pointer lock), **Espaço** para pular, **Shift** para correr.
- Movimento suave com aceleração e desaceleração; colisão com o cenário.

## Mecânica de tiro (central do jogo)
- **Segurar o botão esquerdo** = puxar a corda (engatilhar). Mostrar animação de puxar e uma barra/círculo de carga na mira.
- **Soltar** = dispara a flecha na direção da mira.
- Quanto mais tempo carregado (até o máximo do arco), maior a velocidade, alcance e dano da flecha.
- Mira abre (fica imprecisa) ao andar e fecha ao ficar parado com o arco puxado.
- Flecha é um projétil físico com trajetória em arco (gravidade), não um raio instantâneo.
- Segurar puxado por tempo demais cansa o braço: a mira começa a tremer.
- Dano extra em acerto na cabeça. Mostrar número de dano flutuante e indicador de acerto.

## Mapa e modo inicial
- Um mapa inicial médio (arena com floresta, ruínas, elevações e cobertura).
- Modo inicial: **jogador vs bots** (PVP simulado). Bots com IA básica: patrulham, procuram o jogador, se escondem, puxam o arco e atiram com precisão variável por dificuldade.
- **Mobs** que surgem ao longo da partida em pontos de spawn (criaturas neutras/hostis). Matar mobs dá XP e chance de drop de arcos.
- Partida com tempo limite e placar de eliminações; zona segura que diminui é uma melhoria futura.

## Personagens (skins)
Cada personagem é uma skin com visual próprio e estatísticas levemente diferentes (vida, velocidade, tamanho da hitbox equilibrada). Começar com modelos simples (formas geométricas estilizadas ou modelos low-poly gratuitos) e deixar fácil trocar por modelos .glb depois. Classes iniciais:
- **Elfa arqueira** — delicada, ágil.
- **Arqueiro-mago** — flechas com rastro mágico.
- **Lagarto arqueiro** — humanoide réptil, escamas.
- **Robô arqueiro** — metálico, olhos luminosos.
- **Raposa arqueira** — animal humanoide.
- **Coruja arqueira** — animal humanoide com asas.
- **Humano caçador** — o personagem base.

Os dados de cada personagem ficam em `data/characters.ts` para eu adicionar novos facilmente.

## Arcos e raridades
Raridades com cor própria em tudo (ícone, brilho, rastro da flecha):
| Raridade | Cor | Chance de drop sugerida |
|---|---|---|
| Comum | cinza | 55% |
| Incomum | verde | 25% |
| Raro | azul | 12% |
| Épico | roxo | 6% |
| Lendário | dourado | 2% |

- Cada arco tem: dano, tempo máximo de carga, velocidade da flecha, estabilidade da mira e, a partir do épico, um efeito especial (flecha explosiva, perfurante, de gelo que desacelera, que ricocheteia, múltiplas flechas).
- Arcos dropam de mobs e baús no mapa; também ganha-se arcos ao subir de nível.
- Inventário simples para equipar arco e escolher skin, salvo em `localStorage` por enquanto.

## Interface (HUD e menus)
- HUD: vida, mira com indicador de carga, arco equipado com cor da raridade, placar, tempo da partida, mini-mapa simples.
- Menu inicial: Jogar, Personagens (skins), Arsenal (arcos), Configurações (sensibilidade do mouse, volume, gráficos).
- Tela de fim de partida com eliminações, XP ganho e itens obtidos.

## Ordem de desenvolvimento
Construa em etapas e pare ao fim de cada uma para eu testar:
1. Projeto base, mapa simples, personagem andando com câmera em terceira pessoa.
2. Mecânica de arco: segurar, carregar, soltar, flecha com física e acerto em alvos.
3. Bots com IA básica e sistema de vida/dano/eliminação.
4. Spawn de mobs, XP e drops.
5. Sistema de raridades e arcos com efeitos.
6. Personagens/skins e menus.
7. Polimento: sons, partículas, animações, otimização.
8. (Futuro) Multiplayer online real.

## Regras para você, Claude Code
- Antes de cada etapa, explique rapidamente o plano; depois implemente.
- Mantenha este `GAME_DESIGN.md` atualizado com o que mudou.
- Código comentado em português nos pontos de balanceamento.
- O jogo deve rodar com `npm install` e `npm run dev`, e funcionar bem no Chrome a 60 fps em computador comum.

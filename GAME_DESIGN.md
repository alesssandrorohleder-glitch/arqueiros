# Arqueiros — Documento de Design

> Documento vivo: deve ser atualizado a cada mudança no jogo.
> Rodar: `npm install` e `npm run dev` (abre em http://localhost:5174).

## Estado atual

**Etapa concluída:** 7 — polimento: sons, partículas, animações, otimização.
**Próxima etapa:** 8 — multiplayer online real (futuro).

### O que já existe (etapa 7)
- **Sons por síntese** (`core/Audio.ts`, Web Audio, nenhum arquivo baixado): puxar a corda, soltar
  (mais forte com mais carga), tique de acerto, acerto no corpo/cabeça ("ding"), flecha cravando,
  abate, morte, dano recebido, explosão, gelo, ricochete, passos (mais altos correndo), pulo, queda,
  rosnado do lobo, grunhido do javali, ronco do golem, morte de mob, item (mais notas quanto mais raro),
  clique de menu, fanfarra de fim de partida, vento ambiente e pássaros. Sons com posição: pan estéreo
  e volume pela distância (somem além de 80 m). O volume das Configurações vale. O áudio liga no
  primeiro toque/clique (regra dos navegadores).
- **Partículas** (`entities/EffectsView.ts`): terra quando a flecha crava, faíscas no acerto (douradas
  na cabeça), poeira nos passos correndo, fumaça quando um mob morre, brilho na cor da raridade ao
  pegar um item (além de explosão, gelo e ricochete da etapa 5).
- **Animações**: tremor de câmera em explosões próximas e ao levar dano (só visual, não mexe na mira),
  tranco do braço ao soltar a flecha, tronco recua ao levar flechada, agachadinha ao aterrissar.
- **Otimização**: grade espacial dos colisores (`ColliderGrid` em `systems/collision.ts`) usada pela
  física, raycasts, flechas e bots; hitboxes calculadas uma vez por fase do tick. Resultado: 5 min de
  partida simulada caíram de ~8,9 s para ~0,9 s de CPU. Resolução dinâmica no modo gráfico
  Automático: baixa se o FPS ficar abaixo de ~38 e sobe se passar de ~58.

### O que já existe (etapa 6)
- **7 personagens com visual próprio** (`entities/characterParts.ts`, sobre o corpo base do
  `CharacterView`): Humano caçador (capuz), Elfa (cabelo longo, orelhas pontudas, tiara), Arqueiro-mago
  (chapéu, barba, túnica; flechas com rastro mágico), Lagarto (focinho, crista de espinhos, cauda),
  Robô (metálico, visor e olhos luminosos, antena, painel no peito), Raposa (focinho, orelhas, cauda com
  ponta branca), Coruja (disco facial, olhos grandes, bico, tufos, asas que abrem no pulo). Caudas
  balançam ao andar.
- **Menu principal / pausa** (`ui/Menu.ts`): Jogar/Continuar, Personagens, Arsenal, Configurações,
  cartão do perfil e ajuda de controles; mostra a versão do build.
- **Personagens**: cartões dos 7, prévia 3D girando (`ui/CharacterPreview.ts`), vida/velocidade/pulo
  e "Escolher" (troca na hora e salva na conta).
- **Arsenal**: todos os arcos por raridade com dano, carga, velocidade, estabilidade e efeito; os que
  o jogador tem podem ser equipados (salvo na conta); os outros aparecem apagados.
- **Configurações** (salvas no navegador, `data/settings.ts`): sensibilidade do mouse, do toque (olhar)
  e do arrastar no Atirar, inverter eixo vertical, volume (sons na etapa 7) e gráficos
  (Automático/Baixo/Médio/Alto, vale ao recarregar).
- **Fim de partida**: XP, abates, criaturas, mortes e os arcos obtidos na partida.

### O que já existe (etapa 5)
- **Efeitos especiais** (épico em diante; números em `data/combat.ts` → `EFFECTS`, lógica em
  `systems/bow.ts` e `systems/projectiles.ts`):
  - **Múltiplas flechas** (Arco da tempestade): 3 flechas em leque, 60% do dano cada.
  - **Gelo** (Arco da geada): alvo 50% mais lento por 2,5 s (personagens e mobs), com tom azulado.
  - **Perfurante** (Arco perfurante): atravessa até 2 alvos, mantendo 75% do dano a cada um.
  - **Ricochete** (Arco dos ecos): quica até 2 vezes em terreno, pedras, árvores e ruínas (reflete
    na normal da superfície), perdendo um pouco de velocidade e dano.
  - **Explosiva** (Arco do Sol): explode no impacto; dano em área de 3,2 m que cai com a distância;
    quem atirou não se fere.
- **Raridade em tudo**: rastro da flecha (efeitos com rastro brilhante), brilho do arco na mão
  (mais forte quanto mais raro), ícone e painel do arco com o efeito, aviso de item colorido.
- **Efeitos visuais** (`entities/EffectsView.ts`): explosão (clarão, bola de fogo, fumaça, faíscas e
  uma luz reaproveitada), estilhaços de gelo, faísca de ricochete.
- **Trocar de arco**: Q (ou botão "Arco" no celular) passa pelos arcos da conta; a escolha é salva.
  O comando de troca vai no `InputCommand` (`equipBowId`), pronto para o servidor validar.
- Bots com arcos variados (`BOT_ROSTER.bowId`): Lirien usa Arco recurvo, Ruivo Arco longo élfico,
  Mestre Oru Arco da tempestade.
- Teste sem navegador (cada bot com um arco especial): ~100 explosões, ~150 ricochetes, ~20 congelamentos
  em 5 min.
- Parâmetros de teste: `?bow=sun` (usa qualquer arco nesta sessão, sem salvar) e `?gfx=low|medium|high`.

### O que já existe (etapa 4)
- **Mobs** (`data/mobs.ts`, `systems/mobs.ts`): Javali (neutro: só ataca quem o atacou), Lobo sombrio
  (hostil, rápido, pouca vida) e Golem de pedra (hostil, raro, lento e resistente). Vagam perto do ponto
  de origem, perseguem, atacam corpo a corpo com preparação (dá para desviar) e voltam para casa se forem
  longe demais (recuperando a vida). Hitbox com cabeça à frente nos quadrúpedes.
- **Surgimento**: pontos em `data/maps/arena.ts` (`mobSpawns`: tipos, máximo vivo, raio); o intervalo cai
  de 22 s para 10 s ao longo da partida; limite global de 14 mobs (`MOB_SPAWNING`).
- **XP**: matar mob dá XP na hora (número dourado); o XP da partida aparece no topo e soma no perfil no fim.
- **Drops** (`systems/loot.ts`): cada mob tem chance de deixar um arco; raridade sorteada pelas chances de
  `data/rarities.ts` (o golem sorteia duas vezes e fica com a melhor). O arco fica no chão com feixe de luz
  na cor da raridade por 60 s; passar por cima pega, e se for de raridade maior é equipado na hora.
  O arco vai para o inventário da conta (`ownedBows`) e o equipado (`bowId`) é salvo.
- **Arcos** novos em `data/bows.ts`: Arco curto (Comum), Arco de teixo e Arco recurvo (Incomum), Arco longo
  élfico e Arco composto (Raro), Arco da tempestade e Arco da geada (Épico), Arco do Sol (Lendário).
  Os efeitos especiais (épico+) entram na etapa 5.
- Bots também se defendem de mobs e caçam os que os atacam.
- Teste sem navegador (5 min): ~28 mobs eliminados, ~11 arcos largados; distribuição de raridade conferida
  em 20 mil sorteios (55/25/12/6/2%).

### Contas de jogador (pedido extra, junto da etapa 3)
- Tela inicial com **Entrar / Criar conta / Jogar como convidado** (`ui/AccountScreen.ts`).
- `account/AccountService.ts` escolhe o tipo de conta: **online** (Supabase, `account/SupabaseBackend.ts`,
  tabela `profiles` com RLS em `supabase/schema.sql`) quando `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY`
  existem; senão **local** (`account/LocalBackend.ts`, localStorage, senha com hash PBKDF2 + sal).
- **Perfil** (`account/profile.ts`): nome, personagem, arco equipado, arcos possuídos, XP, estatísticas.
  O nome do perfil aparece no placar; no fim da partida o resultado vira XP e estatísticas e é salvo.
- **Progressão** (`data/progression.ts`): XP por abate, bônus de tiro na cabeça, por acerto, vitória,
  top 3 e participação; custo de cada nível cresce linearmente.
- Cartão do perfil na tela de pausa (nível, barra de XP, estatísticas, trocar/excluir conta).

### O que já existe (etapa 3)
- **Partida todos contra todos** de 5 min: você + 5 bots (`data/bots.ts` → `BOT_ROSTER`), cada um com
  um personagem e dificuldade. Regras em `data/match.ts` (duração, tempo para voltar, proteção).
- **IA dos bots** (`systems/ai/BotBrain.ts`): roda dentro da simulação e gera `InputCommand`s, igual
  a um jogador. Estados: patrulha (anda desviando de obstáculos, pula se travar), combate (mantém
  distância, anda de lado, mira com balística e prevê o movimento do alvo), cobertura (vai para trás de
  árvore/pedra/ruína quando leva dano ou está com pouca vida) e busca (vai até onde viu o inimigo).
  Percepção a 10 Hz com campo de visão e linha de visada. Dificuldades fácil/normal/difícil mudam
  reação, erro de mira, visão, previsão e vontade de se esconder.
- **Vida e eliminação** (`systems/combat.ts`): vida zerada = eliminado (tomba), volta em 3 s no ponto
  mais longe dos inimigos com 1,5 s de proteção (pisca). Abate vai para o último que causou dano.
- **HUD de combate** (`ui/CombatHUD.ts`): barra de vida, tela vermelha + seta da direção do tiro,
  lista de abates, tempo/abates/mortes/posição, placar no Tab, tela "Eliminado por…", fim de partida
  com "Jogar de novo", nome e vida sobre os bots.
- Teste sem navegador: 5 min simulados levam ~4 s de CPU; bots trocam ~360 tiros e ~20 eliminações.

### Visual (atualizado após a etapa 2, a pedido: "mais realista")
A estética saiu do low-poly facetado e foi para um visual **estilizado-realista**, ainda sem
arquivos externos (tudo é gerado por código, então o jogo continua leve e sem licenças):
- **Céu físico** com espalhamento de luz e nuvens (`world/Sky.ts`); a iluminação ambiente e os
  reflexos vêm do próprio céu; névoa de distância; exposição ajustada para o céu HDR.
- **Texturas procedurais** (`world/textures.ts`): grama, terra, rocha, blocos de pedra, casca e folhas.
- **Terreno liso** com mistura de texturas por shader (grama, trilha, rocha nas encostas, neve no alto).
- **Grama densa animada pelo vento** (`world/Grass.ts`): até 140 mil lâminas numa área que acompanha
  o jogador, desenhadas na GPU.
- **Árvores com folhagem em cartões** (folhas e agulhas com transparência) balançando com o vento.
- **Pedras arredondadas e ruínas texturizadas** com musgo nas faces de cima (`world/materials.ts`).
- **Personagem** com formas arredondadas (cápsulas e esferas) no lugar das caixas.
- **Pós-processamento**: brilho suave no sol (`core/PostFX.ts`).
- **Perfis de qualidade** (`core/quality.ts`): `low` (celular, automático), `medium`, `high`.
  Controlam resolução, sombras, quantidade de grama e pós-processamento.
- Limite atual: personagens ainda são geométricos. Para realismo de verdade, o próximo passo é usar
  modelos `.glb` com animação (campo `modelUrl` em `data/characters.ts`).

### O que já existe (etapa 2)
- **Arco** (`systems/bow.ts`): segurar o botão esquerdo puxa a corda; a carga (0–100%) aumenta velocidade,
  alcance e dano da flecha. Soltar atira; soltar cedo demais (< 0,12 s) ou apertar o botão direito cancela.
  Puxando, anda-se mais devagar, não dá para correr e o corpo acompanha a mira.
- **Mira**: dispersão abre ao andar/pular e fecha parado (cone com desvio aleatório determinístico).
  Segurar no máximo além do `holdTime` do arco cansa o braço e a mira treme cada vez mais.
- **Flecha** (`systems/projectiles.ts`): projétil com gravidade e colisão contínua (não atravessa nada);
  sai da mão do arco em direção ao ponto sob a mira; crava no cenário e nos alvos.
- **Dano** (`systems/combat.ts`, `systems/hitboxes.ts`): hitbox de corpo (cilindro) e cabeça (esfera);
  cabeça = dano ×2. Bonecos de treino tombam ao zerar a vida e voltam em 4 s.
- **Simulação** (`core/Simulation.ts`): estado da partida (personagens, flechas, alvos) e eventos
  (`core/events.ts`: tiro, acerto, abate) separados da renderização.
- **Visual/HUD**: pose de puxar com corda esticando e flecha encaixada; câmera aproxima ao mirar;
  anel de carga na mira (dourado no máximo, vermelho cansado) e marcas de dispersão; marcador de acerto
  (laranja na cabeça); números de dano flutuantes; arco equipado com a cor da raridade; contagem de
  tiros/acertos. No celular, botão **Atirar**: segurar puxa, arrastar o mesmo dedo mira, soltar atira.
- **Dados**: `data/bows.ts` (arcos), `data/combat.ts` (gravidade da flecha, dispersão, headshot, cansaço),
  `data/rarities.ts` (cores e chances de drop).

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
- **Celular** (`ui/TouchControls.ts`): joystick no lado esquerdo (empurrar até a borda corre), arrastar
  no lado direito para mirar, botões Pular e Pausar. No celular a resolução e a sombra são reduzidas.

### Parâmetros de teste na URL
- `?debug=1` — mostra FPS, posição e estatísticas de renderização (também alterna com F3).
- `?skin=elf` (ou `mage`, `lizard`, `robot`, `fox`, `owl`) — joga com outro personagem.
- `?nolock=1` — aceita o teclado sem capturar o mouse (para testes automáticos).

### Onde mexer no balanceamento
| O quê | Arquivo |
|---|---|
| Velocidades, aceleração, pulo, gravidade, degrau | `src/data/movement.ts` |
| Distância/ombro/FOV da câmera | `src/data/camera.ts` |
| Vida, velocidade, pulo, hitbox e cores de cada personagem | `src/data/characters.ts` |
| Formas de cada personagem (cabeça, cauda, asas...) | `src/entities/characterParts.ts` |
| Dano, carga, velocidade da flecha, estabilidade de cada arco | `src/data/bows.ts` |
| Gravidade da flecha, dispersão, headshot, cansaço, bonecos, efeitos especiais | `src/data/combat.ts` |
| Bots da partida e dificuldades | `src/data/bots.ts` |
| Duração da partida, volta, proteção | `src/data/match.ts` |
| XP por partida e curva de níveis | `src/data/progression.ts` |
| Mobs (vida, dano, velocidade, XP, chance de drop), ritmo de surgimento, itens | `src/data/mobs.ts` |
| Layout do mapa (morros, ruínas, florestas, pedras, spawns) | `src/data/maps/arena.ts` |
| Qualidade gráfica (grama, sombras, resolução) | `src/core/quality.ts` |
| Sensibilidade do mouse/toque/Atirar, gráficos (salvos no `localStorage`) | `src/data/settings.ts` |

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
- **Etapa 1.1** — controles de toque para testar no celular.
- **Etapa 2** — arco, flechas com física, mira, dano/headshot e bonecos de treino.
- **Etapa 3** — bots com IA, vida, eliminação, partida com tempo e placar.
- **Etapa 7** — sons sintetizados com posição, partículas, tremor de câmera, animações de reação, grade espacial (simulação ~10× mais rápida), resolução dinâmica.
- **Etapa 6** — visual próprio dos 7 personagens, menu principal/pausa, Personagens com prévia 3D, Arsenal, Configurações.
- **Ajuste de mira (sniper do COD Mobile)** — tocar em Atirar puxa a corda e o mesmo dedo vira a mira na hora (arrastar move, soltar atira; o dedo é seguido na tela toda). O escorregão do dedo nos últimos 70 ms antes de soltar é desfeito. A flecha sai compensando a queda para cair exatamente no ponto sob a mira (`COMBAT.compensateDrop`); dispersão zero parado e pequena andando/pulando. Teste: parado, 100% de acertos no ponto mirado (peito/cabeça) de 12 a 60 m com qualquer carga. Botão afastado da borda; andar puxando o arco a 85% da velocidade (antes 55%); mira abre menos ao andar; zoom ao puxar bem leve (FOV 67°).
- **Etapa 5** — efeitos dos arcos (múltiplas, gelo, perfurante, ricochete, explosiva), raridade em tudo, troca de arco.
- **Etapa 4** — mobs (javali, lobo, golem), XP na partida, drops de arcos com feixe de raridade.
- **Contas** — contas locais/online (Supabase), perfil com XP, nível e estatísticas.
- **Gráficos 2.1** — céu físico, texturas procedurais, grama ao vento, árvores com folhagem, perfis de qualidade.

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

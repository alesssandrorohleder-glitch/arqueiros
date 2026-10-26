# Arqueiros — Documento de Design

> Documento vivo: deve ser atualizado a cada mudança no jogo.
> Rodar: `npm install` e `npm run dev` (abre em http://localhost:5174).

## Estado atual

**Etapa concluída:** 9 — modelos 3D animados, Fúria e ajustes (multiplayer em espera, a pedido).
**Próximos passos possíveis:** zona segura que diminui, mais mapas e modos, mais animações (pulo com
impulso, reação a dano), publicar o servidor quando o multiplayer voltar.

### Nível na partida e assistências (a pedido)
- **Nível do personagem na partida (a partir do 1, sem limite)**: começa no 1 em toda partida e não cai ao renascer.
  Sobe com XP de abates (100), assistências (50), criaturas e tropas (o XP delas) e torres derrubadas
  (120 para o time todo). Cada nível acima do 1: **+5% de dano** e **+7 de vida máxima** (nível 10:
  +45% de dano, +63 de vida; nível 20: +95%, +133); ao subir, recupera um pouco de vida. Cada
  nível custa 45 XP a mais que o anterior (sem nível máximo, a pedido). Vale para jogador e bots.
  HUD: selo "Nv" com barra de XP acima da vida; número do nível ao lado do nome de cada um; coluna
  Nv no placar. Dados: `src/data/levels.ts`; lógica: `src/systems/levels.ts`.
- **Assistências**: quem causou dano na vítima nos últimos 10 s (e não deu o abate) ganha a
  assistência (+XP de nível e +40 XP de conta). Aparecem no registro de abates ("Kael + Lirien ➶
  Ravok"), no placar (coluna Assist.), no fim da partida e nas estatísticas da conta.
- O nível da **conta** (entre partidas) continua separado (`data/progression.ts`).

### Arco próprio de cada personagem e coleção de Skins (a pedido)
- **Sem arcos no chão**: criaturas não deixam mais arcos (o sistema de itens no chão saiu). Também
  não há mais troca de arco (Q / botão Arco) nem o menu Arsenal.
- **Cada personagem tem o seu arco** (`SIGNATURE_BOWS` e `CHARACTER_BOW` em `data/bows.ts`), com
  visual nas cores dele e um estilo de tiro: Kael — Arco Rubro (perfura); Sylwen — Folha de
  Lethariel (rápido e preciso); Eldrin — Arco Arcano (ricochete); Raszar — Arco de Osso de
  Crocodilo (dano alto); Cobalto — Arco Canhão (explosivo, lento); Fenna — Arco Orbital (o mais
  rápido); Noctua — Arco da Noite (tiro forte); Áurion — Arco Estelar (3 flechas); Ossurso — Arco da
  Montanha Gelada (gelo); Squalo — Arco do Recife (equilibrado). Aparece na tela Personagens.
- **Skins** (menu Skins, no lugar do Arsenal): **3 por personagem — rara, épica e lendária** (30 no total, `data/skins.ts`),
  só visual — recolore a roupa do modelo por categoria (tecido/couro/metal), a pele/pelo e a paleta
  das partes esculpidas. Kael, o Redimido · Sylwen do Outono · Eldrin, Mago das Chamas · Raszar
  Magmático · Cobalto Dourado · Fenna Ártica · Noctua das Neves · Áurion Cósmico · Ossurso Obsidiana ·
  Squalo Abissal. Bots às vezes aparecem com skin.
- **Pronto para venda**: cada skin tem categoria (rara/épica/lendária) e preço em moedas; o perfil
  guarda `ownedSkins` e `equippedSkins`. Hoje todas estão liberadas (`SKINS_FREE_FOR_NOW`). Para
  cobrar de verdade, a posse das skins pagas precisa ser gravada pelo servidor depois do pagamento
  (o perfil hoje é editável pelo próprio jogador) — trocar `ownsSkin` por essa verificação.

### Modo **Último de pé** (a pedido) — battle royale
Terceiro modo (menu, cartão 👑). Ruínas da Clareira, você + 9 bots, todos nascendo num anel em volta
do mapa. **Uma vida só, sem renascer**: vence o último vivo. Uma **zona roxa** fecha em 5 fases (espera
→ fecha) até sumir; cada círculo novo é **sorteado** dentro do anterior (o fim pode ser no centro ou num
canto, muda a cada partida). Fora dela se perde vida em pulsos, cada fase mais forte. HUD: vivos,
tempo da zona, aviso roxo "Fora da zona!"; minimapa com a zona (roxa) e a próxima (tracejada branca).
Fim: **4 s de comemoração** antes do placar — a câmera gira em volta do vencedor, que faz a animação
de comemoração (Cheer), com confete e faixa "VITÓRIA!" (ou "Fulano venceu!").
Eliminado: placar com a colocação (já salva na conta) e **Assistir** (a câmera segue quem te eliminou
ou outro vivo), Jogar de novo ou Voltar ao menu. Bots passeiam dentro do próximo círculo e correm
para dentro quando estão fora/na borda. Dados: `src/data/royale.ts`; lógica: `src/systems/zone.ts`;
parede: `src/entities/ZoneView.ts`.

### Dois modos de jogo (a pedido): Todos contra todos e **Gigantes**
O modo é escolhido no menu principal (cartões acima de "Jogar"; também na pausa, recomeçando a
partida). Trocar refaz o mapa na hora, sem recarregar a página (`Game.switchMode`). O último modo
fica salvo (Configurações). Teste: `?mode=giants` ou `#mode-giants`. Dados: `src/data/modes.ts`.
- **Todos contra todos** — o modo original: Ruínas da Clareira (`maps/arena.ts`), 5 bots, 5 minutos.
- **Gigantes** — 5 contra 5 no **Vale dos Gigantes** (`maps/giants.ts`). Jogador + 4 bots no time
  **Azul** (sul) contra 5 bots do **Vermelho** (norte). Os 9 bots estão em `BOT_ROSTER` (`data/bots.ts`).
  - Cada base tem um **gigante de pedra** (rochas esculpidas, runas e olhos brilhando na cor do time)
    e, no meio do mapa, **2 torres** (uma em cada trilha). O gigante fica numa **redoma** e não leva
    dano enquanto alguma torre do time estiver de pé; flechas na redoma soltam faíscas.
  - **Círculo de ataque** (a pedido): torres e gigantes só levam dano de quem está **dentro** do
    círculo em volta deles (cerca de luz no chão; torre 22 m, gigante 15 m — `attackArea`). De fora a
    flecha não fere (aviso "Longe demais!"). Assim é preciso entrar debaixo dos tiros, junto das tropas.
  - **Torres** atiram raios de cristal nos inimigos a até 24 m (tropas primeiro). O **gigante** ergue
    os punhos e esmaga o chão (dano em área) quando inimigos chegam perto.
  - **Tropas**: ondas de **mini golems** (azuis/vermelhos) saem de cada base a cada 25 s pelas
    trilhas oeste e leste, atacam o inimigo mais perto (tropas, arqueiros, torres e por fim o
    gigante) e ficam mais fortes com o tempo.
  - Aliados não se ferem (flechas atravessam aliados); nomes azuis = aliados, vermelhos = inimigos.
  - **Tempo crescente** (sem limite). A partida acaba quando um gigante cai ou um time **desiste**:
    votação pela pausa ("Desistir") ou pedida por um bot; com **3 votos "sim"** o time desiste
    (teclas **1** sim / **2** não, ou toque nos botões). Os bots votam conforme o placar.
  - Volta ao jogo na base do time, num tempo que cresce com a partida (5 s → 14 s).
  - Placar no topo: abates do time, torres (de pé/caídas) e vida do gigante de cada lado.
  - **Minimapa** (canto superior esquerdo, nos dois modos): trilhas, florestas, ruínas, torres
    (quadrados), gigantes (losangos, contorno branco = vulnerável), círculos de ataque, você (seta na
    direção da câmera), aliados e tropas aliadas. Inimigos só aparecem quando você ou alguém do time
    os vê (linha de visão até 55 m, ou a menos de 12 m). `src/ui/Minimap.ts`.
  - Bots: empurram a trilha até a próxima torre (depois o gigante), defendem estruturas atacadas e
    voltam para a base com pouca vida.
  - Regras e balanceamento: `src/data/objectives.ts`; lógica: `src/systems/objectives.ts`; visual:
    `src/entities/StructureView.ts`.

### Habilidades únicas (a pedido) — tecla **E** / botão na tela
Cada personagem tem uma habilidade com recarga (`data/abilities.ts`, lógica em `systems/abilities.ts`).
Roda na simulação: vale igual para jogador e bots (que usam por heurística em `BotBrain.decideAbility`).

| Personagem | Habilidade | Efeito | Recarga |
|---|---|---|---|
| Kael | Sede de Sangue | 6 s: flechas curam 35% do dano | 20 s |
| Sylwen | Passo Élfico | arrancada de ~8 m | 7 s |
| Eldrin | Escudo Arcano | bolha que absorve 45 de dano (6 s) | 18 s |
| Fenna | Propulsor | jato lança ~6,5 m e plana na descida | 10 s |
| Noctua | Olhar de Coruja | 8 s: +30% de dano e inimigos marcados através das paredes | 20 s |
| Cobalto | Pulso EMP | 22 de dano + lentidão a até 8 m | 16 s |
| Raszar | Regeneração | +50 de vida em 4 s | 20 s |
| Squalo | Investida | dispara e morde o primeiro inimigo (35) | 10 s |
| Ossurso | Armadura de Ossos | 6 s recebendo metade do dano | 18 s |
| Áurion | Teleporte Estelar | reaparece até 10 m à frente | 9 s |

- HUD: painel com a tecla E e a recarga (PC) e botão com anel de recarga (celular); o menu de
  Personagens mostra a habilidade de cada um. Efeitos visuais e sons próprios; aura na cor da
  habilidade enquanto dura.
- **Corrigido**: a cabeça (e às vezes braços/peito) ficava girando com o personagem parado. O giro
  aplicado por cima da animação acumulava quando a animação não mexia naquele osso; agora os ossos
  voltam à pose original a cada quadro (`ModelRig.overrideBones`).

### Noctua com penas e Fenna astronauta (a pedido)
- **Noctua**: textura de penas desenhada (fileiras sobrepostas com haste e relevo) na cabeça e nas
  asas; cabeça menos redonda (topo achatado, rosto largo e côncavo, sobrancelha em "V", base afinando);
  colar de penas em volta do disco facial, fileiras de penas na nuca e penas listradas no peito e ombros.
- **Fenna**: em vez de armadura (ficava igual ao Cobalto), um **traje metálico de astronauta** só no
  corpo (sem capacete e sem capa): roupa prata acetinada com detalhes laranja (`model.theme:
  'astronaut'`), anel de pescoço, painel com luzinhas no peito e mochila de suporte de vida com tubos.

### Kael do mal e Fenna de armadura (a pedido)
- **Kael** virou um arqueiro do mal em preto, vermelho e dourado: as cores da roupa são trocadas na
  textura (`model.theme: 'evil'` → verde vira preto, couro vira vermelho-sangue, metal vira dourado),
  pele pálida, olhos vermelhos brilhando no capuz, manto de pele preta, pena vermelha, ombreiras
  pretas com borda e espinhos dourados, broche dourado com pedra vermelha e aljava preta e dourada.
- **Fenna** agora usa armadura de metal polido (corpo do cavaleiro, sem o elmo).
- Metal mais bonito para todos (`ModelRig`: cor mais clara, menos rugoso, reflexo do céu reforçado):
  o Cobalto deixou de ficar quase preto. A prévia do menu ganhou um ambiente de "estúdio" para os
  metais refletirem.

### Upgrade e nomes de todos os personagens (a pedido)
- **Kael** (humano caçador): manto de pele nos ombros, pena vermelha no capuz e aljava de couro.
- **Sylwen** (elfa): orelhas longas com brincos, tiara dourada com joia verde que pulsa, ombreiras de
  folhas douradas e aljava élfica.
- **Eldrin** (mago): barba branca, estrela dourada brilhando no chapéu e orbes mágicos girando em volta.
- **Fenna** (raposa): cabeça esculpida com pelo, focinho fino, bochechas brancas, olhos amendoados âmbar
  com pupila em fenda, orelhas de ponta escura e cauda bem peluda com ponta branca.
- **Noctua** (coruja): disco facial claro com borda escura, olhos enormes cor de laranja, sobrancelhas,
  bico curvo, tufos de orelha e asas de camadas de penas.
- **Cobalto** (robô): cabeça própria com tela de vidro, olhos de luz e "boca" de barrinhas, fones com
  anéis de luz, antena e núcleo de energia no peito (as luzes pulsam).
- Código: `entities/creatureHeads.ts` (cabeças e acessórios), `CharacterView.modelExtras`.

### Cabeças novas: lagarto, homem-tubarão e urso esqueleto (a pedido)
- Nomes próprios: **Raszar** (lagarto), **Squalo** (homem-tubarão), **Ossurso** (urso esqueleto) e
  **Áurion** (pássaro-alien dourado).
- `entities/creatureHeads.ts`: as cabeças agora são **esculpidas** a partir de uma esfera bem dividida
  (focinho puxado para a frente, base achatada, órbitas afundadas...) e pintadas por vértice.
- **Lagarto**: focinho longo e achatado, textura de escamas, barriga clara, sorriso marcado, narinas,
  olhos de camaleão saltados com pupila em fenda e crista de babados.
- **Homem-tubarão**: cabeça hidrodinâmica com focinho pontudo, azul em cima e branco embaixo (borda
  ondulada), boca em meia-lua com duas fileiras de dentes, olhos pretos brilhantes, guelras curvas e
  barbatana recortada.
- **Áurion** (o pássaro-alien dourado ganhou nome): crânio alto e liso, dourado com reflexo rosado
  embaixo, olhos grandes de alien (amêndoas pretas com núcleo turquesa), bico curvo, pontinhos
  luminosos nas bochechas, antenas curvas com orbes e crista de penas longas; agora com manto roxo.
- **Urso esqueleto**: crânio largo com sobrancelha óssea e maçãs do rosto, órbitas fundas com brasas,
  cavidade nasal, dentes e caninos, mandíbula aberta, orelhas redondas e uma rachadura.

### Etapa 12: bots nas árvores, brilho dos arcos, abate na cabeça e 3 personagens (a pedido)
- **Bots sobem nas árvores** (`systems/ai/BotBrain.ts`, modos `climb` e `perch`; ajustes em
  `data/bots.ts → BOT_CLIMB`): na patrulha, às vezes escolhem a árvore anciã livre mais próxima (uma por
  bot), dão a volta no tronco até a escada, sobem degrau a degrau (atirando se virem alguém), ficam
  20–40 s lá em cima atirando e descem pulando o parapeito. O caminho vem de
  `world/ancientTree.ts → ancientTreeClimbPath`. Teste: as 4 árvores, chegando de 8 direções: 32/32
  subidas em 9–12 s.
- **Brilho e partículas nos arcos raros** (`entities/bowModels.ts → Sparkles`): raro = faíscas subindo e
  arco pulsando; épico = mais partículas + halo; lendário = muitas partículas + halo forte. Ao atirar, o
  arco dá um estouro de brilho e partículas.
- **Abate com tiro na cabeça**: câmera lenta curta (só offline), clarão dourado, onda de choque, chuva de
  faíscas e caveira subindo do inimigo, "HEADSHOT!" gigante (×2, ×3… em sequência), borda dourada,
  tremor e zoom na câmera, vibração e som próprio.
- **3 personagens novos** (`data/characters.ts`, cabeças em `entities/characterParts.ts`):
  Pássaro-alien dourado (olhos enormes brilhando, antenas, bico, crista e asas; pula muito alto, rastro
  mágico), Urso esqueleto (caveira de urso com brasas nos olhos, costelas e espinha; 125 de vida, lento)
  e Homem-tubarão (focinho pontudo, boca cheia de dentes, guelras, barbatanas na cabeça e nas costas,
  cauda de peixe; rápido).

### Etapa 11: arcos, efeitos, lápides, golem veloz, casas, lobos e som (a pedido)
- **Arcos com desenho próprio** (`entities/bowModels.ts`, aparência em `data/bows.ts → look`): os 11 arcos
  são maiores e cada um tem seu modelo. Comum = madeira simples; incomum = pano/latão; raro = ouro, folhas
  e joias; épico = brilho, espinhos, cristais de gelo ou lâminas; lendário = Arco dos Ecos (cópias
  fantasmas, anéis de runas girando, orbes) e Arco do Sol (disco solar com raios girando, asas douradas,
  chamas nas pontas). O arco no chão (drop) mostra o próprio modelo girando.
- **Flechas com mais efeito**: rastro de luz largo que afina e some (cor da raridade; quanto mais raro,
  mais largo), brilho na ponta, clarão e faíscas na saída do arco, e impacto com clarão colorido (maior
  em acertos na cabeça). A flecha encaixada na corda brilha na cor da raridade.
- **Lápide** (`entities/Tombstones.ts`): quando um personagem é eliminado, uma lápide com o nome dele
  sobe do chão no lugar, virada para quem eliminou, e afunda depois de 40 s.
- **Golem veloz** (`data/mobs.ts → swiftGolem`): mini golem de pedra azul, sempre no entulho a leste do
  templo (`SPECIAL_MOBS`). Quem o elimina ganha **Velocidade** por 30 s (`data/combat.ts → HASTE`):
  corre 40% mais, brilha em azul, solta poeira azul ao correr e aparece o contador "VELOCIDADE".
  A Fúria e a Velocidade usam o mesmo sistema de poderes de mob (`buff` no mob).
- **Árvores escaláveis**: escada mais larga (degraus de 1,6 m, até 3,7 m do centro) e copa/galhos
  5,5 m acima da plataforma (`ANCIENT_TREE.canopyClearance`), para a vista ficar livre lá em cima.
- **Menos árvores pequenas** (15% em vez de 30%) e **4 casas meio destruídas** (`world/ruins.ts →
  house`): paredes de pedra com topo quebrado, porta, janelas, uma parede desmoronada, chaminé,
  metade do telhado de vigas e entulho.
- **Barra de vida dos inimigos** menor e minimalista (fina, nome pequeno, encolhe com a distância).
- **Lobos** refeitos (`entities/wolfModel.ts`): pelo com textura gerada (fios + relevo), corpo que
  flexiona, juba, mandíbula com dentes, orelhas que mexem, pernas com joelho e cauda peluda em
  segmentos; trote, respiração, cauda com atraso e bote de boca aberta. O Lobo de brasa brilha seguindo
  os fios do pelo.
- **Som**: no celular o som podia não sair (chave de silencioso do iPhone, áudio pausado pelo sistema).
  Agora o jogo pede o modo "reprodução" (`navigator.audioSession`) e retoma o áudio a cada toque e ao
  voltar para a aba. Nova **música ambiente** gerada na hora (acordes + harpa com eco), com volume
  próprio em Configurações → Música.

### Árvores de vários tamanhos e árvores escaláveis (a pedido)
- **Idades das árvores** (`data/trees.ts → TREE_AGES`): novas (pequenas, 30%), adultas (45%) e antigas
  (até 2× maiores e de tronco mais grosso, 25%). A colisão acompanha o tamanho do tronco.
- **Árvores anciãs escaláveis** (`world/ancientTree.ts`, posições em `data/maps/arena.ts → climbTrees`):
  4 troncos gigantes com **escada de tábuas em espiral** (degraus de 0,4 m: sobe só andando, sem pular)
  até uma **plataforma a 12 m** com parapeito, debaixo de uma copa larga. Bom ponto de tiro, mas exposto.
  O parapeito (1 m) segura quem anda até a borda; dá para pular por cima para descer rápido. Um corrimão
  separa a plataforma do vão da escada.
- Medidas (altura, degraus, raio da plataforma, parapeito) em `data/trees.ts → ANCIENT_TREE`.
- Teste: um jogador automático sobe as 4 árvores até 12 m, anda pela plataforma e para no parapeito.

### Etapa 9: modelos 3D animados (a pedido)
- Personagens com **modelos 3D de verdade** (KayKit Adventurers, licença CC0 — livre, sem crédito
  obrigatório; autor: Kay Lousberg). Arquivos em `public/models/`: um `.glb` por corpo (~250 KB, só malha
  e esqueleto) e `anims.glb` (~400 KB) com 12 animações compartilhadas: parado, andar, andar de costas,
  correr, correr de lado, no ar, morrer etc. Total ~1,6 MB (os originais tinham 18 MB).
- `entities/ModelRig.ts`: carrega e clona o modelo, mistura as animações conforme a velocidade (pés
  acompanham o chão), e **por cima** gira braços e cabeça para a pose de tiro: braço esquerdo esticado na
  direção da mira, mão direita na corda; o arco geométrico segue a mão do modelo.
- Quem é quem (`data/characters.ts → model`): caçador = Rogue encapuzado; elfa = Rogue + orelhas;
  mago = Mage; robô = Knight metálico com visor e antena luminosos; lagarto = Barbarian com cabeça e cauda
  de lagarto e pele verde; raposa = Rogue com cabeça/cauda de raposa e pelo laranja; coruja = Knight sem
  elmo com cabeça de coruja. A cor da pele é trocada na textura (`skinColor`).
- Enquanto o modelo carrega (ou se falhar) aparece o personagem geométrico antigo.
- Para trocar um modelo: coloque um `.glb` com o mesmo esqueleto do KayKit em `public/models/` e mude
  `model.file` do personagem.

### Cadência mais lenta + Fúria (a pedido)
- **Cadência normal 1,8× mais lenta** (`COMBAT.fireIntervalScale`): o arco inicial vai de ~2,6 para
  ~1,5 flechas/s.
- **Lobo de brasa** (`data/mobs.ts → emberWolf`, `FRENZY_MOB`): lobo laranja brilhante, só um por vez;
  nasce aos 30 s e 45 s depois de cada um morrer. 90 de vida, hostil.
- **Fúria** (`data/combat.ts → FRENZY`): quem mata o Lobo de brasa ganha **30 s** de tiro rápido (a
  cadência antiga), fica brilhando em laranja forte, as flechas deixam rastro laranja, aparece uma borda
  laranja e o contador "FÚRIA · 30s" na tela (pisca nos últimos 3 s). Acaba ao morrer. Bots também
  disputam o lobo.

### Qualidade que piorava durante a partida (corrigido)
- A resolução automática baixava até 60% quando o FPS caía (celular esquentando ou limitado a 30 Hz) e
  quase nunca voltava. Agora (`Game.adaptResolution`): só reage abaixo de 28 FPS, primeiro desliga o
  bloom, **nunca fica abaixo de 1 pixel por pixel da tela** e volta a subir acima de 45 FPS.
- Medido: sem vazamento de memória (geometrias/texturas constantes; objetos estabilizam com as flechas
  cravadas no limite de 80).

### Bots acertando mais (a pedido)
- Erro de mira menor e reação mais rápida. Teste (bot contra jogador andando de lado, 16–25 m, com a
  nova cadência): Fácil acerta ~52% e elimina em ~12 s (antes ~28 s); Normal ~62% (~7 s); Difícil
  ~64% (~6 s).

### Novo tiro (a pedido): automático e instantâneo
- **Segurar = atirar sem parar**: uma flecha a cada `fireInterval` do arco (`data/bows.ts`). Não existe
  mais carregar/soltar, dispersão nem tremor de cansaço.
- **A flecha acerta exatamente onde está a mira** (`systems/hitscan.ts`): no disparo, uma linha reta sai
  do centro da mira e o que estiver nela leva o dano na hora. A flecha que se vê é o rastro visual
  (voa a 220 m/s pelo caminho do tiro e crava no fim). Perfurante, ricochete, explosão e gelo funcionam
  sobre essa linha; múltiplas flechas = 3 linhas em leque.
- Cada flecha causa `dano do arco × COMBAT.shotDamageFraction` (0,5): o arco inicial faz 20 por flecha,
  ~2,6 flechas/s; 5 no corpo ou 3 na cabeça eliminam.
- **Mira vermelha** quando há um inimigo sob ela. O auxílio de mira continua (ligado no celular).
- Corrigido: a 1ª flecha de cada rajada usava a mira do tick anterior.
- Teste: 100% das flechas no ponto mirado (bonecos de 12 a 60 m, peito e cabeça) e 40/40 num inimigo
  andando de lado a 20 e 35 m.

### Bots mais fáceis (a pedido, depois reforçados na etapa 9)
- Dificuldades com cadência e dano próprios (`fireRate`, `damage`) e erro de mira que muda a cada 0,35 s.
- **Dificuldade dos bots** em Configurações (padrão **Fácil**): Fácil rebaixa todos os bots.
- **Vida regenera** 8/s depois de 5 s sem levar dano (`data/match.ts`).
- Teste (bot contra jogador andando de lado a 25 m): Fácil acerta ~22% (eliminaria em ~28 s sem
  regeneração), Normal ~32% (~10 s), Difícil ~41% (~6 s).

### O que já existe (etapa 8)
- **Servidor** (`server/index.ts`, `server/Room.ts`): Node + WebSocket (`ws`) em `/ws`, entrega também o
  site (`dist/`) e tem `/health`. Salas de até 8 jogadores, completadas com bots até 6 participantes;
  partidas de 5 min com 12 s de placar entre elas. 60 ticks/s, 20 snapshots/s (~18 KB/s por jogador).
- **Autoritativo**: o servidor roda a mesma `Simulation`; o cliente manda só `InputCommand`s numerados
  (`net/protocol.ts`, comandos são limpos em `sanitizeCommand`). Se os comandos atrasam, o servidor
  repete o último por no máximo 0,1 s.
- **Cliente** (`net/NetClient.ts` + modo online do `core/Game.ts`): previsão do próprio movimento e do
  arco (`predictBow`), reconciliação com o snapshot (reaplica comandos ainda não confirmados),
  interpolação dos outros jogadores/mobs/flechas entre snapshots, flechas cravadas mantidas no cliente,
  disparo sentido na hora (som, tranco, vibração) sem esperar o servidor. Eventos do servidor viram
  sons/partículas/HUD como no offline.
- **Menu**: "Jogar online" (se houver servidor) e "Treino offline (bots)"; queda de conexão volta ao menu.
- **Publicação**: `npm run build:online && npm start`; `render.yaml` para o Render (passo a passo no README).
- **Acertos mais fáceis** (pedido): flechas ~25% mais rápidas, raio de acerto da flecha 0,12 m e
  **auxílio de mira** (`COMBAT.aimAssistAngle`, ~3°): ao soltar, se um inimigo está quase sob a mira e
  sem parede no caminho, a flecha vai nele prevendo o movimento. Ligado por padrão no celular,
  configurável. Teste contra alvo andando de lado: 20 m 0→17/20, 35 m 10→20/20, 50 m 0→9/20.
- **Flecha maior** e **vibração/tranco de câmera** ao disparar (vibração só onde o navegador permite,
  ex.: Android/Chrome; desligável em Configurações).

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
- **Personagens**: cartões dos 10, prévia 3D (`ui/CharacterPreview.ts`) que se gira arrastando com o
  dedo/mouse (com embalo; inclina a câmera na vertical; volta a girar sozinha após 5 s parada),
  vida/velocidade/pulo, habilidade, **História** de cada um (`story` em `data/characters.ts`) e
  "Escolher" (troca na hora e salva na conta).
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
- `?mode=giants` (ou `ffa`, `royale`) — começa num modo de jogo.

### Onde mexer no balanceamento
| O quê | Arquivo |
|---|---|
| Velocidades, aceleração, pulo, gravidade, degrau | `src/data/movement.ts` |
| Distância/ombro/FOV da câmera | `src/data/camera.ts` |
| Modo Gigantes: torres, gigantes, tropas, votação, tempo de volta | `src/data/objectives.ts` |
| Modos de jogo (mapa, quantidade de bots) | `src/data/modes.ts` |
| Último de pé: fases da zona, dano, anel de nascimento | `src/data/royale.ts` |
| Vida, velocidade, pulo, hitbox e cores de cada personagem | `src/data/characters.ts` |
| Formas de cada personagem (cabeça, cauda, asas...) | `src/entities/characterParts.ts` |
| Dano e cadência (`fireInterval`) de cada arco | `src/data/bows.ts` |
| Cadência geral (`fireIntervalScale`) e Fúria (duração, cor) | `src/data/combat.ts` |
| Lobo de brasa (vida, ritmo de surgimento) | `src/data/mobs.ts` (`emberWolf`, `FRENZY_MOB`) |
| Aparência dos arcos (formato, tamanho, cores) | `src/data/bows.ts` (`look`) |
| Velocidade (duração, multiplicador) | `src/data/combat.ts` (`HASTE`) |
| Habilidades (recarga, duração, dano, distâncias) | `src/data/abilities.ts` |
| Bots subindo nas árvores (chance, distância, tempo lá em cima) | `src/data/bots.ts` (`BOT_CLIMB`) |
| Mobs especiais e onde nascem | `src/data/mobs.ts` (`SPECIAL_MOBS`) |
| Planta da casa em ruínas | `src/world/ruins.ts` (`house`) |
| Tamanhos das árvores e árvore anciã (altura, degraus, plataforma) | `src/data/trees.ts` |
| Posição das árvores escaláveis | `src/data/maps/arena.ts` (`climbTrees`) |
| Modelo 3D de cada personagem, cor da pele, partes escondidas | `src/data/characters.ts` (`model`) |
| Velocidade das animações, tom dos modelos | `src/entities/ModelRig.ts` (`ANIM_SPEED`, `MODEL_ALBEDO`) |
| Gravidade da flecha, dispersão, headshot, cansaço, bonecos, efeitos especiais | `src/data/combat.ts` |
| Bots da partida e dificuldades (mira, reação, cadência, dano) | `src/data/bots.ts` |
| Duração da partida, volta, proteção | `src/data/match.ts` |
| XP por partida e curva de níveis | `src/data/progression.ts` |
| Mobs (vida, dano, velocidade, XP, chance de drop), ritmo de surgimento, itens | `src/data/mobs.ts` |
| Auxílio de mira, raio da flecha | `src/data/combat.ts` |
| Jogadores por sala, bots, intervalo entre partidas | `server/Room.ts` |
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
- **Etapa 8** — servidor autoritativo com salas, previsão/reconciliação/interpolação, publicação no Render; auxílio de mira, flechas maiores e mais rápidas, vibração ao atirar.
- **Etapa 7** — sons sintetizados com posição, partículas, tremor de câmera, animações de reação, grade espacial (simulação ~10× mais rápida), resolução dinâmica.
- **Etapa 6** — visual próprio dos 7 personagens, menu principal/pausa, Personagens com prévia 3D, Arsenal, Configurações.
- **Ajuste de mira (sniper do COD Mobile)** — tocar em Atirar puxa a corda e o mesmo dedo vira a mira na hora (arrastar move, soltar atira; o dedo é seguido na tela toda). O escorregão do dedo nos últimos 70 ms antes de soltar é desfeito. A flecha sai compensando a queda para cair exatamente no ponto sob a mira (`COMBAT.compensateDrop`); dispersão zero parado e pequena andando/pulando. Teste: parado, 100% de acertos no ponto mirado (peito/cabeça) de 12 a 60 m com qualquer carga. Botão afastado da borda; andar puxando o arco a 85% da velocidade (antes 55%); mira abre menos ao andar; zoom ao puxar bem leve (FOV 67°).
- **Etapa 5** — efeitos dos arcos (múltiplas, gelo, perfurante, ricochete, explosiva), raridade em tudo, troca de arco.
- **Etapa 4** — mobs (javali, lobo, golem), XP na partida, drops de arcos com feixe de raridade.
- **Contas** — contas locais/online (Supabase), perfil com XP, nível e estatísticas.
- **Habilidades** — uma habilidade única por personagem (tecla E); correção da cabeça girando.
- **Histórias** — história de cada personagem no menu; prévia 3D gira com o dedo/mouse.
- **Fim de partida** — botão "Voltar ao menu" ao lado de "Jogar de novo" (zera a partida e abre o menu inicial, onde dá para trocar de modo ou personagem).
- **Desempenho** — peças pequenas sem sombra, sombras redesenhadas em quadros alternados, mobs/tropas a mais de 85 m não desenhados, formas dos mobs compartilhadas, pedras de torres/gigantes juntadas, HUD só mexe no DOM quando muda (modo Gigantes: ~1600 → ~790 chamadas de desenho).
- **Último de pé** — terceiro modo: uma vida, sem renascer, zona que fecha num lugar sorteado, vence o último vivo; assistir depois de eliminado.
- **Arcos e skins** — sem arcos no chão; um arco próprio por personagem; menu Skins com uma skin por personagem (preço guardado para a loja futura). Correção: prévia 3D do 1º personagem aparecia curvada (tempo negativo no 1º quadro).
- **Skins completas** — rara, épica e lendária para cada personagem (30). Coruja: cabeça centrada no pescoço (parecia solta/deslocada para trás ao andar; só nela). Arcos épicos/lendários com auréola menor. Sem o quadro do arco/raridade no jogo.
- **Níveis e assistências** — nível do personagem na partida (1 a 10, mais dano e vida a cada nível) e assistências de abate.
- **Skins do Kael** — rara: Assassino da Lua (violeta e prata); épica: o Redimido (branco, azul e ouro); lendária nova: o Campeão Dourado (ouro polido e carmim). A antiga rara (Caçador da Floresta) saiu.
- **Visual premium (começando pelo Raszar)** — sem novos modelos ou dependências: (1) `entities/premiumLook.ts` ajusta o shader padrão dos materiais do personagem com luz de contorno (rim light), relevo procedural (tecido/couro/escamas, calculado pela posição no modelo, já que a textura do KayKit é uma paleta de cores chapadas) e um pouco mais de saturação; ligado por `CharacterDef.premium`. (2) Cabeça do Raszar refeita (`raszarHead`): malha mais fina, escamas em relevo, dorso escuro e maxilar claro, sobrancelhas de escamas, olhos grandes e expressivos (íris âmbar pintada com fibras, pupila em fenda, córnea e dois reflexos, pálpebra de cima), presinhas e crista com membranas em degradê. (3) Equipamento (`raszarGear`): bandoleira de couro com rebites e dentes de crocodilo, cinto com fivela e bolsa, ombreira de couro de crocodilo com borda de metal. (4) Arco de Osso de Crocodilo entalhado (`BowLook.carved`): veios e losangos, anéis e ponteiras de ouro, empunhadura trançada com fio de ouro. (5) Skins com peças próprias (`CharacterModel.variant`): Pântano (musgo, cipó com folhas), Magmático (rachaduras de lava brilhando, espinhos de obsidiana, brasas), Dragão Dourado (chifres e bigodes dourados, medalhão de rubi, escamas de ouro na ombreira). Dimensões, raio e altura (hitbox) inalterados; o corpo passa a receber a própria sombra.
- **Novo personagem: Ringo (lêmure xerife do Velho Oeste)** — 100 de vida, +3% de velocidade, pulo +4%. Habilidade **Saque Rápido** (E): trava a mira em até 3 inimigos à vista num cone de ~60° à frente (até 35 m, sem parede no caminho; os mais perto da mira primeiro) e reparte 5 flechas certeiras entre eles, direto no peito (14 de dano cada: 70 num alvo só; 28/28/14 em três). Sem ninguém à vista, sai um leque para onde mira. Recarga 12 s (`quickdraw`; antes era só o leque na mira, difícil de acertar com todo mundo se mexendo). Arco próprio: Arco do Velho Oeste (raro). Visual: camisa jeans, couro marrom e latão, sem capa; cabeça de lêmure-de-cauda-anelada (rosto branco, alto cinza, máscara escura em gota em volta dos olhos âmbar, ponte do focinho escura), chapéu de caubói, bandana vermelha, estrela de xerife e cauda longa com 13 anéis pretos e brancos (`lemurHead`, `cowboyHat`, `sheriffGear`, `lemurTail`). Skins: Ringo do Deserto (rara: cor de areia, chapéu claro), Ringo, o Fora-da-Lei (épica: preto, pelo cor de fumaça, olhos vermelhos) e Ringo, Lenda de Ouro (lendária: branco e ouro, pelo prateado).
- **Botão de pular mais fácil** — maior (72 px) e com área de toque invisível em volta (tocar perto da borda também pula); folgas do pulo maiores: apertar até 0,2 s antes de pousar e até 0,15 s depois de sair do chão ainda pula (antes 0,12 s e 0,10 s; em descidas o pé "descolava" do chão e o aperto se perdia).
- **Nova personagem: Faísca (panda-vermelho biônico)** — 95 de vida, +5% de velocidade, pulo +6%. Habilidade **Sobrecarga** (E): por 5 s atira 50% mais rápido e anda 15% mais rápido (recarga 18 s; `overclock`). Arco próprio: Arco de Bambu Biônico (raro, sem efeito especial). Visual: corpo de batedor verde-petróleo com couro cor de cobre, sem capa; cabeça de panda-vermelho esculpida (focinho e bochechas brancos, listras escuras dos olhos, orelhas com borda branca), olho direito biônico (lente ciano, aro de aço e parafusos de cobre) e antena; cauda longa com anéis ruivos e claros e anéis de metal com luz; núcleo de energia no peito e ombreira mecânica com cabos (`redPandaHead`, `redPandaTail`, `bionicParts`). Skins: Faísca do Bambu (rara: verde-bambu, luz verde-limão), Faísca Neon (épica: preto e cromo, pelo carmim, luz rosa-néon) e Faísca, Núcleo Solar (lendária: pelo dourado, branco e ouro, luz laranja).
- **Minimapa no lugar e avisos sem cobrir o tempo** — tirado o `viewport-fit=cover` (no celular deitado, o recuo da área do entalhe empurrava o minimapa e os avisos para a direita, em cima do tempo). Os avisos de abate são posicionados à direita do minimapa e, se fossem encostar no tempo da partida ou na vida (celular), descem ao lado do mapa até ficarem livres.
- **Aviso de abates com rostos** — fica à direita do minimapa (antes ficava embaixo do botão de habilidade no celular), menor, até 4 de uma vez por 5 s. Cada aviso mostra a cabeça de quem abateu num círculo azul e a de quem foi abatido num círculo vermelho (◎ = na cabeça); no computador também os nomes, no celular (tela até 900 px de largura) só as cabeças, para não encostar no tempo e na vida do topo. As fotos das cabeças (com a skin) são tiradas uma vez num renderizador pequeno próprio (`ui/Portraits.ts`) e guardadas; até ficarem prontas aparece a inicial do nome. Criaturas e torres usam ícones. Os selos de poder (Fúria/Velocidade/Escudo) foram para baixo, acima da vida.
- **Escudo (Javali couraçado)** — novo mob especial (javali maior, couraça com brilho dourado, neutro, 170 de vida) que nasce num ponto de mobs a cada 50 s (primeiro aos 40 s). Quem o elimina ganha o Escudo (`GUARD`): absorve 40% de todo dano por 30 s, brilha em dourado e mostra "ESCUDO · Xs" no topo. Também pode ser roubado (15 s). Protocolo online v3 (snapshot leva o tempo de Escudo).
- **Roubo de poder** — eliminar um arqueiro (jogador ou bot) que está com Fúria e/ou Velocidade passa o(s) poder(es) para quem eliminou, por 15 s (`BUFF_STEAL.duration`; se já tinha o poder com mais tempo, fica o maior). Avisos: "Você roubou a FÚRIA de X!" para quem matou e "X roubou a sua FÚRIA" para quem morreu.
- **Mira precisa** — o tranco do tiro virou uma pulsada de zoom (campo de visão) em vez de inclinar a câmera para cima, e os próprios tiros não tremem mais a câmera: atirando sem parar, a mira na tela ficava ~0,03 rad acima de onde a flecha ia (era preciso mirar acima do alvo). Teste com alvo parado a 15 m: centro dos acertos de 7,8 px acima do peito para 1,1 px. Folga do tiro (`arrowRadius`) 0,12 → 0,18 m, cobrindo as beiradas do corpo desenhado (braços, capa, asas).
- **Tela no celular sem zoom** — página travada contra zoom (`maximum-scale=1`, `user-scalable=no`, `interactive-widget=resizes-visual`, sem pinça/toque duplo) e campos com letra de 16 px (com menos, o iPhone ampliava a página ao tocar no código da sala, nome ou senha). Com o teclado aberto o jogo não muda de tamanho; ao fechar o teclado ou entrar na sala, desfaz a rolagem e reajusta. A tela de conta não abre o teclado sozinha no celular.
- **Personagem estável andando** — o mapa de sombras voltou a ser redesenhado em todo quadro: em quadros alternados, a sombra de quem anda (inclusive a que cai sobre o próprio corpo) ficava um quadro atrasada e pulava entre duas posições, parecendo "dois corpos" tremendo.
- **Capas sem atravessar o corpo** — a capa dos modelos (peça rígida no peito) fica num pivô no alto das costas e abre para trás o necessário para a superfície do quadril, pernas, braços (cotovelo puxando a corda) e as peças presas (caudas; nos bichos, as peças das costas como as asas e a mochila-foguete) não a atravessarem. Estável: segura a maior abertura do último meio segundo e se move devagar (até 0,7 rad correndo), sem subir e descer a cada passada.
- **Acerto e suavidade no online** — (1) compensação de atraso: cada comando leva o tick do servidor que a tela mostrava (`viewTick`); o servidor guarda as hitboxes de personagens e criaturas dos últimos 24 ticks e confere o tiro (hitscan, explosão e auxílio de mira) contra o momento visto pelo atirador (`Simulation.shotHitboxes`). Teste: mirando na cabeça de um alvo correndo de lado a lado com 70 ms de rede, de 11% para 100% de acertos. (2) Os outros jogadores e criaturas são desenhados 7 ticks no passado, entre pacotes guardados num buffer, com relógio do servidor estimado (sem travar ou dar pulo quando um pacote atrasa); a mira vermelha usa essas posições desenhadas. (3) Animações de passo (andar, correr, de lado, de costas) num ciclo só com os pés alinhados (`GAIT_OFFSET`): a mistura na diagonal não fica mais com pernas fora de compasso ("dois corpos").
- **Salas privadas** — o botão Multiplayer abre uma tela com Partida rápida (sala pública), Criar sala privada (código de 5 caracteres sem letras ambíguas) e Entrar com código. Link de convite `?sala=CODIGO` abre já com o código. Quem cria vê o código e "Convidar amigo" (compartilhar/copiar) antes de começar; no menu de pausa o convite continua visível. Salas privadas vazias ficam 3 min abertas; código errado ou sala cheia mostram o erro na própria tela.
- **Fim de partida online** — "Jogar de novo" (fecha o placar e continua na sala; a próxima partida começa sozinha) e "Voltar ao menu" (sai da sala; dá para entrar de novo no Multiplayer).
- **Botão Multiplayer e login por nome/senha** — botão "🌐 Multiplayer" sempre no menu (sem servidor publicado, explica onde jogar); para entrar no online é preciso conta (convidado vê a tela de login/criar conta). Contas online (Supabase) usam nome de jogador e senha: o nome vira um e-mail interno fixo (`loginEmail`), então "Confirm email" precisa ficar desligado no Supabase. Antes de conectar, o mapa volta para o do online (Todos contra todos).
- **Multiplayer reativado para teste** — protocolo v2: o servidor manda nível na partida, XP de nível, assistências e skin de cada jogador; o cliente envia a skin ao entrar/trocar; o arco é sempre o do personagem (o servidor não aceita mais arco escolhido pelo cliente); visual dos outros é refeito quando trocam de personagem/skin. Online é o modo Todos contra todos (os modos Gigantes e Último de pé são só offline por enquanto).
- **Comemoração** — no fim do Último de pé, 4 s com a câmera no vencedor comemorando antes do placar.
- **Menu sem tremer** — com o menu aberto o fundo fica parado (posições sem interpolação, poses congeladas, 4 desenhos por segundo). Animação de abate na cabeça só ao eliminar personagens (jogadores/bots), não criaturas ou tropas.
- **Círculo de ataque e minimapa** — torres/gigantes só levam dano de dentro do círculo; minimapa com inimigos só quando vistos pelo time.
- **Modo Gigantes** — segundo modo (5 contra 5): torres, gigantes de pedra, tropas de mini golems, tempo crescente e votação para desistir.
- **Noctua / Fenna** — coruja com textura de penas e menos redonda; Fenna com traje de astronauta.
- **Kael do mal / Fenna de armadura** — roupa preta, vermelha e dourada no Kael; armadura metálica na Fenna.
- **Personagens** — upgrade e nomes: Kael, Sylwen, Eldrin, Fenna, Noctua e Cobalto.
- **Cabeças** — lagarto, homem-tubarão, urso esqueleto e Áurion (pássaro-alien dourado) esculpidos de novo.
- **Etapa 12** — bots sobem nas árvores, brilho/partículas nos arcos raros, animação de abate na cabeça, Pássaro-alien dourado, Urso esqueleto e Homem-tubarão.
- **Etapa 11** — arcos com desenho próprio, flechas com rastro de luz e clarões, lápides, golem veloz (Velocidade), casas em ruínas, lobos com pelo e animação nova, música e correção do som no celular.
- **Árvores** — árvores novas, adultas e antigas; 4 árvores anciãs com escada em espiral e plataforma no topo.
- **Etapa 9** — modelos 3D animados (KayKit, CC0), cadência mais lenta, Lobo de brasa e Fúria, bots acertando mais, resolução automática sem borrar.
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

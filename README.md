# Arqueiros

Jogo de tiro com arco PVP para navegador, feito com **Three.js + TypeScript + Vite**.
Visual estilizado-realista (céu físico, grama ao vento, texturas geradas por código), câmera em
terceira pessoa por cima do ombro.

## Rodar

```bash
npm install
npm run dev            # http://localhost:5174 (offline, contra bots)
npm run build          # build de produção em dist/ (só offline)
npm run build:online   # site + servidor multiplayer
npm start              # http://localhost:8080 com o "Jogar online"
```

**Computador:** WASD andar · mouse mirar · segurar botão esquerdo puxa o arco, soltar atira · botão direito cancela · Q troca de arco ·
Shift correr · Espaço pular · Esc pausar · F3 informações.
**Celular:** arraste à esquerda para andar, à direita para mirar; botões Atirar (segurar/soltar), Pular e Pausar.

Parâmetros de teste na URL: `?debug=1`, `?skin=elf|mage|lizard|robot|fox|owl`, `?nolock=1`, `?guest=1` (pula a tela de conta), `?bow=sun` (testa qualquer arco sem salvar), `?gfx=low|medium|high` (qualidade gráfica). No link publicado use `#`: `#bow-sun`, `#gfx-low`, `#skin-fox` (vários juntos com ponto: `#bow-echo.gfx-low`).

## Design e andamento

Tudo sobre o jogo — etapas, o que já existe e onde ajustar o balanceamento — está em
[`GAME_DESIGN.md`](GAME_DESIGN.md).

## Contas

Ao abrir o jogo, você entra, cria uma conta ou joga como convidado. O perfil guarda nome, nível/XP,
personagem, arco e estatísticas (partidas, vitórias, abates, mortes, precisão, tiros na cabeça), e é
atualizado no fim de cada partida. Dá para trocar de conta ou excluí-la no cartão do perfil (tela de pausa).

- **Sem configuração:** contas **locais**, salvas só no navegador (a senha é guardada como hash PBKDF2).
- **Contas online (Supabase):** valem em qualquer aparelho, com login por e-mail e senha.

### Contas online (Supabase) — passo a passo
1. Crie um projeto grátis em https://supabase.com.
2. No painel: **SQL Editor → New query**, cole todo o arquivo [`supabase/schema.sql`](supabase/schema.sql) e clique **Run**.
3. Em **Authentication → URL Configuration**, coloque o endereço do seu site em *Site URL* (para o link de confirmação de e-mail).
4. Em **Project Settings → API**, copie a *Project URL* e a chave **anon/publishable**.
5. Crie um arquivo `.env` (veja `.env.example`) ou configure as variáveis no serviço de hospedagem:
   ```
   VITE_SUPABASE_URL=https://xxxx.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJ...
   ```
   Nunca use a chave `service_role`.
6. Rode `npm run build` de novo. A tela de conta passa a pedir e-mail e nome de jogador.

Observação: hoje as estatísticas são calculadas no navegador; no multiplayer (etapa 8) o servidor
passará a validá-las para evitar trapaça.

## Multiplayer online

O servidor (`server/`) é **autoritativo**: roda a mesma simulação do jogo e decide tiros, dano,
abates e drops; os jogadores mandam só os comandos. Cada sala tem até 8 jogadores e é completada com
bots enquanto houver poucas pessoas. As partidas de 5 minutos se repetem sozinhas. O mesmo servidor
também entrega o site, então só é preciso publicar **um** serviço.

### Testar no seu computador
```bash
npm install
npm run build:online
npm start            # abra http://localhost:8080 em duas abas e clique em "Jogar online"
```

### Publicar grátis no Render
1. Crie uma conta em https://render.com e conecte o GitHub.
2. **New → Blueprint** e escolha este repositório (o arquivo `render.yaml` já tem tudo).
   Se preferir **New → Web Service**: build `npm ci && npm run build:online`, start `npm start`,
   health check `/health`.
3. (Opcional) Para contas online, adicione `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` nas
   variáveis de ambiente do serviço.
4. Ao terminar, o Render mostra o endereço (ex.: `https://arqueiros.onrender.com`). Compartilhe esse link.

No plano grátis o serviço "dorme" depois de ~15 min sem uso; o primeiro acesso depois disso demora
uns 30–60 s para acordar. Railway e Fly.io também funcionam (qualquer serviço que rode Node com WebSocket).

Para testar com um servidor em outro endereço: `?server=wss://seu-servidor/ws`.

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

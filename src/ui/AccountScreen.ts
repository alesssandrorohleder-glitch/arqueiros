// Tela de conta: entrar ou criar conta com nome de jogador e senha (contas locais
// ou online, ver account/), ou jogar como convidado. Resolve true quando o jogador
// tem um perfil carregado. Para o multiplayer (`opts.required`) não há convidado,
// e "Voltar" resolve false.
import type { AccountService } from '../account/AccountService';

export function showAccountScreen(root: HTMLElement, accounts: AccountService, opts: { required?: string } = {}): Promise<boolean> {
  const online = accounts.online;
  const loginLabel = 'Nome de jogador';
  root.insertAdjacentHTML(
    'beforeend',
    `
    <div class="account-screen">
      <form class="panel account-panel" novalidate>
        <h1>Arqueiros</h1>
        ${opts.required ? `<p class="account-required">${opts.required}</p>` : ''}
        <div class="tabs" role="tablist">
          <button type="button" role="tab" class="tab active" data-mode="signin">Entrar</button>
          <button type="button" role="tab" class="tab" data-mode="signup">Criar conta</button>
        </div>
        <label class="field">
          <span>${loginLabel}</span>
          <input id="acc-login" name="login" type="text" autocomplete="username" maxlength="16" required />
        </label>
        <label class="field">
          <span>Senha</span>
          <input id="acc-password" name="password" type="password" autocomplete="current-password" required minlength="6" />
        </label>
        <label class="field signup-only">
          <span>Confirmar senha</span>
          <input id="acc-password2" name="password2" type="password" autocomplete="new-password" />
        </label>
        <p class="form-error" role="alert" hidden></p>
        <p class="form-info" hidden></p>
        <button type="submit" class="primary-btn">Entrar</button>
        ${opts.required ? '<button type="button" class="link-btn back-btn">← Voltar</button>' : '<button type="button" class="link-btn guest-btn">Jogar como convidado</button>'}
        <p class="account-note">${
          online
            ? 'Sua conta fica salva online: entre de qualquer aparelho com seu nome de jogador e senha.'
            : 'Contas salvas só neste navegador. As contas online ficam disponíveis quando o servidor for configurado.'
        }</p>
      </form>
    </div>`,
  );
  const screen = root.querySelector<HTMLElement>('.account-screen')!;
  const form = screen.querySelector<HTMLFormElement>('form')!;
  const tabs = Array.from(screen.querySelectorAll<HTMLButtonElement>('.tab'));
  const submit = screen.querySelector<HTMLButtonElement>('.primary-btn')!;
  const errorEl = screen.querySelector<HTMLElement>('.form-error')!;
  const infoEl = screen.querySelector<HTMLElement>('.form-info')!;
  const password = screen.querySelector<HTMLInputElement>('#acc-password')!;
  const login = screen.querySelector<HTMLInputElement>('#acc-login')!;
  let mode: 'signin' | 'signup' = 'signin';

  const setMode = (m: typeof mode) => {
    mode = m;
    for (const t of tabs) {
      const on = t.dataset.mode === m;
      t.classList.toggle('active', on);
      t.setAttribute('aria-selected', String(on));
    }
    for (const el of screen.querySelectorAll<HTMLElement>('.signup-only')) el.hidden = m !== 'signup';
    submit.textContent = m === 'signin' ? 'Entrar' : 'Criar conta';
    password.autocomplete = m === 'signin' ? 'current-password' : 'new-password';
    errorEl.hidden = true;
    infoEl.hidden = true;
  };
  for (const t of tabs) t.addEventListener('click', () => setMode(t.dataset.mode as typeof mode));
  setMode('signin');
  // No celular, sem foco automático: abriria o teclado (e o zoom) antes de tocar no campo.
  if (!matchMedia('(pointer: coarse)').matches) login.focus();

  return new Promise((resolve) => {
    const done = (ok = true) => {
      // Fecha o teclado antes de tirar a tela (tirar o campo em foco não avisa o jogo).
      (document.activeElement as HTMLElement | null)?.blur?.();
      screen.remove();
      window.scrollTo(0, 0);
      window.dispatchEvent(new Event('resize'));
      resolve(ok);
    };
    const showError = (msg: string) => {
      errorEl.textContent = msg;
      errorEl.hidden = false;
      infoEl.hidden = true;
    };

    screen.querySelector('.guest-btn')?.addEventListener('click', () => {
      accounts.playAsGuest();
      done();
    });
    screen.querySelector('.back-btn')?.addEventListener('click', () => done(false));

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      errorEl.hidden = true;
      const data = new FormData(form);
      const loginValue = String(data.get('login') ?? '').trim();
      const pass = String(data.get('password') ?? '');
      if (!loginValue || !pass) return showError(`Preencha ${loginLabel.toLowerCase()} e senha.`);
      submit.disabled = true;
      submit.textContent = 'Aguarde…';
      try {
        if (mode === 'signin') {
          await accounts.signIn(loginValue, pass);
          done();
        } else {
          if (pass !== String(data.get('password2') ?? '')) throw new Error('As senhas não são iguais.');
          const r = await accounts.signUp(loginValue, pass, loginValue);
          if (r.needsConfirmation) {
            setMode('signin');
            infoEl.textContent = 'Conta criada, mas o servidor ainda pede confirmação de e-mail. O dono do jogo precisa desligar "Confirm email" no Supabase.';
            infoEl.hidden = false;
          } else {
            done();
          }
        }
      } catch (err) {
        showError(err instanceof Error ? err.message : 'Algo deu errado. Tente de novo.');
      } finally {
        submit.disabled = false;
        submit.textContent = mode === 'signin' ? 'Entrar' : 'Criar conta';
      }
    });
  });
}

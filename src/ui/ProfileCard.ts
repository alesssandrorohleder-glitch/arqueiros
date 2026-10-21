// Cartão do perfil na tela inicial/pausa: nome, nível, XP e estatísticas,
// com "Trocar conta" e "Excluir conta" (com confirmação na própria tela).
import type { AccountService } from '../account/AccountService';
import { levelFromXp } from '../data/progression';

export class ProfileCard {
  private readonly el: HTMLElement;

  constructor(slot: HTMLElement, private readonly accounts: AccountService) {
    this.el = document.createElement('div');
    this.el.className = 'profile-card';
    slot.appendChild(this.el);
    // Cliques aqui não podem começar o jogo (o painel inteiro é clicável).
    this.el.addEventListener('click', (e) => e.stopPropagation());
    this.render();
  }

  render(): void {
    const p = this.accounts.profile;
    if (!p) return;
    const lv = levelFromXp(p.xp);
    const s = p.stats;
    const acc = s.shots ? Math.round((s.hits / s.shots) * 100) : 0;
    const kd = s.deaths ? (s.kills / s.deaths).toFixed(2) : String(s.kills);
    const kind = this.accounts.guest ? 'Convidado' : this.accounts.online ? 'Conta online' : 'Conta local';
    this.el.innerHTML = `
      <div class="pc-head">
        <div class="pc-level" title="Nível">${lv.level}</div>
        <div class="pc-id">
          <div class="pc-name">${escapeHtml(p.username)}</div>
          <div class="pc-kind">${kind}</div>
        </div>
      </div>
      <div class="pc-xp" title="${lv.into} / ${lv.needed} XP"><div class="pc-xp-fill" style="transform: scaleX(${lv.into / lv.needed})"></div></div>
      <div class="pc-xp-text">${lv.into} / ${lv.needed} XP para o nível ${lv.level + 1}</div>
      <dl class="pc-stats">
        <div><dt>Partidas</dt><dd>${s.matches}</dd></div>
        <div><dt>Vitórias</dt><dd>${s.wins}</dd></div>
        <div><dt>Abates</dt><dd>${s.kills}</dd></div>
        <div><dt>A/M</dt><dd>${kd}</dd></div>
        <div><dt>Precisão</dt><dd>${acc}%</dd></div>
        <div><dt>Na cabeça</dt><dd>${s.headshots}</dd></div>
      </dl>
      <div class="pc-actions">
        <button type="button" class="link-btn pc-switch">${this.accounts.guest ? 'Entrar ou criar conta' : 'Trocar conta'}</button>
        <button type="button" class="link-btn danger pc-delete">${this.accounts.guest ? 'Apagar progresso' : 'Excluir conta'}</button>
      </div>
      <div class="pc-confirm" hidden>
        <p>${this.accounts.guest ? 'Apagar todo o progresso de convidado?' : 'Excluir a conta e todo o progresso? Isso não pode ser desfeito.'}</p>
        <button type="button" class="danger-btn pc-confirm-yes">Sim, excluir</button>
        <button type="button" class="link-btn pc-confirm-no">Cancelar</button>
        <p class="form-error" hidden></p>
      </div>`;
    const q = <T extends HTMLElement>(sel: string) => this.el.querySelector<T>(sel)!;
    q('.pc-switch').addEventListener('click', async () => {
      await this.accounts.signOut();
      location.reload();
    });
    q('.pc-delete').addEventListener('click', () => (q('.pc-confirm').hidden = false));
    q('.pc-confirm-no').addEventListener('click', () => (q('.pc-confirm').hidden = true));
    q('.pc-confirm-yes').addEventListener('click', async () => {
      try {
        await this.accounts.deleteAccount();
        location.reload();
      } catch (err) {
        const e = q('.pc-confirm .form-error');
        e.textContent = err instanceof Error ? err.message : 'Não foi possível excluir agora.';
        e.hidden = false;
      }
    });
  }
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[ch]!);
}

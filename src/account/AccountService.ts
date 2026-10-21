// Ponto único das contas: escolhe o tipo (online se o Supabase estiver
// configurado, senão local), guarda o perfil atual e salva os resultados.
import { onlineEnabled, ONLINE } from '../online.config';
import { AccountError, type AccountBackend, type AccountUser } from './backend';
import { LocalBackend } from './LocalBackend';
import { applyMatch, newProfile, normalizeProfile, type MatchResult, type MatchRewards, type PlayerProfile } from './profile';

const GUEST_KEY = 'arqueiros.guest';

export class AccountService {
  user: AccountUser | null = null;
  profile: PlayerProfile | null = null;
  guest = false;

  private constructor(readonly backend: AccountBackend) {}

  /** Cria o serviço e restaura a sessão salva, se houver. */
  static async create(): Promise<AccountService> {
    let backend: AccountBackend = new LocalBackend();
    if (onlineEnabled()) {
      // Carrega o cliente do Supabase só quando ele vai ser usado.
      const { SupabaseBackend } = await import('./SupabaseBackend');
      backend = new SupabaseBackend(ONLINE.supabaseUrl, ONLINE.supabaseAnonKey);
    }
    const service = new AccountService(backend);
    try {
      const user = await backend.currentUser();
      if (user) await service.enter(user);
    } catch {
      // sessão inválida ou servidor fora: pede login de novo
    }
    return service;
  }

  get online(): boolean {
    return this.backend.kind === 'online';
  }

  get signedIn(): boolean {
    return !!this.profile;
  }

  async signUp(login: string, password: string, username: string): Promise<{ needsConfirmation: boolean }> {
    const r = await this.backend.signUp(login, password, username);
    if (r.user) await this.enter(r.user);
    return { needsConfirmation: r.needsConfirmation };
  }

  async signIn(login: string, password: string): Promise<void> {
    await this.enter(await this.backend.signIn(login, password));
  }

  /** Jogar sem conta: o progresso fica só neste navegador. */
  playAsGuest(): void {
    this.guest = true;
    this.user = null;
    let saved: PlayerProfile | null = null;
    try {
      const raw = localStorage.getItem(GUEST_KEY);
      if (raw) saved = normalizeProfile(JSON.parse(raw), 'Convidado');
    } catch {
      // ignora
    }
    this.profile = saved ?? newProfile('Convidado');
  }

  async signOut(): Promise<void> {
    if (!this.guest) await this.backend.signOut();
    this.user = null;
    this.profile = null;
    this.guest = false;
  }

  async deleteAccount(): Promise<void> {
    if (this.guest) {
      try {
        localStorage.removeItem(GUEST_KEY);
      } catch {
        // ignora
      }
    } else if (this.user) {
      await this.backend.deleteAccount(this.user);
    }
    this.user = null;
    this.profile = null;
    this.guest = false;
  }

  /** Aplica o resultado da partida ao perfil e salva. */
  async recordMatch(result: MatchResult): Promise<MatchRewards | null> {
    if (!this.profile) return null;
    const rewards = applyMatch(this.profile, result);
    await this.save();
    return rewards;
  }

  async save(): Promise<void> {
    if (!this.profile) return;
    if (this.guest) {
      try {
        localStorage.setItem(GUEST_KEY, JSON.stringify(this.profile));
      } catch {
        // ignora
      }
      return;
    }
    if (!this.user) throw new AccountError('Você não está conectado.');
    await this.backend.saveProfile(this.user, this.profile);
  }

  private async enter(user: AccountUser): Promise<void> {
    this.user = user;
    this.guest = false;
    const existing = await this.backend.loadProfile(user);
    this.profile = existing ?? newProfile(user.username);
    if (!existing) await this.backend.saveProfile(user, this.profile);
  }
}

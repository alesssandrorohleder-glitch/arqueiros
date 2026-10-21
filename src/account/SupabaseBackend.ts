// Contas online com Supabase: login por e-mail e senha; o perfil fica na
// tabela `profiles` (veja supabase/schema.sql), protegida para que cada
// jogador só leia e altere o próprio perfil.
import { createClient, type Session, type SupabaseClient, type User } from '@supabase/supabase-js';
import { AccountError, friendlyError, type AccountBackend, type AccountUser, type SignUpResult } from './backend';
import { levelFromXp } from '../data/progression';
import { normalizeProfile, validateUsername, type PlayerProfile } from './profile';

const toUser = (u: User): AccountUser => ({
  id: u.id,
  email: u.email ?? '',
  username: (u.user_metadata?.username as string | undefined) ?? (u.email ?? 'arqueiro').split('@')[0],
});

/** Endereço para onde o link de confirmação do e-mail deve voltar. */
const backUrl = () => window.location.origin + window.location.pathname;

export class SupabaseBackend implements AccountBackend {
  readonly kind = 'online' as const;
  private readonly sb: SupabaseClient;
  private session: Session | null = null;

  constructor(url: string, anonKey: string) {
    this.sb = createClient(url, anonKey, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } });
    this.sb.auth.onAuthStateChange((_e, s) => (this.session = s));
  }

  private fail(e: unknown): never {
    const msg = e instanceof Error ? e.message : String((e as { message?: string })?.message ?? e);
    throw new AccountError(friendlyError(msg));
  }

  async currentUser(): Promise<AccountUser | null> {
    const { data } = await this.sb.auth.getSession();
    this.session = data.session;
    return data.session?.user ? toUser(data.session.user) : null;
  }

  async signUp(email: string, password: string, username: string): Promise<SignUpResult> {
    const invalid = validateUsername(username);
    if (invalid) throw new AccountError(invalid);
    // Nome em uso? (a tabela também tem índice único; isto só dá a mensagem antes)
    const { data: taken } = await this.sb.rpc('username_taken', { name: username });
    if (taken === true) throw new AccountError('Esse nome de jogador já está em uso.');
    const { data, error } = await this.sb.auth.signUp({ email: email.trim(), password, options: { data: { username }, emailRedirectTo: backUrl() } });
    if (error) this.fail(error);
    return { user: data.session?.user ? toUser(data.session.user) : null, needsConfirmation: !data.session };
  }

  async signIn(email: string, password: string): Promise<AccountUser> {
    const { data, error } = await this.sb.auth.signInWithPassword({ email: email.trim(), password });
    if (error) this.fail(error);
    this.session = data.session;
    return toUser(data.user);
  }

  async signOut(): Promise<void> {
    await this.sb.auth.signOut();
  }

  async loadProfile(user: AccountUser): Promise<PlayerProfile | null> {
    const { data, error } = await this.sb.from('profiles').select('data, username').eq('user_id', user.id).maybeSingle();
    if (error) this.fail(error);
    return data ? normalizeProfile(data.data, data.username as string) : null;
  }

  async saveProfile(user: AccountUser, profile: PlayerProfile): Promise<void> {
    if (!this.session) throw new AccountError('Você não está conectado.');
    const s = profile.stats;
    const { error } = await this.sb.from('profiles').upsert(
      {
        user_id: user.id,
        username: profile.username,
        data: profile,
        level: levelFromXp(profile.xp).level,
        kills: s.kills,
        wins: s.wins,
        updated_at: profile.updatedAt,
      },
      { onConflict: 'user_id' },
    );
    if (error) this.fail(error);
  }

  async deleteAccount(): Promise<void> {
    const { error } = await this.sb.rpc('delete_my_account');
    if (error) this.fail(error);
    await this.sb.auth.signOut();
  }
}

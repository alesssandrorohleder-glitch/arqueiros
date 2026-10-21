// Interface comum dos dois tipos de conta: local (navegador) e online (Supabase).
import type { PlayerProfile } from './profile';

export interface AccountUser {
  id: string;
  username: string;
  /** E-mail (só contas online). */
  email?: string;
}

export interface SignUpResult {
  user: AccountUser | null;
  /** Online: precisa confirmar o e-mail antes de entrar. */
  needsConfirmation: boolean;
}

export interface AccountBackend {
  readonly kind: 'local' | 'online';
  currentUser(): Promise<AccountUser | null>;
  /** `login` = nome de jogador (local) ou e-mail (online). */
  signUp(login: string, password: string, username: string): Promise<SignUpResult>;
  signIn(login: string, password: string): Promise<AccountUser>;
  signOut(): Promise<void>;
  loadProfile(user: AccountUser): Promise<PlayerProfile | null>;
  saveProfile(user: AccountUser, profile: PlayerProfile): Promise<void>;
  deleteAccount(user: AccountUser): Promise<void>;
}

/** Erro com mensagem pronta para mostrar ao jogador. */
export class AccountError extends Error {}

export function friendlyError(msg: string): string {
  const m = msg.toLowerCase();
  if (m.includes('invalid login')) return 'E-mail ou senha incorretos.';
  if (m.includes('email not confirmed')) return 'Confirme seu e-mail antes de entrar (veja sua caixa de entrada).';
  if (m.includes('already registered') || m.includes('already been registered')) return 'Já existe uma conta com esse e-mail.';
  if (m.includes('profiles_username') || m.includes('duplicate key')) return 'Esse nome de jogador já está em uso.';
  if (m.includes('password') && m.includes('6')) return 'A senha precisa ter pelo menos 6 caracteres.';
  if (m.includes('failed to fetch') || m.includes('network')) return 'Sem conexão com o servidor. Verifique a internet.';
  if (m.includes('rate limit')) return 'Muitas tentativas. Espere um pouco e tente de novo.';
  return msg;
}

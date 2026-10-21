// Contas locais: ficam salvas só neste navegador (localStorage). Usadas quando
// o Supabase não está configurado. A senha nunca é guardada: só um hash
// PBKDF2 com sal aleatório, gerado pela Web Crypto do navegador.
import { AccountError, type AccountBackend, type AccountUser, type SignUpResult } from './backend';
import { normalizeProfile, validateUsername, type PlayerProfile } from './profile';

const STORE_KEY = 'arqueiros.accounts';
const SESSION_KEY = 'arqueiros.session';
const ITERATIONS = 120_000;

interface StoredAccount {
  username: string;
  salt: string;
  hash: string;
  profile: PlayerProfile | null;
}

interface Store {
  version: 1;
  users: Record<string, StoredAccount>;
}

const toHex = (buf: ArrayBuffer | Uint8Array) => Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, '0')).join('');
const fromHex = (hex: string) => new Uint8Array(hex.match(/.{2}/g)!.map((h) => parseInt(h, 16)));

async function hashPassword(password: string, salt: Uint8Array): Promise<string> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: salt as BufferSource, iterations: ITERATIONS, hash: 'SHA-256' }, key, 256);
  return toHex(bits);
}

/** Comparação em tempo constante (não vaza onde a senha difere). */
function sameHash(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function readStore(): Store {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) {
      const s = JSON.parse(raw) as Store;
      if (s && s.users) return s;
    }
  } catch {
    // armazenamento bloqueado ou corrompido: começa vazio
  }
  return { version: 1, users: {} };
}

function writeStore(s: Store): void {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(s));
  } catch {
    throw new AccountError('Não foi possível salvar neste navegador (armazenamento bloqueado ou cheio).');
  }
}

const keyOf = (username: string) => username.trim().toLowerCase();

export class LocalBackend implements AccountBackend {
  readonly kind = 'local' as const;

  async currentUser(): Promise<AccountUser | null> {
    let key: string | null = null;
    try {
      key = localStorage.getItem(SESSION_KEY);
    } catch {
      return null;
    }
    const acc = key ? readStore().users[key] : undefined;
    return acc ? { id: key!, username: acc.username } : null;
  }

  async signUp(login: string, password: string): Promise<SignUpResult> {
    const username = login.trim();
    const invalid = validateUsername(username);
    if (invalid) throw new AccountError(invalid);
    if (password.length < 6) throw new AccountError('A senha precisa ter pelo menos 6 caracteres.');
    const store = readStore();
    const key = keyOf(username);
    if (store.users[key]) throw new AccountError('Esse nome de jogador já existe neste navegador.');
    const salt = crypto.getRandomValues(new Uint8Array(16));
    store.users[key] = { username, salt: toHex(salt), hash: await hashPassword(password, salt), profile: null };
    writeStore(store);
    this.setSession(key);
    return { user: { id: key, username }, needsConfirmation: false };
  }

  async signIn(login: string, password: string): Promise<AccountUser> {
    const key = keyOf(login);
    const acc = readStore().users[key];
    // Mesma mensagem para usuário inexistente e senha errada.
    if (!acc || !sameHash(await hashPassword(password, fromHex(acc.salt)), acc.hash)) {
      throw new AccountError('Nome de jogador ou senha incorretos.');
    }
    this.setSession(key);
    return { id: key, username: acc.username };
  }

  async signOut(): Promise<void> {
    try {
      localStorage.removeItem(SESSION_KEY);
    } catch {
      // ignora
    }
  }

  async loadProfile(user: AccountUser): Promise<PlayerProfile | null> {
    const acc = readStore().users[user.id];
    return acc?.profile ? normalizeProfile(acc.profile, acc.username) : null;
  }

  async saveProfile(user: AccountUser, profile: PlayerProfile): Promise<void> {
    const store = readStore();
    const acc = store.users[user.id];
    if (!acc) throw new AccountError('Conta não encontrada.');
    acc.profile = profile;
    writeStore(store);
  }

  async deleteAccount(user: AccountUser): Promise<void> {
    const store = readStore();
    delete store.users[user.id];
    writeStore(store);
    await this.signOut();
  }

  private setSession(key: string): void {
    try {
      localStorage.setItem(SESSION_KEY, key);
    } catch {
      // sem sessão salva: o jogador entra de novo na próxima vez
    }
  }
}

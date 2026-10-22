// Perfil do jogador: o que fica salvo na conta.
import { DEFAULT_BOW_ID } from '../data/bows';
import { CHARACTERS, DEFAULT_CHARACTER_ID } from '../data/characters';
import { levelFromXp, PROGRESSION } from '../data/progression';

export interface PlayerStats {
  matches: number;
  wins: number;
  kills: number;
  deaths: number;
  shots: number;
  hits: number;
  headshots: number;
  /** Criaturas (mobs) eliminadas. */
  mobKills: number;
  playSeconds: number;
}

export interface PlayerProfile {
  version: 1;
  username: string;
  characterId: string;
  bowId: string;
  /** Arcos de antes (não há mais arcos no chão; fica só por compatibilidade). */
  ownedBows: string[];
  /**
   * Skins que o jogador tem (data/skins.ts). Com a loja, a posse de skins pagas
   * deve vir do servidor (o perfil é editável pelo próprio jogador).
   */
  ownedSkins: string[];
  /** Skin equipada em cada personagem (id do personagem → id da skin). */
  equippedSkins: Record<string, string>;
  xp: number;
  stats: PlayerStats;
  createdAt: string;
  updatedAt: string;
}

/** Resultado de uma partida, do ponto de vista do jogador. */
export interface MatchResult {
  kills: number;
  headshotKills: number;
  deaths: number;
  shots: number;
  hits: number;
  headshots: number;
  mobKills: number;
  /** XP ganho durante a partida (mobs). */
  mobXp: number;
  /** Colocação final (1 = primeiro). */
  place: number;
  seconds: number;
}

export interface MatchRewards {
  xp: number;
  levelBefore: number;
  levelAfter: number;
}

export function newProfile(username: string): PlayerProfile {
  const now = new Date().toISOString();
  return {
    version: 1,
    username,
    characterId: DEFAULT_CHARACTER_ID,
    bowId: DEFAULT_BOW_ID,
    ownedBows: [DEFAULT_BOW_ID],
    ownedSkins: [],
    equippedSkins: {},
    xp: 0,
    stats: { matches: 0, wins: 0, kills: 0, deaths: 0, shots: 0, hits: 0, headshots: 0, mobKills: 0, playSeconds: 0 },
    createdAt: now,
    updatedAt: now,
  };
}

/** Corrige perfis antigos ou incompletos (campos novos ganham valor padrão). */
export function normalizeProfile(raw: unknown, fallbackName: string): PlayerProfile {
  const base = newProfile(fallbackName);
  if (!raw || typeof raw !== 'object') return base;
  const p = raw as Partial<PlayerProfile>;
  const profile: PlayerProfile = {
    ...base,
    ...p,
    version: 1,
    stats: { ...base.stats, ...(p.stats ?? {}) },
    ownedBows: Array.isArray(p.ownedBows) && p.ownedBows.length ? p.ownedBows : base.ownedBows,
    ownedSkins: Array.isArray(p.ownedSkins) ? p.ownedSkins.filter((x) => typeof x === 'string') : [],
    equippedSkins: p.equippedSkins && typeof p.equippedSkins === 'object' ? { ...p.equippedSkins } : {},
  };
  if (!CHARACTERS[profile.characterId]) profile.characterId = DEFAULT_CHARACTER_ID;
  return profile;
}

export function xpForMatch(r: MatchResult): number {
  const P = PROGRESSION;
  let xp = r.mobXp + P.xpParticipation + r.kills * P.xpPerKill + r.headshotKills * P.xpHeadshotKillBonus + r.hits * P.xpPerHit;
  if (r.place === 1) xp += P.xpWin;
  else if (r.place <= 3) xp += P.xpTop3;
  return xp;
}

/** Aplica o resultado da partida ao perfil (altera o perfil). */
export function applyMatch(profile: PlayerProfile, r: MatchResult): MatchRewards {
  const levelBefore = levelFromXp(profile.xp).level;
  const xp = xpForMatch(r);
  profile.xp += xp;
  const s = profile.stats;
  s.matches++;
  if (r.place === 1) s.wins++;
  s.kills += r.kills;
  s.deaths += r.deaths;
  s.shots += r.shots;
  s.hits += r.hits;
  s.headshots += r.headshots;
  s.mobKills += r.mobKills;
  s.playSeconds += Math.round(r.seconds);
  profile.updatedAt = new Date().toISOString();
  return { xp, levelBefore, levelAfter: levelFromXp(profile.xp).level };
}

/** Nome de jogador: 3 a 16 letras, números ou _. */
export function validateUsername(name: string): string | null {
  if (!/^[\p{L}\p{N}_]{3,16}$/u.test(name)) return 'O nome deve ter de 3 a 16 caracteres: letras, números ou _ (sem espaços).';
  return null;
}

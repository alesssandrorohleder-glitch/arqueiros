import './style.css';
import { AccountService } from './account/AccountService';
import { Game } from './core/Game';
import { cleanRoomCode } from './net/protocol';
import { showAccountScreen } from './ui/AccountScreen';

// Convite para sala privada: ?sala=K7MXQ
// Parâmetros de teste na URL: ?skin=fox  ?debug=1  ?nolock=1  ?guest=1  ?bow=sun  ?gfx=low  ?mode=giants
const params = new URLSearchParams(location.search);
// Também aceita "#bow-sun" e "#gfx-low" (o link publicado só repassa o que vem depois do #).
for (const part of location.hash.slice(1).split('.')) {
  const m = /^(bow|gfx|skin|mode)-([A-Za-z]+)$/.exec(part);
  if (m) params.set(m[1], m[2]);
}
const app = document.getElementById('app')!;

async function start(): Promise<void> {
  const accounts = await AccountService.create();
  if (!accounts.signedIn) {
    if (params.has('guest')) accounts.playAsGuest();
    else await showAccountScreen(app, accounts);
  }
  const game = new Game(app, {
    characterId: params.get('skin') ?? accounts.profile!.characterId,
    accounts,
    noLock: params.has('nolock'),
    debug: params.has('debug'),
    testBow: params.get('bow'),
    mode: params.get('mode'),
    roomCode: cleanRoomCode(params.get('sala')),
    graphics: (['low', 'medium', 'high'] as const).find((g) => g === params.get('gfx')) ?? null,
  });
  game.start();
  if (import.meta.env.DEV || params.has('debug')) (window as unknown as { game: Game }).game = game;
}

void start();

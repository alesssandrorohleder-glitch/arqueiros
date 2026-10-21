import './style.css';
import { AccountService } from './account/AccountService';
import { Game } from './core/Game';
import { showAccountScreen } from './ui/AccountScreen';

// Parâmetros de teste na URL: ?skin=fox  ?debug=1  ?nolock=1  ?guest=1  ?bow=sun  ?gfx=low
const params = new URLSearchParams(location.search);
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
    graphics: (['low', 'medium', 'high'] as const).find((g) => g === params.get('gfx')) ?? null,
  });
  game.start();
  if (import.meta.env.DEV) (window as unknown as { game: Game }).game = game;
}

void start();

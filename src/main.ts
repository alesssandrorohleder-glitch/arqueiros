import './style.css';
import { Game } from './core/Game';
import { DEFAULT_CHARACTER_ID } from './data/characters';

// Parâmetros de teste na URL: ?skin=fox  ?debug=1  ?nolock=1
const params = new URLSearchParams(location.search);

const game = new Game(document.getElementById('app')!, {
  characterId: params.get('skin') ?? DEFAULT_CHARACTER_ID,
  noLock: params.has('nolock'),
  debug: params.has('debug'),
});
game.start();

if (import.meta.env.DEV) (window as unknown as { game: Game }).game = game;

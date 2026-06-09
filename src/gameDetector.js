import psList from 'ps-list';
import { GAME_PROCESS } from './config.js';

export async function isGameRunning() {
  const processes = await psList();

  return processes.some(
    p => p.name?.toLowerCase() === GAME_PROCESS
  );
}
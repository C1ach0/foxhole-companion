import { createTray } from './tray.js';

import { CHECK_INTERVAL } from './config.js';
import { notify } from './notifier.js';
import { isGameRunning } from './gameDetector.js';
import { listSaveFiles } from './saveFiles.js';
import { getWatchedSaveFiles, startWatcher, stopWatcher } from './watcher.js';

let gameRunning = false;
let checking = false;

async function handleGameStarted() {
  gameRunning = true;

  console.log(
    `${new Date().toISOString()} - Foxhole detected`
  );

  const files = await startWatcher();
}

async function handleGameStopped() {
  gameRunning = false;

  console.log(
    `${new Date().toISOString()} - Foxhole closed`
  );

  await stopWatcher();

  notify(
    'Foxhole Companion',
    'Foxhole closed - Thanks for using Foxhole Companion! See you next time.'
  );
}

async function checkProcesses() {
  if (checking) {
    return;
  }

  checking = true;

  try {
    const running = await isGameRunning();

    if (running && !gameRunning) {
      await handleGameStarted();
    }

    if (!running && gameRunning) {
      await handleGameStopped();
    }
  } catch (error) {
    console.error(error);
  } finally {
    checking = false;
  }
}

async function main() {
  await createTray(async () => {
    const files = gameRunning
      ? getWatchedSaveFiles()
      : await listSaveFiles();

    notify(
      'Foxhole Companion'
    );
  });

  await checkProcesses();

  setInterval(
    checkProcesses,
    CHECK_INTERVAL
  );
}

main().catch(console.error);

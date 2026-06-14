import minimist from "minimist";

import { closeTray, createTray } from './tray.js';

import { APP_NAME, CHECK_INTERVAL } from './config.js';
import { notify } from './notifier.js';
import { isGameRunning } from './gameDetector.js';
import { startWatcher, stopWatcher } from './watcher.js';
import { logError, logInfo } from './logger.js';
import { checkForUpdates, notifyCompletedUpdate } from "./updater.js";

let gameRunning = false;
let checking = false;
const argv = minimist(process.argv.slice(2), {
  boolean: ["debug"],
  alias: {
    d: "debug",
  },
});
const debugMode = Boolean(argv.debug);

async function handleGameStarted() {
  gameRunning = true;

  console.log(
    `${new Date().toISOString()} - Foxhole detected`
  );
  logInfo("Foxhole detected");

  await startWatcher();
}

async function handleGameStopped() {
  gameRunning = false;

  console.log(
    `${new Date().toISOString()} - Foxhole closed`
  );
  logInfo("Foxhole closed");

  await stopWatcher();

  notify(
    APP_NAME,
    `Foxhole closed - Thanks for using ${APP_NAME}! See you next time.`
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
    logError("Process check failed", error);
  } finally {
    checking = false;
  }
}

async function main() {
  await createTray({ debug: debugMode });
  await notifyCompletedUpdate();

  if (debugMode) {
    console.log(`${APP_NAME} debug mode enabled`);
  }

  await checkProcesses();

  const updateStarted = await checkForUpdates();
  if (updateStarted) {
    await stopWatcher();
    closeTray();
    process.exit(0);
  }

  setInterval(
    checkProcesses,
    CHECK_INTERVAL
  );
}

main().catch((error) => {
  console.error(error);
  logError("Companion startup failed", error);
});

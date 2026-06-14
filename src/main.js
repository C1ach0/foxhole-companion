import minimist from "minimist";

import { closeTray, createTray } from './tray.js';

import {
  APP_NAME,
  CHECK_INTERVAL,
  UPDATE_CHECK_INTERVAL,
} from './config.js';
import { notify } from './notifier.js';
import { isGameRunning } from './gameDetector.js';
import { startWatcher, stopWatcher } from './watcher.js';
import { logError, logInfo } from './logger.js';
import { checkForUpdates, notifyCompletedUpdate } from "./updater.js";
import {
  acquireSingleInstance,
  releaseSingleInstance,
} from "./singleInstance.js";

let gameRunning = false;
let checking = false;
let checkingForUpdates = false;
const argv = minimist(process.argv.slice(2), {
  boolean: ["debug"],
  alias: {
    d: "debug",
  },
});
const debugMode = Boolean(argv.debug);
const isInstallUpdateActivation = (value) =>
  String(value).toLowerCase().startsWith(
    "foxpile-companion://install-update",
  );
const installUpdateRequested = argv._.some(isInstallUpdateActivation);

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

async function checkUpdates({
  manual = false,
  installNow = false,
} = {}) {
  if (checkingForUpdates) {
    if (manual) {
      notify(APP_NAME, "An update check is already running.");
    }
    return;
  }

  checkingForUpdates = true;
  try {
    const updateStarted = await checkForUpdates({ manual, installNow });
    if (!updateStarted) {
      return;
    }

    await stopWatcher();
    closeTray();
    process.exit(0);
  } finally {
    checkingForUpdates = false;
  }
}

async function main() {
  const isPrimaryInstance = await acquireSingleInstance(
    undefined,
    async ({ args = [] } = {}) => {
      if (args.some(isInstallUpdateActivation)) {
        await checkUpdates({ manual: true, installNow: true });
      }
    },
  );
  if (!isPrimaryInstance) {
    return;
  }

  await createTray({
    debug: debugMode,
    onCheckForUpdates: () => checkUpdates({ manual: true }),
  });
  await notifyCompletedUpdate();

  if (debugMode) {
    console.log(`${APP_NAME} debug mode enabled`);
  }

  await checkProcesses();

  await checkUpdates({
    manual: installUpdateRequested,
    installNow: installUpdateRequested,
  });

  setInterval(
    checkProcesses,
    CHECK_INTERVAL
  );
  setInterval(checkUpdates, UPDATE_CHECK_INTERVAL);
  logInfo("Automatic update checks scheduled", {
    intervalMs: UPDATE_CHECK_INTERVAL,
  });
}

process.once("exit", releaseSingleInstance);

main().catch((error) => {
  console.error(error);
  logError("Companion startup failed", error);
});

import SysTrayImport from "systray2";
import open from "open";

import { connectToDiscord } from "./auth.js";
import { APP_NAME, APP_VERSION, ICON_PATH } from "./config.js";
import { ensureTrayBinary } from "./trayBinary.js";
import {
  clearDiscordConnection,
  loadDiscordConnection,
  saveDiscordConnection,
} from "./discordConnectionStore.js";
import { logError, logInfo } from "./logger.js";

/** @type {SysTrayImport} */
const SysTray = SysTrayImport.default ?? SysTrayImport;

/** @type {SysTrayImport} */
let tray = null;
let trayRestartTimer = null;
let trayRestartAttempts = 0;
let trayClosing = false;

const TRAY_READY_TIMEOUT_MS = 15_000;

const trayState = {
  discordLinked: false,
  discordUsername: null,
};

function getDiscordItemTitle() {
  if (!trayState.discordLinked || !trayState.discordUsername) {
    return "Link Discord";
  }

  return `Discord: ${trayState.discordUsername}`;
}

function getDiscordItemTooltip() {
  if (!trayState.discordLinked || !trayState.discordUsername) {
    return "Link your Discord account";
  }

  return "Click to unlink your Discord account";
}

async function syncDiscordMenuItem() {
  if (!tray) {
    return;
  }

  const item = tray.internalIdMap.get(1);

  await tray.sendAction({
    type: "update-item",
    item: {
      ...item,
      title: getDiscordItemTitle(),
      tooltip: getDiscordItemTooltip(),
    },
  });
}

function buildMenu() {
  return [
    {
      title: "Link Discord",
      tooltip: "Link your Discord account",
      enabled: true,
    },
    SysTray.separator,
    {
      title: "Our website",
      tooltip: "Visit our website",
      enabled: true,
    },
    {
      title: "Support us",
      tooltip: "Support our development",
      enabled: true,
    },
    SysTray.separator,
    {
      title: `Version ${APP_VERSION}`,
      tooltip: `${APP_NAME} ${APP_VERSION}`,
      enabled: false,
    },
    SysTray.separator,
    {
      title: "Exit",
      tooltip: `Exit ${APP_NAME}`,
      enabled: true,
    },
  ];
}

export async function createTray({ debug = false } = {}) {
  trayClosing = false;
  const trayBinary = await ensureTrayBinary();
  logInfo("Starting system tray", {
    binary: trayBinary,
    icon: ICON_PATH,
    debug,
  });

  const nextTray = new SysTray({
    menu: {
      icon: ICON_PATH,
      title: APP_NAME,
      tooltip: APP_NAME,
      items: buildMenu(),
    },
    debug,
    copyDir: false,
  });
  tray = nextTray;

  const storedConnection = await loadDiscordConnection();
  if (storedConnection?.discordUsername) {
    trayState.discordLinked = true;
    trayState.discordUsername = storedConnection.discordUsername;
  }

  nextTray.onClick(async (action) => {
    const { title } = action.item;

    if (title === "Our website") {
      await open("https://compagnon-api.foxwar.net");
      return;
    }

    if (title === "Support us") {
      await open("https://ko-fi.com/c1ach0");
      return;
    }

    if (title === "Link Discord" || title.startsWith("Discord:")) {
      if (!trayState.discordLinked) {
        await connectToDiscord();
      } else {
        await clearDiscordUser();
      }

      return;
    }

    if (title === "Exit") {
      trayClosing = true;
      await nextTray.kill(false);
      process.exit(0);
    }
  });

  await Promise.race([
    nextTray.ready(),
    new Promise((_, reject) => {
      setTimeout(
        () => reject(new Error("System tray startup timed out")),
        TRAY_READY_TIMEOUT_MS,
      );
    }),
  ]);

  const trayProcess = nextTray.process;
  trayProcess?.stderr?.on("data", (data) => {
    logError("System tray process stderr", String(data).trim(), {
      pid: trayProcess.pid,
    });
  });
  nextTray.onError((error) => {
    logError("System tray process error", error, {
      pid: trayProcess?.pid,
      binary: nextTray.binPath,
    });
  });
  nextTray.onExit((code, signal) => {
    logError("System tray process exited", new Error("Tray process stopped"), {
      pid: trayProcess?.pid,
      code,
      signal,
      closing: trayClosing,
    });

    if (tray === nextTray) {
      tray = null;
    }

    if (!trayClosing) {
      scheduleTrayRestart({ debug });
    }
  });

  await syncDiscordMenuItem();

  trayRestartAttempts = 0;
  logInfo("System tray ready", {
    pid: trayProcess?.pid,
    binary: nextTray.binPath,
    version: APP_VERSION,
  });

  return nextTray;
}

function scheduleTrayRestart({ debug }) {
  if (trayRestartTimer || trayClosing) {
    return;
  }

  trayRestartAttempts += 1;
  const delayMs = Math.min(30_000, 1_000 * 2 ** (trayRestartAttempts - 1));
  logInfo("System tray restart scheduled", {
    attempt: trayRestartAttempts,
    delayMs,
  });

  trayRestartTimer = setTimeout(() => {
    trayRestartTimer = null;
    void createTray({ debug }).catch((error) => {
      logError("System tray restart failed", error, {
        attempt: trayRestartAttempts,
      });
      scheduleTrayRestart({ debug });
    });
  }, delayMs);
}

export async function setDiscordUser(username) {
  trayState.discordLinked = true;
  trayState.discordUsername = username;
  await saveDiscordConnection({
    discordLinked: true,
    discordUsername: username,
    linkedAt: new Date().toISOString(),
  });

  await syncDiscordMenuItem();
}

export async function clearDiscordUser() {
  trayState.discordLinked = false;
  trayState.discordUsername = null;
  await clearDiscordConnection();
  await syncDiscordMenuItem();
}

export function closeTray() {
  trayClosing = true;
  if (trayRestartTimer) {
    clearTimeout(trayRestartTimer);
    trayRestartTimer = null;
  }

  if (!tray) {
    return;
  }

  tray.kill(false);
  tray = null;
}

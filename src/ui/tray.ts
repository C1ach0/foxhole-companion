import type { ChildProcess } from "node:child_process";
import SysTrayRuntime from "systray2";
import type {
  Action,
  ClickEvent,
  Conf,
  MenuItem,
} from "systray2";
import open from "open";

import { connectToDiscord } from "../auth/auth.js";
import {
  clearDiscordConnection,
  loadDiscordConnection,
  saveDiscordConnection,
} from "../auth/discordConnectionStore.js";
import { APP_NAME, APP_VERSION, ICON_PATH } from "../core/config.js";
import { logError, logInfo } from "../core/logger.js";
import { ensureTrayBinary } from "./trayBinary.js";
import {
  disableStartup,
  enableStartup,
  isStartupEnabled,
} from "./windowsStartup.js";

type TrayInstance = {
  readonly binPath: string;
  readonly process: ChildProcess;
  kill(exitNode?: boolean): Promise<void>;
  onClick(listener: (action: ClickEvent) => void): Promise<TrayInstance>;
  onError(listener: (error: Error) => void): void;
  onExit(
    listener: (code: number | null, signal: string | null) => void,
  ): void;
  ready(): Promise<void>;
  sendAction(action: Action): Promise<TrayInstance>;
};

type SysTrayConstructor = {
  new(conf: Conf): TrayInstance;
  separator: MenuItem;
};

const sysTrayModule = SysTrayRuntime as unknown as
  | SysTrayConstructor
  | { default: SysTrayConstructor };
const SysTray: SysTrayConstructor =
  typeof sysTrayModule === "function"
    ? sysTrayModule
    : sysTrayModule.default;

type TrayOptions = {
  debug?: boolean;
  onCheckForUpdates?: (() => void | Promise<void>) | null;
};

let tray: TrayInstance | null = null;
let discordMenuItem: MenuItem | null = null;
let trayRestartTimer: ReturnType<typeof setTimeout> | null = null;
let trayRestartAttempts = 0;
let trayClosing = false;

const TRAY_READY_TIMEOUT_MS = 15_000;

const trayState = {
  discordLinked: false,
  discordUsername: null as string | null,
  startupEnabled: false,
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

  if (!discordMenuItem) {
    return;
  }

  await tray.sendAction({
    type: "update-item",
    item: {
      ...discordMenuItem,
      title: getDiscordItemTitle(),
      tooltip: getDiscordItemTooltip(),
    },
  });

  discordMenuItem.title = getDiscordItemTitle();
  discordMenuItem.tooltip = getDiscordItemTooltip();
}

function buildMenu(): MenuItem[] {
  discordMenuItem = {
    title: "Link Discord",
    tooltip: "Link your Discord account",
    enabled: true,
  };

  return [
    discordMenuItem,
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
    ...(process.platform === "win32"
      ? [
          SysTray.separator,
          {
            title: "Start with Windows",
            tooltip: "Launch Foxpile Companion when you sign in",
            checked: trayState.startupEnabled,
            enabled: true,
          },
        ]
      : []),
    SysTray.separator,
    {
      title: `Version ${APP_VERSION}`,
      tooltip: "Click to check for updates",
      enabled: true,
    },
    SysTray.separator,
    {
      title: "Exit",
      tooltip: `Exit ${APP_NAME}`,
      enabled: true,
    },
  ];
}

export async function createTray({
  debug = false,
  onCheckForUpdates = null,
}: TrayOptions = {}) {
  trayClosing = false;
  trayState.startupEnabled = await isStartupEnabled();
  const trayBinary = await ensureTrayBinary(debug);
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

  nextTray.onClick(async (action: ClickEvent) => {
    const { title } = action.item;

    if (title === "Our website") {
      await open("https://compagnon-api.foxwar.net");
      return;
    }

    if (title === "Support us") {
      await open("https://ko-fi.com/c1ach0");
      return;
    }

    if (title === "Start with Windows") {
      try {
        if (trayState.startupEnabled) {
          await disableStartup();
        } else {
          await enableStartup();
        }

        trayState.startupEnabled = !trayState.startupEnabled;
        await nextTray.sendAction({
          type: "update-item",
          item: {
            ...action.item,
            checked: trayState.startupEnabled,
          },
        });
      } catch (error) {
        logError("Failed to update Windows startup preference", error);
      }
      return;
    }

    if (title === `Version ${APP_VERSION}`) {
      await onCheckForUpdates?.();
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
  trayProcess?.stderr?.on("data", (data: Buffer) => {
    logError("System tray process stderr", String(data).trim(), {
      pid: trayProcess.pid,
    });
  });
  nextTray.onError((error: Error) => {
    logError("System tray process error", error, {
      pid: trayProcess?.pid,
      binary: nextTray.binPath,
    });
  });
  nextTray.onExit((code: number | null, signal: string | null) => {
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
      scheduleTrayRestart({ debug, onCheckForUpdates });
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

function scheduleTrayRestart({ debug, onCheckForUpdates }: TrayOptions) {
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
    void createTray({ debug, onCheckForUpdates }).catch((error) => {
      logError("System tray restart failed", error, {
        attempt: trayRestartAttempts,
      });
      scheduleTrayRestart({ debug, onCheckForUpdates });
    });
  }, delayMs);
}

export async function setDiscordUser(username: string) {
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

export async function closeTray() {
  trayClosing = true;
  if (trayRestartTimer) {
    clearTimeout(trayRestartTimer);
    trayRestartTimer = null;
  }

  if (!tray) {
    return;
  }

  const currentTray = tray;
  tray = null;
  await currentTray.kill(false);
}

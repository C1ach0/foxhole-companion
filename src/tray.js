import SysTrayImport from "systray2";
import open from "open";

import { connectToDiscord } from "./auth.js";
import { ICON_PATH } from "./config.js";
import {
  clearDiscordConnection,
  loadDiscordConnection,
  saveDiscordConnection,
} from "./discordConnectionStore.js";

/** @type {SysTrayImport} */
const SysTray = SysTrayImport.default ?? SysTrayImport;

/** @type {SysTrayImport} */
let tray = null;

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
      title: "Exit",
      tooltip: "Exit Foxpile",
      enabled: true,
    },
  ];
}

export async function createTray() {
  tray = new SysTray({
    menu: {
      icon: ICON_PATH,
      title: "Foxpile",
      tooltip: "Foxhole Companion",
      items: buildMenu(),
    },
    debug: false,
    copyDir: false,
  });

  const storedConnection = await loadDiscordConnection();
  if (storedConnection?.discordUsername) {
    trayState.discordLinked = true;
    trayState.discordUsername = storedConnection.discordUsername;
  }

  tray.onClick(async (action) => {
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
      tray.kill(false);
      process.exit(0);
    }
  });

  await tray.ready();
  await syncDiscordMenuItem();

  console.log("Tray ready");

  return tray;
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

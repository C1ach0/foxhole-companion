import fs from "node:fs/promises";
import path from "node:path";
import { getAppDataDir } from "./config.js";

const STATE_DIR = getAppDataDir();
const LEGACY_STATE_DIR = getAppDataDir("Foxpile");
const STATE_FILE = path.join(STATE_DIR, "discord-connection.json");
const LEGACY_STATE_FILE = path.join(LEGACY_STATE_DIR, "discord-connection.json");

async function readConnection(filePath) {
  const raw = await fs.readFile(filePath, "utf8");
  return JSON.parse(raw);
}

export async function loadDiscordConnection() {
  try {
    return await readConnection(STATE_FILE);
  } catch (error) {
    if (error?.code !== "ENOENT") {
      console.error("Failed to load Discord connection state:", error);
    }
  }

  try {
    const legacyConnection = await readConnection(LEGACY_STATE_FILE);
    await saveDiscordConnection(legacyConnection);

    return legacyConnection;
  } catch (error) {
    if (error?.code !== "ENOENT") {
      console.error("Failed to load legacy Discord connection state:", error);
    }
  }

  return null;
}

export async function saveDiscordConnection(connection) {
  await fs.mkdir(STATE_DIR, { recursive: true });
  await fs.writeFile(STATE_FILE, `${JSON.stringify(connection, null, 2)}\n`, "utf8");
}

export async function clearDiscordConnection() {
  try {
    await fs.unlink(STATE_FILE);
  } catch (error) {
    if (error?.code === "ENOENT") {
      return;
    }

    console.error("Failed to clear Discord connection state:", error);
  }
}

export function getDiscordConnectionFilePath() {
  return STATE_FILE;
}

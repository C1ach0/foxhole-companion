import fs from "node:fs/promises";
import path from "node:path";
import { getFoxpileDataDir } from "./config.js";

const STATE_DIR = getFoxpileDataDir();
const STATE_FILE = path.join(STATE_DIR, "discord-connection.json");

export async function loadDiscordConnection() {
  try {
    const raw = await fs.readFile(STATE_FILE, "utf8");
    return JSON.parse(raw);
  } catch (error) {
    if (error?.code === "ENOENT") {
      return null;
    }

    console.error("Failed to load Discord connection state:", error);
    return null;
  }
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

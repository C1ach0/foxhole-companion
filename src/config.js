import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";
import {
  FOXPILE_API_URL as BUILT_API_URL,
  FOXPILE_COMPANION_ID as BUILT_COMPANION_ID,
  FOXPILE_COMPANION_SECRET as BUILT_COMPANION_SECRET,
  FOXPILE_COMPANION_SKEW_MS as BUILT_COMPANION_SKEW_MS,
  FOXPILE_GAME_PROCESS as BUILT_GAME_PROCESS,
} from "./generated-config.js";

function pickConfigValue(envName, builtValue, fallback) {
  if (process.env[envName] !== undefined && process.env[envName] !== "") {
    return process.env[envName];
  }

  if (builtValue !== undefined && builtValue !== "") {
    return builtValue;
  }

  return fallback;
}

export function getFoxpileDataDir() {
  if (process.platform === "win32") {
    return path.join(process.env.LOCALAPPDATA, "Foxpile");
  }

  if (process.platform === "darwin") {
    return path.join(os.homedir(), "Library", "Application Support", "Foxpile");
  }

  return path.join(
    process.env.XDG_CONFIG_HOME || path.join(os.homedir(), ".config"),
    "Foxpile",
  );
}

export const GAME_PROCESS = pickConfigValue(
  "FOXPILE_GAME_PROCESS",
  BUILT_GAME_PROCESS,
  "war.exe",
);
export const API_URL = pickConfigValue(
  "FOXPILE_API_URL",
  BUILT_API_URL,
  "http://localhost:3000/api",
);
export const COMPANION_ID = pickConfigValue(
  "FOXPILE_COMPANION_ID",
  BUILT_COMPANION_ID,
  "foxpile-companion",
);
export const COMPANION_SECRET = pickConfigValue(
  "FOXPILE_COMPANION_SECRET",
  BUILT_COMPANION_SECRET,
  "",
);
export const COMPANION_SKEW_MS = Number(
  pickConfigValue(
    "FOXPILE_COMPANION_SKEW_MS",
    BUILT_COMPANION_SKEW_MS,
    300000,
  ),
);

export const SAVE_DIR = path.join(
  getFoxpileDataDir(),
  "Foxhole",
  "Saved",
  "SaveGames",
);

export const CHECK_INTERVAL = 3000;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
export const ICON_PATH =
  process.platform === "win32"
    ? path.join(__dirname, "..", "assets", "foxpile-icon.ico")
    : path.join(__dirname, "..", "assets", "foxpile-icon.png");

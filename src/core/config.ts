import os from "node:os";
import path from "node:path";
import {
  FOXPILE_API_URL as BUILT_API_URL,
  FOXPILE_COMPANION_ID as BUILT_COMPANION_ID,
  FOXPILE_COMPANION_SECRET as BUILT_COMPANION_SECRET,
  FOXPILE_COMPANION_SKEW_MS as BUILT_COMPANION_SKEW_MS,
  FOXPILE_GAME_PROCESS as BUILT_GAME_PROCESS,
} from "./generated-config.js";
import { resolveAssetPath } from "./assets.js";

export const APP_NAME = "Foxpile Companion";
export const APP_USER_MODEL_ID = "C1ach0.FoxpileCompanion";
export const APP_VERSION =
  typeof __FOXPILE_APP_VERSION__ === "undefined"
    ? "0.0.0-dev"
    : __FOXPILE_APP_VERSION__;
export const UPDATE_REPOSITORY = "C1ach0/foxhole-companion";

function pickConfigValue<T>(
  envName: string,
  builtValue: T | "" | undefined,
  fallback: T,
): string | T {
  if (process.env[envName] !== undefined && process.env[envName] !== "") {
    return process.env[envName];
  }

  if (builtValue !== undefined && builtValue !== "") {
    return builtValue;
  }

  return fallback;
}

export function getAppDataDir(appName = APP_NAME) {
  if (process.platform === "win32") {
    return path.join(
      process.env.LOCALAPPDATA ?? path.join(os.homedir(), "AppData", "Local"),
      appName,
    );
  }

  if (process.platform === "darwin") {
    return path.join(os.homedir(), "Library", "Application Support", appName);
  }

  return path.join(
    process.env.XDG_CONFIG_HOME || path.join(os.homedir(), ".config"),
    appName,
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
  process.platform === "win32"
    ? path.join(os.homedir(), "AppData", "Local")
    : getAppDataDir(),
  "Foxhole",
  "Saved",
  "SaveGames",
);

export const CHECK_INTERVAL = 3000;
export const UPDATE_CHECK_INTERVAL = 30 * 60 * 1000;

export const ICON_PATH = resolveAssetPath(
  process.platform === "win32" ? "foxpile-icon.ico" : "foxpile-icon.png",
);

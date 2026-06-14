import fs from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { spawn } from "node:child_process";
import {
  APP_NAME,
  APP_VERSION,
  UPDATE_REPOSITORY,
  getAppDataDir,
} from "./config.js";
import { isSeaApplication } from "./runtime.js";
import { notify, notifyAction } from "./notifier.js";
import { logError, logInfo } from "./logger.js";
import {
  compareVersions,
  selectWindowsInstaller,
} from "./updateRelease.js";

const RELEASE_API_URL = `https://api.github.com/repos/${UPDATE_REPOSITORY}/releases/latest`;
const UPDATE_DIR = path.join(getAppDataDir(), "updates");
const UPDATE_RESULT_MARKER = path.join(UPDATE_DIR, "installed.json");
let lastNotifiedVersion = null;
async function fetchLatestRelease() {
  const response = await fetch(RELEASE_API_URL, {
    headers: {
      Accept: "application/vnd.github+json",
      "User-Agent": `Foxpile-Companion/${APP_VERSION}`,
      "X-GitHub-Api-Version": "2022-11-28",
    },
    signal: AbortSignal.timeout(10000),
  });

  if (!response.ok) {
    throw new Error(`GitHub release check returned HTTP ${response.status}`);
  }

  return response.json();
}

async function downloadInstaller(url, version) {
  await fs.mkdir(UPDATE_DIR, { recursive: true });
  const installerPath = path.join(
    UPDATE_DIR,
    `Foxpile-Companion-${version}-Setup.exe`,
  );
  const response = await fetch(url, {
    headers: {
      "User-Agent": `Foxpile-Companion/${APP_VERSION}`,
    },
    redirect: "follow",
    signal: AbortSignal.timeout(120000),
  });

  if (!response.ok || !response.body) {
    throw new Error(`Update download returned HTTP ${response.status}`);
  }

  await pipeline(
    Readable.fromWeb(response.body),
    (await import("node:fs")).createWriteStream(installerPath),
  );
  return installerPath;
}

function getLauncherPath() {
  return path.join(path.dirname(process.execPath), "Foxpile Companion.exe");
}

function getUpdaterPath() {
  return path.join(
    path.dirname(process.execPath),
    "Foxpile Companion Updater.exe",
  );
}

async function prepareUpdater(version) {
  await fs.mkdir(UPDATE_DIR, { recursive: true });
  const updaterName = `Foxpile-Companion-Updater-${version}.exe`;
  const updaterPath = path.join(UPDATE_DIR, updaterName);

  for (const entry of await fs.readdir(UPDATE_DIR)) {
    if (
      entry.startsWith("Foxpile-Companion-Updater-") &&
      entry.endsWith(".exe") &&
      entry !== updaterName
    ) {
      await fs.rm(path.join(UPDATE_DIR, entry), { force: true });
    }
  }

  await fs.copyFile(getUpdaterPath(), updaterPath);
  return updaterPath;
}

async function startDetachedInstaller(installerPath, version) {
  const updaterPath = await prepareUpdater(version);
  const child = spawn(
    updaterPath,
    [
      "--parent-pid",
      String(process.pid),
      "--installer",
      installerPath,
      "--version",
      version,
      "--marker",
      UPDATE_RESULT_MARKER,
      "--launcher",
      getLauncherPath(),
    ],
    {
      detached: true,
      stdio: "ignore",
      windowsHide: true,
    },
  );
  await new Promise((resolve, reject) => {
    child.once("spawn", resolve);
    child.once("error", reject);
  });
  child.unref();
}

export async function notifyCompletedUpdate() {
  try {
    const marker = JSON.parse(await fs.readFile(UPDATE_RESULT_MARKER, "utf8"));
    await fs.rm(UPDATE_RESULT_MARKER, { force: true });
    if (marker.success) {
      notify(
        APP_NAME,
        `Update ${marker.version} installed successfully.`,
      );
      return;
    }

    notify(
      APP_NAME,
      `Update ${marker.version} failed (code ${marker.exitCode}). The previous version is still available.`,
    );
  } catch (error) {
    if (error?.code !== "ENOENT") {
      logError("Failed to read update completion marker", error);
    }
  }
}

export async function checkForUpdates({
  manual = false,
  installNow = false,
} = {}) {
  if (
    process.platform !== "win32" ||
    !isSeaApplication() ||
    APP_VERSION.endsWith("-dev")
  ) {
    return false;
  }

  try {
    const release = await fetchLatestRelease();
    const latestVersion = String(release.tag_name || "").replace(/^v/i, "");
    if (!latestVersion || compareVersions(latestVersion, APP_VERSION) <= 0) {
      logInfo("Companion update check completed", {
        currentVersion: APP_VERSION,
        latestVersion: latestVersion || null,
      });
      if (manual) {
        notify(
          APP_NAME,
          `You already have the latest version (${APP_VERSION}).`,
        );
      }
      return false;
    }

    const installer = selectWindowsInstaller(release, UPDATE_REPOSITORY);
    if (!installer) {
      throw new Error(`Release ${release.tag_name} has no Windows installer`);
    }

    if (!installNow) {
      if (latestVersion === lastNotifiedVersion && !manual) {
        logInfo("Companion update notification already displayed", {
          latestVersion,
        });
        return false;
      }

      notifyAction(
        `${APP_NAME} update available`,
        `Version ${latestVersion} is available (installed: ${APP_VERSION}).`,
        "Install now",
        "foxpile-companion://install-update",
      );
      lastNotifiedVersion = latestVersion;
      logInfo("Companion update notification displayed", {
        latestVersion,
        manual,
      });
      return false;
    }

    notify(APP_NAME, `Downloading update ${latestVersion}...`);
    const installerPath = await downloadInstaller(
      installer.browser_download_url,
      latestVersion,
    );
    await startDetachedInstaller(installerPath, latestVersion);
    logInfo("Companion update installer started", { latestVersion });
    return true;
  } catch (error) {
    logError("Companion update check failed", error);
    if (manual) {
      notify(
        APP_NAME,
        "Unable to check for updates. See the logs for details.",
      );
    }
    return false;
  }
}

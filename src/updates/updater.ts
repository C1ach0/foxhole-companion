import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { createReadStream, createWriteStream } from "node:fs";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { spawn } from "node:child_process";
import {
  APP_NAME,
  APP_VERSION,
  UPDATE_REPOSITORY,
  getAppDataDir,
} from "../core/config.js";
import { hasErrorCode } from "../core/errors.js";
import { logError, logInfo } from "../core/logger.js";
import { isSeaApplication } from "../core/runtime.js";
import type { GitHubRelease } from "../core/types.js";
import { notify, notifyAction } from "../ui/notifier.js";
import {
  compareVersions,
  selectWindowsInstaller,
} from "./updateRelease.js";

const RELEASE_API_URL = `https://api.github.com/repos/${UPDATE_REPOSITORY}/releases/latest`;
const UPDATE_DIR = path.join(getAppDataDir(), "updates");
const UPDATE_RESULT_MARKER = path.join(UPDATE_DIR, "installed.json");
let lastNotifiedVersion: string | null = null;
async function fetchLatestRelease(): Promise<GitHubRelease> {
  const response = await fetch(RELEASE_API_URL, {
    headers: {
      Accept: "application/vnd.github+json",
      "User-Agent": `Foxpile-Companion/${APP_VERSION}`,
      "X-GitHub-Api-Version": "2026-03-10",
    },
    signal: AbortSignal.timeout(10000),
  });

  if (!response.ok) {
    throw new Error(`GitHub release check returned HTTP ${response.status}`);
  }

  return response.json() as Promise<GitHubRelease>;
}

export function parseSha256Digest(digest: string | undefined) {
  const match = /^sha256:([a-f0-9]{64})$/i.exec(digest ?? "");
  if (!match) {
    throw new Error("GitHub release asset has no valid SHA-256 digest");
  }

  return match[1].toLowerCase();
}

async function calculateFileSha256(filePath: string) {
  const hash = crypto.createHash("sha256");
  for await (const chunk of createReadStream(filePath)) {
    hash.update(chunk);
  }
  return hash.digest("hex");
}

async function downloadInstaller(
  url: string,
  version: string,
  expectedDigest: string | undefined,
) {
  await fs.mkdir(UPDATE_DIR, { recursive: true });
  const installerPath = path.join(
    UPDATE_DIR,
    `Foxpile-Companion-${version}-Setup.exe`,
  );
  const temporaryPath = `${installerPath}.download`;
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

  try {
    await pipeline(
      Readable.fromWeb(
        response.body as import("node:stream/web").ReadableStream,
      ),
      createWriteStream(temporaryPath),
    );

    const expectedSha256 = parseSha256Digest(expectedDigest);
    const actualSha256 = await calculateFileSha256(temporaryPath);
    if (actualSha256 !== expectedSha256) {
      throw new Error(
        `Downloaded installer SHA-256 mismatch (expected ${expectedSha256}, received ${actualSha256})`,
      );
    }

    await fs.rm(installerPath, { force: true });
    await fs.rename(temporaryPath, installerPath);
  } catch (error) {
    await fs.rm(temporaryPath, { force: true });
    throw error;
  }

  return installerPath;
}

function getCompanionPath() {
  return process.execPath;
}

function getUpdaterPath() {
  return path.join(
    path.dirname(process.execPath),
    "Foxpile Companion Updater.exe",
  );
}

async function prepareUpdater(version: string) {
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

export function buildUpdaterArguments({
  parentPid,
  installerPath,
  version,
  markerPath,
  companionPath,
}: {
  parentPid: number;
  installerPath: string;
  version: string;
  markerPath: string;
  companionPath: string;
}) {
  return [
    "--parent-pid",
    String(parentPid),
    "--installer",
    installerPath,
    "--version",
    version,
    "--marker",
    markerPath,
    "--launcher",
    companionPath,
  ];
}

async function startDetachedInstaller(installerPath: string, version: string) {
  const updaterPath = await prepareUpdater(version);
  const child = spawn(
    updaterPath,
    buildUpdaterArguments({
      parentPid: process.pid,
      installerPath,
      version,
      markerPath: UPDATE_RESULT_MARKER,
      companionPath: getCompanionPath(),
    }),
    {
      detached: true,
      stdio: "ignore",
      windowsHide: true,
    },
  );
  await new Promise<void>((resolve, reject) => {
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
    if (!hasErrorCode(error, "ENOENT")) {
      logError("Failed to read update completion marker", error);
    }
  }
}

export async function checkForUpdates({
  manual = false,
  installNow = false,
}: {
  manual?: boolean;
  installNow?: boolean;
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
      installer.browser_download_url!,
      latestVersion,
      installer.digest,
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

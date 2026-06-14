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
import { confirm, notify } from "./notifier.js";
import { logError, logInfo } from "./logger.js";
import {
  compareVersions,
  selectWindowsInstaller,
} from "./updateRelease.js";

const RELEASE_API_URL = `https://api.github.com/repos/${UPDATE_REPOSITORY}/releases/latest`;
const UPDATE_DIR = path.join(getAppDataDir(), "updates");
const UPDATE_RESULT_MARKER = path.join(UPDATE_DIR, "installed.json");
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

async function startDetachedInstaller(installerPath, version) {
  const script = `
$ErrorActionPreference = 'Stop'
Wait-Process -Id $env:FOXPILE_PARENT_PID -ErrorAction SilentlyContinue
$exitCode = -1
try {
  $process = Start-Process -FilePath $env:FOXPILE_INSTALLER -ArgumentList '/VERYSILENT','/SUPPRESSMSGBOXES','/NORESTART','/CLOSEAPPLICATIONS' -Wait -PassThru
  $exitCode = $process.ExitCode
} catch {
  $exitCode = -1
}
$marker = @{
  version = $env:FOXPILE_UPDATE_VERSION
  installedAt = [DateTime]::UtcNow.ToString('o')
  success = ($exitCode -eq 0)
  exitCode = $exitCode
} | ConvertTo-Json -Compress
[System.IO.File]::WriteAllText($env:FOXPILE_SUCCESS_MARKER, $marker)
Start-Process -FilePath $env:FOXPILE_LAUNCHER
`;
  const encoded = Buffer.from(script, "utf16le").toString("base64");
  const child = spawn(
    "powershell.exe",
    [
      "-NoLogo",
      "-NoProfile",
      "-NonInteractive",
      "-ExecutionPolicy",
      "Bypass",
      "-WindowStyle",
      "Hidden",
      "-EncodedCommand",
      encoded,
    ],
    {
      detached: true,
      env: {
        ...process.env,
        FOXPILE_PARENT_PID: String(process.pid),
        FOXPILE_INSTALLER: installerPath,
        FOXPILE_UPDATE_VERSION: version,
        FOXPILE_SUCCESS_MARKER: UPDATE_RESULT_MARKER,
        FOXPILE_LAUNCHER: getLauncherPath(),
      },
      stdio: "ignore",
      windowsHide: true,
    },
  );
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

export async function checkForUpdates() {
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
      return false;
    }

    const installer = selectWindowsInstaller(release, UPDATE_REPOSITORY);
    if (!installer) {
      throw new Error(`Release ${release.tag_name} has no Windows installer`);
    }

    notify(
      APP_NAME,
      `Update ${latestVersion} is available. Confirmation is required to install it.`,
    );
    const accepted = await confirm(
      `${APP_NAME} update`,
      `Version ${latestVersion} is available (installed: ${APP_VERSION}). Install it now?`,
    );
    if (!accepted) {
      logInfo("Companion update declined", { latestVersion });
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
    return false;
  }
}

import { spawn } from "node:child_process";

const STARTUP_KEY = "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run";
const STARTUP_VALUE_NAME = "Foxpile Companion";

type RegistryResult = {
  code: number;
  stdout: string;
  stderr: string;
};

type StartupServiceOptions = {
  platform?: NodeJS.Platform;
  execPath?: string;
  runRegistry?: (args: string[]) => Promise<RegistryResult>;
};

function runRegistry(args: string[]): Promise<RegistryResult> {
  return new Promise((resolve, reject) => {
    const child = spawn("reg.exe", args, {
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    });
    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString("utf8");
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString("utf8");
    });
    child.once("error", reject);
    child.once("close", (code) => {
      resolve({ code: code ?? 1, stdout, stderr });
    });
  });
}

export function createStartupService({
  platform = process.platform,
  execPath = process.execPath,
  runRegistry: executeRegistry = runRegistry,
}: StartupServiceOptions = {}) {
  function assertWindows() {
    if (platform !== "win32") {
      throw new Error("Windows startup is only available on Windows");
    }
  }

  async function isStartupEnabled() {
    if (platform !== "win32") {
      return false;
    }

    const result = await executeRegistry([
      "QUERY",
      STARTUP_KEY,
      "/v",
      STARTUP_VALUE_NAME,
    ]);
    return result.code === 0;
  }

  async function enableStartup() {
    assertWindows();
    const result = await executeRegistry([
      "ADD",
      STARTUP_KEY,
      "/v",
      STARTUP_VALUE_NAME,
      "/t",
      "REG_SZ",
      "/d",
      `"${execPath}"`,
      "/f",
    ]);
    if (result.code !== 0) {
      throw new Error(
        `Unable to enable Windows startup: ${result.stderr.trim() || `reg.exe exited with code ${result.code}`}`,
      );
    }
  }

  async function disableStartup() {
    assertWindows();
    if (!(await isStartupEnabled())) {
      return;
    }

    const result = await executeRegistry([
      "DELETE",
      STARTUP_KEY,
      "/v",
      STARTUP_VALUE_NAME,
      "/f",
    ]);
    if (result.code !== 0) {
      throw new Error(
        `Unable to disable Windows startup: ${result.stderr.trim() || `reg.exe exited with code ${result.code}`}`,
      );
    }
  }

  return {
    enableStartup,
    disableStartup,
    isStartupEnabled,
  };
}

const startupService = createStartupService();

export const enableStartup = startupService.enableStartup;
export const disableStartup = startupService.disableStartup;
export const isStartupEnabled = startupService.isStartupEnabled;

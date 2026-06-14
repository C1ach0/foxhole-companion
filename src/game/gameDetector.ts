import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { GAME_PROCESS } from "../core/config.js";

const execFileAsync = promisify(execFile);

export async function isGameRunning() {
  if (process.platform !== "win32") {
    return false;
  }

  const { stdout } = await execFileAsync("tasklist", [
    "/FO",
    "CSV",
    "/NH",
    "/FI",
    `IMAGENAME eq ${GAME_PROCESS}`,
  ]);

  return stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .some((line) => line.toLowerCase().startsWith(`"${GAME_PROCESS.toLowerCase()}"`));
}

import fs from "node:fs/promises";
import path from "node:path";
import { isSeaApplication } from "../core/runtime.js";

const sourceTrayBinary = path.join(
  process.cwd(),
  "node_modules",
  "systray2",
  "traybin",
  "tray_windows_release.exe",
);

export async function ensureTrayBinary(debug = false) {
  if (process.platform !== "win32") {
    return null;
  }

  const installedTrayBinary = path.join(
    path.dirname(process.execPath),
    "traybin",
    debug ? "tray_windows.exe" : "tray_windows_release.exe",
  );

  try {
    await fs.access(installedTrayBinary);
    return installedTrayBinary;
  } catch {
    if (isSeaApplication()) {
      throw new Error(`Missing tray binary: ${installedTrayBinary}`);
    }

    const trayDir = path.dirname(installedTrayBinary);

    await fs.mkdir(trayDir, { recursive: true });
    await fs.copyFile(sourceTrayBinary, installedTrayBinary);
    return installedTrayBinary;
  }
}

import fs from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(path.join(process.cwd(), "index.js"));
const sourceTrayBinary = path.join(
  path.dirname(require.resolve("systray2/package.json")),
  "traybin",
  "tray_windows_release.exe",
);
const installedTrayBinary = path.join(
  path.dirname(process.execPath),
  "traybin",
  "tray_windows.exe",
);

export async function ensureTrayBinary() {
  if (process.platform !== "win32") {
    return null;
  }

  try {
    await fs.access(installedTrayBinary);
    return installedTrayBinary;
  } catch {
    if (process.versions.sea) {
      throw new Error(`Missing tray binary: ${installedTrayBinary}`);
    }

    const trayDir = path.dirname(installedTrayBinary);

    await fs.mkdir(trayDir, { recursive: true });
    await fs.copyFile(sourceTrayBinary, installedTrayBinary);
    return installedTrayBinary;
  }
}

import fs from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(path.join(process.cwd(), "package.json"));
const systrayRoot = path.dirname(require.resolve("systray2/package.json"));
const sourceTrayBinary = path.join(systrayRoot, "traybin", "tray_windows_release.exe");

export async function ensureTrayBinary() {
  if (process.platform !== "win32") {
    return null;
  }

  const trayDir = path.join(process.cwd(), "traybin");
  const runtimeTrayBinary = path.join(trayDir, "tray_windows.exe");

  try {
    await fs.access(runtimeTrayBinary);
    return runtimeTrayBinary;
  } catch {
    await fs.mkdir(trayDir, { recursive: true });
    await fs.copyFile(sourceTrayBinary, runtimeTrayBinary);
    return runtimeTrayBinary;
  }
}

import fs from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import esbuild from "esbuild";
import { rcedit } from "rcedit";

const require = createRequire(import.meta.url);
const rootDir = fileURLToPath(new URL("..", import.meta.url));
const distDir = path.join(rootDir, "dist");
const installerDir = path.join(distDir, "installer");
const bundlePath = path.join(distDir, "foxpile-companion.bundle.js");
const seaConfigPath = path.join(distDir, "sea-config.json");
const seaBlobPath = path.join(distDir, "foxpile-companion.blob");
const payloadExePath = path.join(distDir, "Foxpile Companion.core.exe");
const launcherExePath = path.join(distDir, "Foxpile Companion.exe");
const packageJsonPath = path.join(rootDir, "package.json");
const traybinSource = path.join(path.dirname(require.resolve("systray2/package.json")), "traybin");
const traybinTarget = path.join(distDir, "traybin");
const iconPath = path.join(rootDir, "assets", "foxpile-icon.ico");
const postjectCli = path.join(path.dirname(require.resolve("postject/package.json")), "dist", "cli.js");
const launcherSource = path.join(rootDir, "tools", "windows-launcher.go");
const skipInstaller =
  process.env.FOXPILE_SKIP_INSTALLER === "1" || process.argv.includes("--skip-installer");

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: "inherit",
      shell: false,
      ...options,
    });

    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`${command} exited with code ${code}`));
    });
  });
}

async function main() {
  const packageJson = JSON.parse(await fs.readFile(packageJsonPath, "utf8"));

  await fs.rm(distDir, { recursive: true, force: true });
  await fs.mkdir(distDir, { recursive: true });
  await fs.mkdir(installerDir, { recursive: true });
  await fs.cp(traybinSource, traybinTarget, { recursive: true });
  await fs.copyFile(
    path.join(traybinSource, "tray_windows_release.exe"),
    path.join(traybinTarget, "tray_windows.exe"),
  );

  await esbuild.build({
    entryPoints: [path.join(rootDir, "index.js")],
    bundle: true,
    format: "cjs",
    platform: "node",
    target: "node24",
    outfile: bundlePath,
    sourcemap: false,
    logLevel: "info",
    packages: "bundle",
    define: {
      __FOXPILE_APP_VERSION__: JSON.stringify(packageJson.version),
    },
  });

  await fs.writeFile(
    seaConfigPath,
    `${JSON.stringify(
      {
        main: bundlePath,
        mainFormat: "commonjs",
        output: seaBlobPath,
        disableExperimentalSEAWarning: true,
        useCodeCache: false,
        assets: {
          "foxpile-icon.ico": path.join(rootDir, "assets", "foxpile-icon.ico"),
          "foxpile-icon.png": path.join(rootDir, "assets", "foxpile-icon.png"),
        },
      },
      null,
      2,
    )}\n`,
    "utf8",
  );

  await run(process.execPath, ["--experimental-sea-config", seaConfigPath], {
    cwd: rootDir,
  });

  await fs.copyFile(process.execPath, payloadExePath);

  await rcedit(payloadExePath, {
    icon: iconPath,
    "file-version": packageJson.version,
    "product-version": packageJson.version,
    "requested-execution-level": "asInvoker",
    "version-string": {
      CompanyName: packageJson.author,
      FileDescription: packageJson.productName,
      InternalName: "foxpile-companion",
      OriginalFilename: "Foxpile Companion.exe",
      ProductName: packageJson.productName,
    },
  });

  await run(process.execPath, [postjectCli, payloadExePath, "NODE_SEA_BLOB", seaBlobPath, "--sentinel-fuse", "NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2"], {
    cwd: rootDir,
  });

  await run("go", [
    "build",
    "-trimpath",
    "-ldflags",
    "-H windowsgui",
    "-o",
    launcherExePath,
    launcherSource,
  ], {
    cwd: rootDir,
  });

  if (!skipInstaller) {
    await run(
      "iscc",
      [
        `/DAppVersion=${packageJson.version}`,
        path.join(rootDir, "installer", "FoxpileCompanion.iss"),
      ],
      {
        cwd: rootDir,
      },
    );
  } else {
    console.log("Skipping Inno Setup installer build");
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

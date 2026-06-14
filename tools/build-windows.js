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
const appExePath = path.join(distDir, "Foxpile Companion.exe");
const updaterExePath = path.join(distDir, "Foxpile Companion Updater.exe");
const packageJsonPath = path.join(rootDir, "package.json");
const traybinSource = path.join(path.dirname(require.resolve("systray2/package.json")), "traybin");
const traybinTarget = path.join(distDir, "traybin");
const iconPath = path.join(rootDir, "assets", "foxpile-icon.ico");
const postjectCli = path.join(path.dirname(require.resolve("postject/package.json")), "dist", "cli.js");
const updaterSource = path.join(rootDir, "tools", "windows-updater.go");
const goVersionInfoPackage =
  "github.com/josephspurrier/goversioninfo/cmd/goversioninfo@v1.7.0";
const seaFuse = "NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2";
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

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function createWindowsSea(packageJson, versionStrings) {
  const injectionArguments = [
    postjectCli,
    appExePath,
    "NODE_SEA_BLOB",
    seaBlobPath,
    "--sentinel-fuse",
    seaFuse,
  ];

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    await fs.rm(appExePath, { force: true });
    await fs.copyFile(process.execPath, appExePath);

    await rcedit(appExePath, {
      icon: iconPath,
      "file-version": packageJson.version,
      "product-version": packageJson.version,
      "requested-execution-level": "asInvoker",
      "version-string": {
        ...versionStrings,
        FileDescription: packageJson.productName,
        InternalName: "foxpile-companion",
        OriginalFilename: "Foxpile Companion.exe",
      },
    });

    // Windows security scanners can briefly retain the PE after rcedit exits.
    await delay(attempt * 500);

    try {
      await run(process.execPath, injectionArguments, { cwd: rootDir });
      return;
    } catch (error) {
      if (attempt === 3) {
        throw error;
      }

      console.warn(`SEA injection attempt ${attempt} failed; retrying`);
      await delay(attempt * 1_000);
    }
  }
}

async function markAsWindowsGui(executablePath) {
  const executable = await fs.readFile(executablePath);
  const peHeaderOffset = executable.readUInt32LE(0x3c);

  if (executable.toString("ascii", peHeaderOffset, peHeaderOffset + 4) !== "PE\0\0") {
    throw new Error(`${executablePath} is not a valid PE executable`);
  }

  const optionalHeaderOffset = peHeaderOffset + 4 + 20;
  const optionalHeaderMagic = executable.readUInt16LE(optionalHeaderOffset);
  if (optionalHeaderMagic !== 0x10b && optionalHeaderMagic !== 0x20b) {
    throw new Error(
      `${executablePath} has an unsupported PE optional header (0x${optionalHeaderMagic.toString(16)})`,
    );
  }

  const subsystemOffset = optionalHeaderOffset + 0x44;
  executable.writeUInt16LE(2, subsystemOffset);
  await fs.writeFile(executablePath, executable);
}

async function verifyWindowsSea(executablePath) {
  const executable = await fs.readFile(executablePath);
  const peHeaderOffset = executable.readUInt32LE(0x3c);
  const optionalHeaderOffset = peHeaderOffset + 4 + 20;
  const subsystem = executable.readUInt16LE(optionalHeaderOffset + 0x44);

  if (subsystem !== 2) {
    throw new Error(
      `${executablePath} is not a Windows GUI executable (subsystem ${subsystem})`,
    );
  }

  if (!executable.includes(Buffer.from(`${seaFuse}:1`))) {
    throw new Error(`${executablePath} does not contain an injected SEA blob`);
  }
}

async function buildGoExecutable({
  source,
  output,
  buildName,
  version,
  productName,
  author,
  description,
  internalName,
  originalFilename,
}) {
  const buildDir = path.join(distDir, `.build-${buildName}`);
  const manifestPath = path.join(buildDir, "app.manifest");
  const resourcePath = path.join(buildDir, "resource.syso");
  const versionInfoPath = path.join(buildDir, "versioninfo.json");

  await fs.mkdir(buildDir, { recursive: true });
  await fs.copyFile(source, path.join(buildDir, "main.go"));
  await fs.writeFile(
    path.join(buildDir, "go.mod"),
    `module foxpile.local/${buildName}\n\ngo 1.25\n`,
    "utf8",
  );
  await fs.writeFile(
    manifestPath,
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<assembly xmlns="urn:schemas-microsoft-com:asm.v1" manifestVersion="1.0">
  <trustInfo xmlns="urn:schemas-microsoft-com:asm.v3">
    <security>
      <requestedPrivileges>
        <requestedExecutionLevel level="asInvoker" uiAccess="false"/>
      </requestedPrivileges>
    </security>
  </trustInfo>
</assembly>
`,
    "utf8",
  );
  await fs.writeFile(versionInfoPath, "{}\n", "utf8");

  await run(
    "go",
    [
      "run",
      goVersionInfoPackage,
      "-64",
      "-propagate-ver-strings",
      "-file-version",
      version,
      "-product-version",
      version,
      "-company",
      author,
      "-copyright",
      `Copyright (C) 2026 ${author}`,
      "-description",
      description,
      "-internal-name",
      internalName,
      "-original-name",
      originalFilename,
      "-product-name",
      productName,
      "-icon",
      iconPath,
      "-manifest",
      manifestPath,
      "-o",
      resourcePath,
      versionInfoPath,
    ],
    { cwd: buildDir },
  );

  await run(
    "go",
    [
      "build",
      "-trimpath",
      "-ldflags",
      "-H windowsgui",
      "-o",
      output,
      ".",
    ],
    { cwd: buildDir },
  );
}

async function main() {
  const packageJson = JSON.parse(await fs.readFile(packageJsonPath, "utf8"));
  const versionStrings = {
    CompanyName: packageJson.author,
    LegalCopyright: `Copyright (C) 2026 ${packageJson.author}`,
    ProductName: packageJson.productName,
  };

  await fs.rm(distDir, { recursive: true, force: true });
  await fs.mkdir(distDir, { recursive: true });
  await fs.mkdir(installerDir, { recursive: true });
  await fs.mkdir(traybinTarget, { recursive: true });
  await fs.copyFile(
    path.join(traybinSource, "tray_windows_release.exe"),
    path.join(traybinTarget, "tray_windows_release.exe"),
  );
  await fs.copyFile(
    path.join(traybinSource, "tray_windows_release.exe"),
    path.join(traybinTarget, "tray_windows.exe"),
  );

  await esbuild.build({
    entryPoints: [path.join(rootDir, "index.ts")],
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

  await createWindowsSea(packageJson, versionStrings);

  await markAsWindowsGui(appExePath);
  await verifyWindowsSea(appExePath);

  await buildGoExecutable({
    source: updaterSource,
    output: updaterExePath,
    buildName: "updater",
    version: packageJson.version,
    productName: packageJson.productName,
    author: packageJson.author,
    description: `${packageJson.productName} Updater`,
    internalName: "foxpile-companion-updater",
    originalFilename: "Foxpile Companion Updater.exe",
  });

  await fs.rm(path.join(distDir, ".build-updater"), {
    recursive: true,
    force: true,
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

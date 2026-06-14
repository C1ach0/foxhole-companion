import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(path.join(process.cwd(), "package.json"));
const fallbackAssetsDir = path.join(process.cwd(), "assets");
let seaModule = undefined;

function getSeaModule() {
  if (seaModule !== undefined) {
    return seaModule;
  }

  try {
    seaModule = require("node:sea");
  } catch {
    seaModule = null;
  }

  return seaModule;
}

function materializeAsset(assetName, data) {
  const assetDir = path.join(os.tmpdir(), "Foxpile Companion", "assets");
  const assetPath = path.join(assetDir, assetName);

  fs.mkdirSync(assetDir, { recursive: true });
  fs.writeFileSync(assetPath, Buffer.from(data));

  return assetPath;
}

export function resolveAssetPath(assetName) {
  const sea = getSeaModule();

  if (!process.versions.sea || !sea?.getAsset) {
    return path.join(fallbackAssetsDir, assetName);
  }

  const data = sea.getAsset(assetName);

  if (!data) {
    throw new Error(`Bundled asset not found: ${assetName}`);
  }

  return materializeAsset(assetName, data);
}

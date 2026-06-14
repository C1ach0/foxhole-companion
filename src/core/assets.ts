import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { getSeaModule, isSeaApplication } from "./runtime.js";

const fallbackAssetsDir = path.join(process.cwd(), "assets");

function materializeAsset(assetName: string, data: ArrayBuffer) {
  const assetDir = path.join(os.tmpdir(), "Foxpile Companion", "assets");
  const assetPath = path.join(assetDir, assetName);

  fs.mkdirSync(assetDir, { recursive: true });
  fs.writeFileSync(assetPath, Buffer.from(data));

  return assetPath;
}

export function resolveAssetPath(assetName: string) {
  const sea = getSeaModule();

  if (!isSeaApplication() || !sea?.getAsset) {
    return path.join(fallbackAssetsDir, assetName);
  }

  const data = sea.getAsset(assetName);

  if (!data) {
    throw new Error(`Bundled asset not found: ${assetName}`);
  }

  return materializeAsset(assetName, data);
}

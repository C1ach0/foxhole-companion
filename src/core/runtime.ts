import { createRequire } from "node:module";
import path from "node:path";
import type * as Sea from "node:sea";

const require = createRequire(path.join(process.cwd(), "package.json"));
let seaModule: typeof Sea | null | undefined;

export function getSeaModule() {
  if (seaModule !== undefined) {
    return seaModule;
  }

  try {
    seaModule = require("node:sea") as typeof Sea;
  } catch {
    seaModule = null;
  }

  return seaModule;
}

export function isSeaApplication() {
  const sea = getSeaModule();
  return typeof sea?.isSea === "function"
    ? sea.isSea()
    : Boolean(process.versions.sea);
}

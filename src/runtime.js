import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(path.join(process.cwd(), "package.json"));
let seaModule;

export function getSeaModule() {
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

export function isSeaApplication() {
  const sea = getSeaModule();
  return typeof sea?.isSea === "function"
    ? sea.isSea()
    : Boolean(process.versions.sea);
}

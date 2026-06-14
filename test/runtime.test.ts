import assert from "node:assert/strict";
import test from "node:test";

import { isSeaApplication } from "../src/core/runtime.js";

test("detects regular Node as a non-SEA runtime", () => {
  assert.equal(isSeaApplication(), false);
});

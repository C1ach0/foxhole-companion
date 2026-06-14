import assert from "node:assert/strict";
import test from "node:test";

import {
  acquireSingleInstance,
  releaseSingleInstance,
} from "../src/app/singleInstance.js";
import type { CompanionActivation } from "../src/core/types.js";

test("allows only one companion instance on Windows", async (context) => {
  if (process.platform !== "win32") {
    context.skip("Windows named pipe test");
    return;
  }

  const pipePath = `\\\\.\\pipe\\foxpile-companion-test-${process.pid}`;
  let resolveActivation!: (activation: CompanionActivation) => void;
  const receivedActivation = new Promise<CompanionActivation>((resolve) => {
    resolveActivation = resolve;
  });
  releaseSingleInstance();
  assert.equal(
    await acquireSingleInstance(pipePath, resolveActivation),
    true,
  );
  assert.equal(await acquireSingleInstance(pipePath), false);
  assert.deepEqual(await receivedActivation, {
    args: process.argv.slice(2),
  });
  releaseSingleInstance();
});

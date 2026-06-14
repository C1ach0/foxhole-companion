import assert from "node:assert/strict";
import test from "node:test";

import { createStartupService } from "../src/ui/windowsStartup.js";

const executablePath = "C:\\Program Files\\Foxpile Companion\\Foxpile Companion.exe";

test("enables startup only when explicitly requested", async () => {
  const calls: string[][] = [];
  const service = createStartupService({
    platform: "win32",
    execPath: executablePath,
    runRegistry: async (args) => {
      calls.push(args);
      return { code: 0, stdout: "", stderr: "" };
    },
  });

  assert.equal(calls.length, 0);
  await service.enableStartup();
  assert.deepEqual(calls, [
    [
      "ADD",
      "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run",
      "/v",
      "Foxpile Companion",
      "/t",
      "REG_SZ",
      "/d",
      `"${executablePath}"`,
      "/f",
    ],
  ]);
});

test("recognizes an existing startup value even when its path is stale", async () => {
  const service = createStartupService({
    platform: "win32",
    execPath: executablePath,
    runRegistry: async () => ({
      code: 0,
      stdout:
        '\n    Foxpile Companion    REG_SZ    "D:\\Old Foxpile\\Foxpile Companion.exe"\n',
      stderr: "",
    }),
  });

  assert.equal(await service.isStartupEnabled(), true);
});

test("does not recreate or delete a startup value removed outside the app", async () => {
  const calls: string[][] = [];
  const service = createStartupService({
    platform: "win32",
    execPath: executablePath,
    runRegistry: async (args) => {
      calls.push(args);
      return { code: 1, stdout: "", stderr: "" };
    },
  });

  assert.equal(await service.isStartupEnabled(), false);
  await service.disableStartup();
  assert.equal(calls.every(([command]) => command === "QUERY"), true);
});

test("explicitly disabling startup removes an existing stale value", async () => {
  const calls: string[][] = [];
  const service = createStartupService({
    platform: "win32",
    execPath: executablePath,
    runRegistry: async (args) => {
      calls.push(args);
      return { code: 0, stdout: "", stderr: "" };
    },
  });

  await service.disableStartup();
  assert.deepEqual(calls.map(([command]) => command), ["QUERY", "DELETE"]);
});

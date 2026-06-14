import assert from "node:assert/strict";
import test from "node:test";
import { isSupportedSaveFileName } from "../src/saves/saveFileNames.js";
import { uploadInitialSaveFiles } from "../src/saves/initialUploads.js";
import {
  assertSaveFileSize,
  MAX_SAVE_FILE_BYTES,
} from "../src/saves/uploadLimits.js";
import {
  compareVersions,
  selectWindowsInstaller,
} from "../src/updates/updateRelease.js";
import { syncSaveFileMetadata } from "../src/saves/sendFiles.js";
import {
  buildUpdaterArguments,
  parseSha256Digest,
} from "../src/updates/updater.js";

test("recognizes only Foxhole save files used by Foxpile", () => {
  assert.equal(isSupportedSaveFileName("UserData.sav"), true);
  assert.equal(isSupportedSaveFileName("7656119.sav"), true);
  assert.equal(isSupportedSaveFileName("7656119_MapData.sav"), true);
  assert.equal(isSupportedSaveFileName("notes.txt"), false);
  assert.equal(isSupportedSaveFileName("backup.sav"), false);
});

test("continues initial uploads when one save file is incompatible", async () => {
  const files = [
    { name: "7656119_MapData.sav", size: 100 },
    { name: "7656119.sav", size: 20 },
    { name: "UserData.sav", size: 10 },
  ];
  const attempts: string[] = [];
  const uploaded = await uploadInitialSaveFiles(files, async (file) => {
    attempts.push(file.name);
    if (file.name === "7656119.sav") {
      throw new Error("unsupported player save");
    }
  });

  assert.deepEqual(attempts, files.map((file) => file.name));
  assert.deepEqual(
    uploaded.map((file) => file.name),
    ["7656119_MapData.sav", "UserData.sav"],
  );
});

test("accepts files up to 2 MiB and rejects larger uploads", () => {
  assert.doesNotThrow(() =>
    assertSaveFileSize({
      name: "7656119_MapData.sav",
      size: MAX_SAVE_FILE_BYTES,
    }),
  );
  assert.throws(
    () =>
      assertSaveFileSize({
        name: "7656119_MapData.sav",
        size: MAX_SAVE_FILE_BYTES + 1,
      }),
    /too large/,
  );
});

test("compares release versions numerically", () => {
  assert.equal(compareVersions("1.0.1", "1.0.0"), 1);
  assert.equal(compareVersions("1.10.0", "1.9.9"), 1);
  assert.equal(compareVersions("v1.0.1", "1.0.1"), 0);
  assert.equal(compareVersions("1.0.0", "1.0.1"), -1);
  assert.equal(compareVersions("1.1.0", "1.0.4"), 1);
});

test("selects GitHub release installers with supported separators", () => {
  const expected = {
    name: "Foxpile.Companion.Setup.exe",
    browser_download_url:
      "https://github.com/C1ach0/foxhole-companion/releases/download/v1.0.1/Foxpile.Companion.Setup.exe",
  };
  assert.equal(
    selectWindowsInstaller(
      {
        assets: [
          {
            name: "other.exe",
            browser_download_url: expected.browser_download_url,
          },
          expected,
        ],
      },
      "C1ach0/foxhole-companion",
    ),
    expected,
  );
  for (const name of [
    "Foxpile Companion Setup.exe",
    "Foxpile-Companion-Setup.exe",
    "foxpile_companion_setup.EXE",
  ]) {
    assert.equal(
      selectWindowsInstaller(
        {
          assets: [{ ...expected, name }],
        },
        "C1ach0/foxhole-companion",
      )?.name,
      name,
    );
  }
  assert.equal(
    selectWindowsInstaller(
      {
        assets: [
          {
            ...expected,
            browser_download_url: "https://example.com/update.exe",
          },
        ],
      },
      "C1ach0/foxhole-companion",
    ),
    undefined,
  );
  assert.equal(
    selectWindowsInstaller(
      {
        assets: [
          {
            ...expected,
            name: "Foxpile.Companion.Portable.exe",
          },
        ],
      },
      "C1ach0/foxhole-companion",
    ),
    undefined,
  );
});

test("never uploads save files when running from npm", async () => {
  const result = await syncSaveFileMetadata(
    {
      name: "7656119_MapData.sav",
      size: 130000,
      modifiedAt: new Date("2026-06-14T12:00:00.000Z"),
      filePath: "unused-in-local-mode",
      hash: "unused-in-local-mode",
    },
    "changed",
  );

  assert.deepEqual(result, {
    skipped: true,
    reason: "local-mode",
  });
});

test("keeps the legacy updater launcher argument for 1.0.4 compatibility", () => {
  const companionPath = "C:\\Program Files\\Foxpile Companion\\Foxpile Companion.exe";
  const args = buildUpdaterArguments({
    parentPid: 1234,
    installerPath: "C:\\Updates\\Foxpile Companion Setup.exe",
    version: "1.1.0",
    markerPath: "C:\\Updates\\installed.json",
    companionPath,
  });

  assert.equal(args[args.indexOf("--launcher") + 1], companionPath);
  assert.equal(args.includes("--companion"), false);
});

test("requires a valid GitHub SHA-256 release asset digest", () => {
  const digest = "a".repeat(64);
  assert.equal(parseSha256Digest(`sha256:${digest}`), digest);
  assert.throws(() => parseSha256Digest(undefined), /SHA-256 digest/);
  assert.throws(() => parseSha256Digest("sha256:not-a-hash"), /SHA-256 digest/);
});

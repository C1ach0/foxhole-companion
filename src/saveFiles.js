import fs from "node:fs/promises";
import { createReadStream } from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { SAVE_DIR } from "./config.js";
import { isSupportedSaveFileName } from "./saveFileNames.js";

export class SaveDirectoryMissingError extends Error {
  constructor() {
    super("Foxhole save directory is not available");
    this.name = "SaveDirectoryMissingError";
    this.code = "FOXPILE_SAVE_DIR_MISSING";
  }
}

export async function calculateFileHash(filePath) {
  return await new Promise((resolve, reject) => {
    const hash = crypto.createHash("sha256");
    const stream = createReadStream(filePath);

    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("error", reject);
    stream.on("end", () => resolve(hash.digest("hex")));
  });
}

export async function getSaveFileInfo(file) {
  const filePath = path.isAbsolute(file) ? file : path.join(SAVE_DIR, file);
  const fileName = path.basename(filePath);
  if (!isSupportedSaveFileName(fileName)) {
    return null;
  }
  const stat = await fs.stat(filePath);

  if (!stat.isFile()) {
    return null;
  }

  return {
    file: fileName,
    filePath,
    name: fileName,
    size: stat.size,
    modifiedAt: stat.mtime,
    hash: await calculateFileHash(filePath),
  };
}

export async function listSaveFiles() {
  try {
    const files = (await fs.readdir(SAVE_DIR))
      .filter(isSupportedSaveFileName)
      .sort((left, right) => {
        const leftMapData = /_MapData\.sav$/i.test(left);
        const rightMapData = /_MapData\.sav$/i.test(right);
        return Number(rightMapData) - Number(leftMapData);
      });

    return await Promise.all(
      files.map(async (file) => {
        return await getSaveFileInfo(file);
      }),
    ).then((files) => files.filter(Boolean));
  } catch (error) {
    if (error?.code === "ENOENT") {
      throw new SaveDirectoryMissingError();
    }

    console.error("Failed to read SaveGames:", error);
    return [];
  }
}

export async function getSteamId() {
  try {
    const files = await fs.readdir(SAVE_DIR);

    const userSave = files.find((file) => /^\d+\.sav$/i.test(file));

    if (!userSave) {
      return null;
    }

    return userSave.replace(/\.sav$/i, "");
  } catch (error) {
    if (error?.code === "ENOENT") {
      throw new SaveDirectoryMissingError();
    }

    throw error;
  }
}

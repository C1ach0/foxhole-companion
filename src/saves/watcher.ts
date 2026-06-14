import chokidar from 'chokidar';
import type { FSWatcher } from "chokidar";
import path from 'node:path';
import { APP_NAME, SAVE_DIR } from "../core/config.js";
import { hasErrorCode } from "../core/errors.js";
import { logError, logInfo } from "../core/logger.js";
import type { SaveEventType, SaveFileInfo } from "../core/types.js";
import { notify } from "../ui/notifier.js";
import { SaveDirectoryMissingError, getSaveFileInfo, listSaveFiles } from './saveFiles.js';
import { syncSaveFileMetadata } from './sendFiles.js';
import { uploadInitialSaveFiles } from './initialUploads.js';

let watcher: FSWatcher | null = null;
const saveFilesByName = new Map<string, SaveFileInfo>();

function rememberSaveFile(fileInfo: SaveFileInfo) {
  saveFilesByName.set(fileInfo.name, fileInfo);
}

function forgetSaveFile(fileName: string) {
  saveFilesByName.delete(fileName);
}

async function initializeSaveFileCache() {
  try {
    const files = await listSaveFiles();

    saveFilesByName.clear();

    const uploadedFiles = await uploadInitialSaveFiles(
      files,
      syncSaveFileMetadata,
      {
        onSuccess(fileInfo) {
          rememberSaveFile(fileInfo);
          console.log(`Initial save file uploaded: ${fileInfo.name}`);
          logInfo("Initial save file uploaded", {
            name: fileInfo.name,
            size: fileInfo.size,
          });
        },
        onError(fileInfo, error) {
          console.error(
            `Initial upload failed for ${fileInfo.name}; watcher will continue:`,
            error,
          );
          logError(
            "Initial save file upload failed; watcher continuing",
            error,
            {
              name: fileInfo.name,
              size: fileInfo.size,
            },
          );
        },
      },
    );

    return uploadedFiles;
  } catch (error) {
    if (
      error instanceof SaveDirectoryMissingError ||
      hasErrorCode(error, "FOXPILE_SAVE_DIR_MISSING")
    ) {
      notify(APP_NAME, "Launch Foxhole before scanning save files.");
      return [];
    }

    throw error;
  }
}

async function handleFileAddedOrChanged(
  filePath: string,
  eventType: Exclude<SaveEventType, "initial">,
) {
  try {
    const fileInfo = await getSaveFileInfo(filePath);

    if (!fileInfo) {
      return;
    }

    const previousFileInfo = saveFilesByName.get(fileInfo.name);

    if (previousFileInfo?.hash === fileInfo.hash) {
      return;
    }

    await syncSaveFileMetadata(fileInfo, eventType);
    rememberSaveFile(fileInfo);
    console.log(`Save file uploaded: ${fileInfo.name} (${eventType})`);
    logInfo("Save file uploaded", {
      name: fileInfo.name,
      size: fileInfo.size,
      eventType,
    });
  } catch (error) {
    console.error(`Failed to process save file ${filePath}:`, error);
    logError("Save file processing failed", error, {
      name: path.basename(filePath),
      eventType,
    });
  }
}

async function handleFileRemoved(filePath: string) {
  try {
    const fileName = path.basename(filePath);
    const previousFileInfo = saveFilesByName.get(fileName);

    if (!previousFileInfo) {
      return;
    }

    forgetSaveFile(fileName);
  } catch (error) {
    console.error(`Failed to process removed save file ${filePath}:`, error);
  }
}

export function getWatchedSaveFiles() {
  return [...saveFilesByName.values()];
}

export async function startWatcher() {
  if (watcher) {
    return getWatchedSaveFiles();
  }

  const files = await initializeSaveFileCache();

  watcher = chokidar.watch(SAVE_DIR, {
    ignoreInitial: true,
    ignored: (filePath, stats) =>
      Boolean(stats?.isFile()) &&
      !/^(UserData|\d+|\d+_MapData)\.sav$/i.test(path.basename(filePath)),
    awaitWriteFinish: {
      stabilityThreshold: 2000,
      pollInterval: 100
    }
  });

  watcher.on('add', file => handleFileAddedOrChanged(file, 'added'));

  watcher.on('change', file => handleFileAddedOrChanged(file, 'changed'));

  watcher.on('unlink', file => handleFileRemoved(file));

  watcher.on('error', error => {
    console.error('Watcher error:', error);
    logError("Watcher error", error);
  });

  console.log('Watcher started');
  logInfo("Watcher started", { saveDirectory: SAVE_DIR });

  return files;
}

export async function stopWatcher() {
  if (!watcher) {
    return;
  }

  await watcher.close();
  watcher = null;
  saveFilesByName.clear();

  console.log('Watcher stopped');
  logInfo("Watcher stopped");
}

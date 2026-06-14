export const MAX_SAVE_FILE_BYTES = 2 * 1024 * 1024;

export function assertSaveFileSize(fileInfo) {
  if (fileInfo.size <= MAX_SAVE_FILE_BYTES) {
    return;
  }

  throw new Error(
    `Save file ${fileInfo.name} is too large: ${fileInfo.size} bytes (maximum ${MAX_SAVE_FILE_BYTES} bytes)`,
  );
}

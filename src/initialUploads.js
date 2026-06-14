export async function uploadInitialSaveFiles(
  files,
  syncFile,
  callbacks = {},
) {
  const uploadedFiles = [];

  for (const fileInfo of files) {
    try {
      await syncFile(fileInfo, "initial");
      uploadedFiles.push(fileInfo);
      callbacks.onSuccess?.(fileInfo);
    } catch (error) {
      callbacks.onError?.(fileInfo, error);
    }
  }

  return uploadedFiles;
}

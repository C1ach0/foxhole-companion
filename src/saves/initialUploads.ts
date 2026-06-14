interface InitialUploadCallbacks<T> {
  onSuccess?: (file: T) => void;
  onError?: (file: T, error: unknown) => void;
}

export async function uploadInitialSaveFiles<T>(
  files: T[],
  syncFile: (file: T, eventType: "initial") => Promise<unknown>,
  callbacks: InitialUploadCallbacks<T> = {},
) {
  const uploadedFiles: T[] = [];

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

export function isSupportedSaveFileName(fileName: string): boolean {
  return (
    /^UserData\.sav$/i.test(fileName) ||
    /^\d+\.sav$/i.test(fileName) ||
    /^\d+_MapData\.sav$/i.test(fileName)
  );
}

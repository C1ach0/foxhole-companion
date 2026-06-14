export function isSupportedSaveFileName(fileName) {
  return (
    /^UserData\.sav$/i.test(fileName) ||
    /^\d+\.sav$/i.test(fileName) ||
    /^\d+_MapData\.sav$/i.test(fileName)
  );
}

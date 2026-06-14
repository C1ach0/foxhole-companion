export function compareVersions(left, right) {
  const parse = (value) =>
    String(value)
      .replace(/^v/i, "")
      .split(".")
      .map((part) => Number.parseInt(part, 10));
  const leftParts = parse(left);
  const rightParts = parse(right);

  for (let index = 0; index < 3; index += 1) {
    const difference = (leftParts[index] || 0) - (rightParts[index] || 0);
    if (difference !== 0) {
      return Math.sign(difference);
    }
  }

  return 0;
}

export function selectWindowsInstaller(release, repository) {
  const installerName = /^foxpile[ ._-]+companion[ ._-]+setup\.exe$/i;

  return release?.assets?.find(
    (asset) =>
      installerName.test(asset.name || "") &&
      asset.browser_download_url?.startsWith(
        `https://github.com/${repository}/releases/download/`,
      ),
  );
}

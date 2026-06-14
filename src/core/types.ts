export type SaveEventType = "added" | "changed" | "initial";

export type SaveFileInfo = {
  file?: string;
  filePath: string;
  name: string;
  size: number;
  modifiedAt: Date;
  hash: string;
};

export type DiscordConnection = {
  discordLinked?: boolean;
  discordUsername?: string;
  linkedAt?: string;
};

export type CompanionActivation = {
  args: string[];
};

export type GitHubReleaseAsset = {
  name?: string;
  browser_download_url?: string;
  digest?: string;
};

export type GitHubRelease = {
  tag_name?: string;
  assets?: GitHubReleaseAsset[];
};

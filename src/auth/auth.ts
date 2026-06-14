import open from "open";
import { API_URL, APP_NAME } from "../core/config.js";
import { hasErrorCode } from "../core/errors.js";
import { SaveDirectoryMissingError, getSteamId } from "../saves/saveFiles.js";
import { notify } from "../ui/notifier.js";
import { setDiscordUser } from "../ui/tray.js";

type DiscordLinkCreated = {
  linkId: string;
  oauthUrl: string;
};

type DiscordLinkStatus = {
  status: "pending" | "completed" | "expired" | "failed";
  discordUsername?: string;
};

const POLLING_INTERVAL = 2000;
const POLLING_TIMEOUT = 10 * 60 * 1000;

export async function connectToDiscord() {
  try {
    const steamId = await getSteamId();

    if (!steamId) {
      notify(APP_NAME, "Unable to detect your Steam account.");
      return;
    }

    notify(APP_NAME, "Preparing Discord account linking...");

    const response = await fetch(`${API_URL}/auth/discord/link`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        steamId,
      }),
    });

    if (!response.ok) {
      console.error("Failed to create Discord link:", await response.text());
      throw new Error(`Failed to create Discord link (${response.status})`);
    }

    const { linkId, oauthUrl } = await response.json() as DiscordLinkCreated;

    notify(APP_NAME, "Opening Discord authorization page...");
    await open(oauthUrl);

    notify(
      APP_NAME,
      "Please complete the authorization in your browser.",
    );

    startDiscordLinkPolling(linkId);
  } catch (error) {
    if (
      error instanceof SaveDirectoryMissingError ||
      hasErrorCode(error, "FOXPILE_SAVE_DIR_MISSING")
    ) {
      notify(APP_NAME, "Launch Foxhole before linking Discord.");
      return;
    }

    console.error(error);
    notify(APP_NAME, "Failed to start Discord linking.");
  }
}

export function startDiscordLinkPolling(linkId: string) {
  const startedAt = Date.now();

  const interval = setInterval(async () => {
    try {
      if (Date.now() - startedAt > POLLING_TIMEOUT) {
        clearInterval(interval);

        notify(APP_NAME, "Discord linking timed out.");

        return;
      }

      const response = await fetch(`${API_URL}/auth/discord/link/${linkId}`);

      if (!response.ok) {
        console.error("Failed to fetch Discord link status:", await response.text());
        return;
      }

      const link = await response.json() as DiscordLinkStatus;

      switch (link.status) {
        case "pending":
          break;

        case "completed":
          clearInterval(interval);
          notify(APP_NAME, "Discord account linked successfully.");
          console.log("Discord linked:", link);
          await setDiscordUser(link.discordUsername ?? "Linked");
          break;

        case "expired":
          clearInterval(interval);
          notify(APP_NAME, "Discord linking request expired.");
          break;

        case "failed":
          clearInterval(interval);
          notify(APP_NAME, "Discord linking failed.");
          break;
      }
    } catch (error) {
      console.error(error);
    }
  }, POLLING_INTERVAL);
}

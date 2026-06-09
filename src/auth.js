import open from "open";
import { API_URL } from "./config.js";
import { notify } from "./notifier.js";
import { getSteamId } from "./saveFiles.js";
import { setDiscordUser } from "./tray.js";

const POLLING_INTERVAL = 2000;
const POLLING_TIMEOUT = 10 * 60 * 1000;

export async function connectToDiscord() {
  try {
    const steamId = await getSteamId();

    if (!steamId) {
      notify("Foxhole Companion", "Unable to detect your Steam account.");
      return;
    }

    notify("Foxhole Companion", "Preparing Discord account linking...");

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

    const { linkId, oauthUrl } = await response.json();

    notify("Foxhole Companion", "Opening Discord authorization page...");
    await open(oauthUrl);

    notify(
      "Foxhole Companion",
      "Please complete the authorization in your browser.",
    );

    startDiscordLinkPolling(linkId);
  } catch (error) {
    console.error(error);
    notify("Foxhole Companion", "Failed to start Discord linking.");
  }
}

export function startDiscordLinkPolling(linkId) {
  const startedAt = Date.now();

  const interval = setInterval(async () => {
    try {
      if (Date.now() - startedAt > POLLING_TIMEOUT) {
        clearInterval(interval);

        notify("Foxhole Companion", "Discord linking timed out.");

        return;
      }

      const response = await fetch(`${API_URL}/auth/discord/link/${linkId}`);

      if (!response.ok) {
        console.error("Failed to fetch Discord link status:", await response.text());
        return;
      }

      const link = await response.json();

      switch (link.status) {
        case "pending":
          break;

        case "completed":
          clearInterval(interval);
          notify("Foxhole Companion", "Discord account linked successfully.");
          console.log("Discord linked:", link);
          await setDiscordUser(link.discordUsername ?? "Linked");
          break;

        case "expired":
          clearInterval(interval);
          notify("Foxhole Companion", "Discord linking request expired.");
          break;

        case "failed":
          clearInterval(interval);
          notify("Foxhole Companion", "Discord linking failed.");
          break;
      }
    } catch (error) {
      console.error(error);
    }
  }, POLLING_INTERVAL);
}

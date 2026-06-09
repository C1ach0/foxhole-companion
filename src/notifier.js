import notifier from "node-notifier";
import { ICON_PATH } from "./config.js";


export function notify(title, message) {
  notifier.notify({
    icon: ICON_PATH,
    title,
    message,
  });
}

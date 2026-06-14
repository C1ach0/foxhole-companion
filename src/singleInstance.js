import net from "node:net";

import { logError, logInfo } from "./logger.js";

const PIPE_PATH = "\\\\.\\pipe\\foxpile-companion-single-instance";

let instanceServer = null;

export async function acquireSingleInstance() {
  if (process.platform !== "win32") {
    return true;
  }

  return new Promise((resolve) => {
    const server = net.createServer();
    let settled = false;

    server.once("error", (error) => {
      if (settled) {
        logError("Single-instance server failed", error);
        return;
      }

      settled = true;
      if (error?.code === "EADDRINUSE") {
        logInfo("Companion startup skipped: another instance is running");
        resolve(false);
        return;
      }

      logError("Single-instance check failed", error);
      resolve(false);
    });

    server.listen(PIPE_PATH, () => {
      settled = true;
      instanceServer = server;
      logInfo("Single-instance lock acquired", {
        pid: process.pid,
      });
      resolve(true);
    });
  });
}

export function releaseSingleInstance() {
  instanceServer?.close();
  instanceServer = null;
}

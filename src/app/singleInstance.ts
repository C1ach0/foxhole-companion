import net from "node:net";

import { hasErrorCode } from "../core/errors.js";
import { logError, logInfo } from "../core/logger.js";
import type { CompanionActivation } from "../core/types.js";

const PIPE_PATH = "\\\\.\\pipe\\foxpile-companion-single-instance";

let instanceServer: net.Server | null = null;

function forwardActivation(
  pipePath: string,
  activation: CompanionActivation,
) {
  return new Promise<void>((resolve) => {
    const socket = net.createConnection(pipePath, () => {
      socket.end(`${JSON.stringify(activation)}\n`);
    });
    socket.once("error", () => resolve());
    socket.once("close", resolve);
  });
}

export async function acquireSingleInstance(
  pipePath = PIPE_PATH,
  onActivation: ((activation: CompanionActivation) => void | Promise<void>) | null = null,
) {
  if (process.platform !== "win32") {
    return true;
  }

  return new Promise<boolean>((resolve) => {
    const server = net.createServer((socket) => {
      let payload = "";
      socket.setEncoding("utf8");
      socket.on("data", (chunk) => {
        payload += chunk;
      });
      socket.on("end", () => {
        try {
          const activation = JSON.parse(payload.trim()) as CompanionActivation;
          void onActivation?.(activation);
        } catch (error) {
          logError("Companion activation payload failed", error);
        }
      });
    });
    let settled = false;

    server.once("error", async (error) => {
      if (settled) {
        logError("Single-instance server failed", error);
        return;
      }

      settled = true;
      if (hasErrorCode(error, "EADDRINUSE")) {
        await forwardActivation(pipePath, {
          args: process.argv.slice(2),
        });
        logInfo("Companion startup skipped: another instance is running");
        resolve(false);
        return;
      }

      logError("Single-instance check failed", error);
      resolve(false);
    });

    server.listen(pipePath, () => {
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

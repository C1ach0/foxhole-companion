import net from "node:net";

import { logError, logInfo } from "./logger.js";

const PIPE_PATH = "\\\\.\\pipe\\foxpile-companion-single-instance";

let instanceServer = null;

function forwardActivation(pipePath, activation) {
  return new Promise((resolve) => {
    const socket = net.createConnection(pipePath, () => {
      socket.end(`${JSON.stringify(activation)}\n`);
    });
    socket.once("error", () => resolve());
    socket.once("close", resolve);
  });
}

export async function acquireSingleInstance(
  pipePath = PIPE_PATH,
  onActivation = null,
) {
  if (process.platform !== "win32") {
    return true;
  }

  return new Promise((resolve) => {
    const server = net.createServer((socket) => {
      let payload = "";
      socket.setEncoding("utf8");
      socket.on("data", (chunk) => {
        payload += chunk;
      });
      socket.on("end", () => {
        try {
          const activation = JSON.parse(payload.trim());
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
      if (error?.code === "EADDRINUSE") {
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

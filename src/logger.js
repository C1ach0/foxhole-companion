import fs from "node:fs/promises";
import path from "node:path";
import { getAppDataDir } from "./config.js";

let writeQueue = Promise.resolve();

function write(level, message, details = undefined) {
  const now = new Date();
  const logsDirectory = path.join(getAppDataDir(), "logs");
  const filePath = path.join(
    logsDirectory,
    `${now.toISOString().slice(0, 10)}.log`,
  );
  const entry = JSON.stringify({
    timestamp: now.toISOString(),
    level,
    message: limit(String(message), 1000),
    ...(details ? { details: sanitize(details) } : {}),
  });

  writeQueue = writeQueue
    .then(async () => {
      await fs.mkdir(logsDirectory, { recursive: true });
      await fs.appendFile(filePath, `${entry}\n`, "utf8");
    })
    .catch((error) => {
      console.error("Unable to write Companion log:", error);
    });
}

export function logInfo(message, details) {
  write("INFO", message, details);
}

export function logError(message, error, details) {
  write("ERROR", message, {
    ...details,
    error: error instanceof Error
      ? {
          name: error.name,
          message: limit(error.message, 1000),
          stack: error.stack ? limit(error.stack, 4000) : undefined,
        }
      : limit(String(error), 1000),
  });
}

function sanitize(value, depth = 0) {
  if (typeof value === "string") {
    return limit(value, 1000);
  }
  if (
    value === null ||
    typeof value === "number" ||
    typeof value === "boolean" ||
    typeof value === "undefined"
  ) {
    return value;
  }
  if (depth >= 3) {
    return "[truncated]";
  }
  if (Array.isArray(value)) {
    return value.slice(0, 25).map((entry) => sanitize(entry, depth + 1));
  }
  if (typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .slice(0, 50)
        .map(([key, entry]) => [key, sanitize(entry, depth + 1)]),
    );
  }
  return limit(String(value), 1000);
}

function limit(value, maxLength) {
  return value.length <= maxLength
    ? value
    : `${value.slice(0, maxLength)}...[truncated]`;
}

import { spawn } from "node:child_process";
import { APP_NAME, APP_USER_MODEL_ID } from "./config.js";

const TOAST_SCRIPT = `
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
try {
  Add-Type -AssemblyName System.Runtime.WindowsRuntime
  Add-Type -TypeDefinition @"
using System.Runtime.InteropServices;
public static class FoxpileAppUserModelIdNative {
  [DllImport("shell32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
  public static extern int SetCurrentProcessExplicitAppUserModelID(string appID);
}
"@ -ErrorAction Stop | Out-Null
  [FoxpileAppUserModelIdNative]::SetCurrentProcessExplicitAppUserModelID($env:FOXPILE_APP_USER_MODEL_ID) | Out-Null
  [Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType = WindowsRuntime] | Out-Null
  [Windows.Data.Xml.Dom.XmlDocument, Windows.Data.Xml.Dom.XmlDocument, ContentType = WindowsRuntime] | Out-Null
  $xml = [Windows.Data.Xml.Dom.XmlDocument]::new()
  $title = [System.Security.SecurityElement]::Escape($env:FOXPILE_TOAST_TITLE)
  $message = [System.Security.SecurityElement]::Escape($env:FOXPILE_TOAST_MESSAGE)
  $xml.LoadXml("<toast><visual><binding template='ToastGeneric'><text>$title</text><text>$message</text></binding></visual></toast>")
  $toast = [Windows.UI.Notifications.ToastNotification]::new($xml)
  $notifier = [Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier($env:FOXPILE_APP_USER_MODEL_ID)
  $notifier.Show($toast)
  exit 0
} catch {
  Write-Error ("Toast notification failed: {0}" -f $_.Exception.Message)
  exit 1
}
`;
const TOAST_COMMAND = Buffer.from(TOAST_SCRIPT, "utf16le").toString("base64");
const ACTION_TOAST_SCRIPT = `
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
try {
  Add-Type -AssemblyName System.Runtime.WindowsRuntime
  Add-Type -TypeDefinition @"
using System.Runtime.InteropServices;
public static class FoxpileActionAppUserModelIdNative {
  [DllImport("shell32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
  public static extern int SetCurrentProcessExplicitAppUserModelID(string appID);
}
"@ -ErrorAction Stop | Out-Null
  [FoxpileActionAppUserModelIdNative]::SetCurrentProcessExplicitAppUserModelID($env:FOXPILE_APP_USER_MODEL_ID) | Out-Null
  [Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType = WindowsRuntime] | Out-Null
  [Windows.Data.Xml.Dom.XmlDocument, Windows.Data.Xml.Dom, ContentType = WindowsRuntime] | Out-Null

  $xml = [Windows.Data.Xml.Dom.XmlDocument]::new()
  $title = [System.Security.SecurityElement]::Escape($env:FOXPILE_TOAST_TITLE)
  $message = [System.Security.SecurityElement]::Escape($env:FOXPILE_TOAST_MESSAGE)
  $action = [System.Security.SecurityElement]::Escape($env:FOXPILE_TOAST_ACTION)
  $uri = [System.Security.SecurityElement]::Escape($env:FOXPILE_TOAST_URI)
  $xml.LoadXml("<toast duration='long'><visual><binding template='ToastGeneric'><text>$title</text><text>$message</text></binding></visual><actions><action content='$action' arguments='$uri' activationType='protocol'/></actions></toast>")

  $toast = [Windows.UI.Notifications.ToastNotification]::new($xml)
  $toast.ExpirationTime = [DateTimeOffset]::Now.AddHours(12)
  $notifier = [Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier($env:FOXPILE_APP_USER_MODEL_ID)
  $notifier.Show($toast)
  exit 0
} catch {
  Write-Error ("Action toast notification failed: {0}" -f $_.Exception.Message)
  exit 1
}
`;
const ACTION_TOAST_COMMAND = Buffer.from(
  ACTION_TOAST_SCRIPT,
  "utf16le",
).toString("base64");

function showConsoleNotification(title, message) {
  console.log(`${APP_NAME}: ${title} - ${message}`);
}

function showWindowsToast(title, message) {
  return new Promise((resolve) => {
    let stderr = "";

    const child = spawn(
      "powershell.exe",
      [
        "-NoLogo",
        "-NoProfile",
        "-NonInteractive",
        "-ExecutionPolicy",
        "Bypass",
        "-WindowStyle",
        "Hidden",
        "-EncodedCommand",
        TOAST_COMMAND,
      ],
      {
        env: {
          ...process.env,
          FOXPILE_APP_USER_MODEL_ID: APP_USER_MODEL_ID,
          FOXPILE_TOAST_TITLE: title,
          FOXPILE_TOAST_MESSAGE: message,
        },
        stdio: ["ignore", "ignore", "pipe"],
        windowsHide: true,
      },
    );

    child.on("error", (error) => {
      console.error("Failed to start Windows toast helper:", error);
      resolve(false);
    });

    child.stderr?.on("data", (chunk) => {
      stderr += chunk.toString("utf8");
    });

    child.on("close", (code) => {
      if (code !== 0) {
        console.error(
          `Windows toast helper exited with code ${code}${stderr ? `: ${stderr.trim()}` : ""}`,
        );
        resolve(false);
        return;
      }

      resolve(true);
    });
  });
}

export function notify(title, message) {
  if (process.platform !== "win32") {
    showConsoleNotification(title, message);
    return false;
  }

  void showWindowsToast(title, message);
  return true;
}

export function notifyAction(title, message, actionLabel, uri) {
  if (process.platform !== "win32") {
    showConsoleNotification(title, message);
    return false;
  }

  void new Promise((resolve) => {
    const child = spawn(
      "powershell.exe",
      [
        "-NoLogo",
        "-NoProfile",
        "-NonInteractive",
        "-ExecutionPolicy",
        "Bypass",
        "-WindowStyle",
        "Hidden",
        "-EncodedCommand",
        ACTION_TOAST_COMMAND,
      ],
      {
        env: {
          ...process.env,
          FOXPILE_APP_USER_MODEL_ID: APP_USER_MODEL_ID,
          FOXPILE_TOAST_TITLE: title,
          FOXPILE_TOAST_MESSAGE: message,
          FOXPILE_TOAST_ACTION: actionLabel,
          FOXPILE_TOAST_URI: uri,
        },
        stdio: ["ignore", "ignore", "pipe"],
        windowsHide: true,
      },
    );

    child.on("error", () => resolve(false));
    child.stderr?.on("data", (chunk) => {
      console.error(`Windows action toast failed: ${chunk.toString().trim()}`);
    });
    child.on("close", (code) => resolve(code === 0));
  });
  return true;
}

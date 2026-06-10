import { spawn } from "node:child_process";
import { APP_NAME, APP_USER_MODEL_ID } from "./config.js";

const TOAST_SCRIPT = `
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Runtime.WindowsRuntime
Add-Type -TypeDefinition @"
using System.Runtime.InteropServices;
public static class AppUserModelIdNative {
  [DllImport("shell32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
  public static extern int SetCurrentProcessExplicitAppUserModelID(string appID);
}
"@ | Out-Null
[AppUserModelIdNative]::SetCurrentProcessExplicitAppUserModelID($env:FOXPILE_APP_USER_MODEL_ID) | Out-Null
[Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType = WindowsRuntime] | Out-Null
$xml = New-Object Windows.Data.Xml.Dom.XmlDocument
$title = [System.Security.SecurityElement]::Escape($env:FOXPILE_TOAST_TITLE)
$message = [System.Security.SecurityElement]::Escape($env:FOXPILE_TOAST_MESSAGE)
$xml.LoadXml("<toast><visual><binding template='ToastGeneric'><text>$title</text><text>$message</text></binding></visual></toast>")
$toast = [Windows.UI.Notifications.ToastNotification]::new($xml)
$notifier = [Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier($env:FOXPILE_APP_USER_MODEL_ID)
$notifier.Show($toast)
`;

function showConsoleNotification(title, message) {
  console.log(`${APP_NAME}: ${title} - ${message}`);
}

function showWindowsToast(title, message) {
  const child = spawn(
    "powershell.exe",
    [
      "-NoLogo",
      "-NoProfile",
      "-ExecutionPolicy",
      "Bypass",
      "-Command",
      TOAST_SCRIPT,
    ],
    {
      env: {
        ...process.env,
        FOXPILE_APP_USER_MODEL_ID: APP_USER_MODEL_ID,
        FOXPILE_TOAST_TITLE: title,
        FOXPILE_TOAST_MESSAGE: message,
      },
      windowsHide: true,
    },
  );

  child.on("error", (error) => {
    console.error("Failed to launch Windows toast helper:", error);
  });

  child.stderr?.on("data", (chunk) => {
    process.stderr.write(chunk);
  });
}

export function notify(title, message) {
  if (process.platform !== "win32") {
    showConsoleNotification(title, message);
    return;
  }

  showWindowsToast(title, message);
}

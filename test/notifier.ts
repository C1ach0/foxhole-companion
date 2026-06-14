import { spawn } from "node:child_process";

const APP_USER_MODEL_ID = "C1ach0.FoxpileCompanion";
const APP_NAME = "Foxpile Companion";
const title = process.argv[2] || APP_NAME;
const message = process.argv[3] || "Test notification";

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

function notify(toastTitle: string, toastMessage: string) {
  return new Promise<boolean>((resolve) => {
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
          FOXPILE_TOAST_TITLE: toastTitle,
          FOXPILE_TOAST_MESSAGE: toastMessage,
        },
        stdio: ["ignore", "ignore", "pipe"],
        windowsHide: true,
      },
    );

    child.on("error", (error) => {
      console.error(error);
      resolve(false);
    });

    child.stderr?.on("data", (chunk) => {
      stderr += chunk.toString("utf8");
    });

    child.on("close", (code) => {
      if (code !== 0) {
        console.error(`Toast helper exited with code ${code}${stderr ? `: ${stderr.trim()}` : ""}`);
        resolve(false);
        return;
      }

      resolve(true);
    });
  });
}

const ok = await notify(title, message);
process.exitCode = ok ? 0 : 1;

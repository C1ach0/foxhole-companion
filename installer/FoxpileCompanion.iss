#define AppName "Foxpile Companion"
#ifndef AppVersion
  #define AppVersion "0.0.0"
#endif
#define AppPublisher "C1ach0"
#define AppExeName "Foxpile Companion.exe"
#define AppPayloadExeName "Foxpile Companion.core.exe"
#define AppUpdaterExeName "Foxpile Companion Updater.exe"
#define AppUserModelID "C1ach0.FoxpileCompanion"

[Setup]
AppId={{B2D3B0C7-9C8A-4E34-98C8-1D1F3F2B55FA}}
AppName={#AppName}
AppVersion={#AppVersion}
AppPublisher={#AppPublisher}
AppPublisherURL=https://github.com/C1ach0/foxhole-companion
AppSupportURL=https://github.com/C1ach0/foxhole-companion/issues
AppUpdatesURL=https://github.com/C1ach0/foxhole-companion/releases
DefaultDirName={autopf}\{#AppName}
DefaultGroupName={#AppName}
DisableProgramGroupPage=yes
OutputDir=..\dist\installer
OutputBaseFilename=Foxpile Companion Setup
SetupIconFile=..\assets\foxpile-icon.ico
UninstallDisplayIcon={app}\{#AppExeName}
Compression=lzma2
SolidCompression=yes
WizardStyle=modern
VersionInfoVersion={#AppVersion}.0
VersionInfoProductVersion={#AppVersion}
VersionInfoCompany={#AppPublisher}
VersionInfoDescription={#AppName} Installer
VersionInfoProductName={#AppName}
VersionInfoCopyright=Copyright (C) 2026 {#AppPublisher}

[Languages]
Name: "french"; MessagesFile: "compiler:Languages\French.isl"
Name: "english"; MessagesFile: "compiler:Default.isl"

[Tasks]
Name: "desktopicon"; Description: "Create a &desktop icon"; Flags: unchecked

[Files]
Source: "..\dist\{#AppExeName}"; DestDir: "{app}"; Flags: ignoreversion
Source: "..\dist\{#AppPayloadExeName}"; DestDir: "{app}"; Flags: ignoreversion
Source: "..\dist\{#AppUpdaterExeName}"; DestDir: "{app}"; Flags: ignoreversion
Source: "..\dist\traybin\*"; DestDir: "{app}\traybin"; Flags: ignoreversion recursesubdirs createallsubdirs

[Icons]
Name: "{group}\{#AppName}"; Filename: "{app}\{#AppExeName}"; WorkingDir: "{app}"; AppUserModelID: "{#AppUserModelID}"
Name: "{autodesktop}\{#AppName}"; Filename: "{app}\{#AppExeName}"; Tasks: desktopicon; WorkingDir: "{app}"; AppUserModelID: "{#AppUserModelID}"

[Registry]
Root: HKCR; Subkey: "foxpile-companion"; ValueType: string; ValueName: ""; ValueData: "URL:Foxpile Companion Protocol"; Flags: uninsdeletekey
Root: HKCR; Subkey: "foxpile-companion"; ValueType: string; ValueName: "URL Protocol"; ValueData: ""
Root: HKCR; Subkey: "foxpile-companion\DefaultIcon"; ValueType: string; ValueName: ""; ValueData: "{app}\{#AppExeName},0"
Root: HKCR; Subkey: "foxpile-companion\shell\open\command"; ValueType: string; ValueName: ""; ValueData: """{app}\{#AppExeName}"" ""%1"""

[Run]
Filename: "{app}\{#AppExeName}"; Description: "Launch {#AppName}"; Flags: nowait postinstall skipifsilent

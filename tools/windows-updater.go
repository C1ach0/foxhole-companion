//go:build windows

package main

import (
	"encoding/json"
	"flag"
	"os"
	"os/exec"
	"path/filepath"
	"syscall"
	"time"
	"unsafe"
)

const (
	infinite              = 0xffffffff
	seeMaskNoCloseProcess = 0x00000040
	showNormal            = 1
	synchronize           = 0x00100000
	updateInstallerParams = "/VERYSILENT /SUPPRESSMSGBOXES /NORESTART /CLOSEAPPLICATIONS /NORESTARTAPPLICATIONS"
)

var (
	kernel32            = syscall.NewLazyDLL("kernel32.dll")
	openProcess         = kernel32.NewProc("OpenProcess")
	waitForSingleObject = kernel32.NewProc("WaitForSingleObject")
	getExitCodeProcess  = kernel32.NewProc("GetExitCodeProcess")
	closeHandle         = kernel32.NewProc("CloseHandle")
	shell32             = syscall.NewLazyDLL("shell32.dll")
	shellExecuteEx      = shell32.NewProc("ShellExecuteExW")
)

type shellExecuteInfo struct {
	size       uint32
	mask       uint32
	window     uintptr
	verb       *uint16
	file       *uint16
	parameters *uint16
	directory  *uint16
	show       int32
	instance   uintptr
	idList     uintptr
	class      *uint16
	classKey   uintptr
	hotKey     uint32
	icon       uintptr
	process    uintptr
}

type updateResult struct {
	Version     string `json:"version"`
	InstalledAt string `json:"installedAt"`
	Success     bool   `json:"success"`
	ExitCode    uint32 `json:"exitCode"`
}

func waitForProcess(processID uint) {
	handle, _, _ := openProcess.Call(synchronize, 0, uintptr(processID))
	if handle == 0 {
		return
	}

	defer closeHandle.Call(handle)
	waitForSingleObject.Call(handle, infinite)
}

func runInstaller(installerPath string) (uint32, bool) {
	verb, _ := syscall.UTF16PtrFromString("runas")
	file, _ := syscall.UTF16PtrFromString(installerPath)
	parameters, _ := syscall.UTF16PtrFromString(updateInstallerParams)
	directory, _ := syscall.UTF16PtrFromString(filepath.Dir(installerPath))
	info := shellExecuteInfo{
		mask:       seeMaskNoCloseProcess,
		verb:       verb,
		file:       file,
		parameters: parameters,
		directory:  directory,
		show:       showNormal,
	}
	info.size = uint32(unsafe.Sizeof(info))

	result, _, _ := shellExecuteEx.Call(uintptr(unsafe.Pointer(&info)))
	if result == 0 || info.process == 0 {
		return 1, false
	}

	defer closeHandle.Call(info.process)
	waitForSingleObject.Call(info.process, infinite)

	var exitCode uint32
	ok, _, _ := getExitCodeProcess.Call(
		info.process,
		uintptr(unsafe.Pointer(&exitCode)),
	)
	return exitCode, ok != 0 && exitCode == 0
}

func writeResult(markerPath, version string, exitCode uint32, success bool) {
	result := updateResult{
		Version:     version,
		InstalledAt: time.Now().UTC().Format(time.RFC3339Nano),
		Success:     success,
		ExitCode:    exitCode,
	}
	content, err := json.Marshal(result)
	if err != nil {
		return
	}

	if err := os.MkdirAll(filepath.Dir(markerPath), 0o755); err != nil {
		return
	}
	_ = os.WriteFile(markerPath, content, 0o600)
}

func restartCompanion(companionPath string) {
	command := exec.Command("explorer.exe", companionPath)
	command.Dir = filepath.Dir(companionPath)
	_ = command.Start()
}

func main() {
	parentID := flag.Uint("parent-pid", 0, "Companion process to wait for")
	installerPath := flag.String("installer", "", "Downloaded installer path")
	version := flag.String("version", "", "Version being installed")
	markerPath := flag.String("marker", "", "Update result marker path")
	launcherPath := flag.String("launcher", "", "Companion executable path")
	companionPath := flag.String("companion", "", "Companion executable path")
	flag.Parse()

	restartPath := *companionPath
	if restartPath == "" {
		restartPath = *launcherPath
	}

	if *installerPath == "" || *markerPath == "" || restartPath == "" {
		os.Exit(2)
	}

	if *parentID != 0 {
		waitForProcess(*parentID)
	}

	exitCode, success := runInstaller(*installerPath)
	writeResult(*markerPath, *version, exitCode, success)
	restartCompanion(restartPath)

	if !success {
		os.Exit(1)
	}
}

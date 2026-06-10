//go:build windows

package main

import (
	"os"
	"os/exec"
	"path/filepath"
	"syscall"
)

const payloadName = "Foxpile Companion.core.exe"
const createNoWindow = 0x08000000

func main() {
	exePath, err := os.Executable()
	if err != nil {
		panic(err)
	}

	appDir := filepath.Dir(exePath)
	payloadPath := filepath.Join(appDir, payloadName)

	cmd := exec.Command(payloadPath, os.Args[1:]...)
	cmd.Dir = appDir
	cmd.SysProcAttr = &syscall.SysProcAttr{
		HideWindow:    true,
		CreationFlags: createNoWindow,
	}

	if err := cmd.Start(); err != nil {
		panic(err)
	}
}

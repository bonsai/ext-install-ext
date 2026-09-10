package main

import (
	"bufio"
	"bytes"
	"encoding/binary"
	"encoding/json"
	"fmt"
	"io"
	"os"
	"os/exec"
	"regexp"
	"strings"
)

type Request struct {
	Action     string `json:"action"`
	Repository string `json:"repository"`
	Browser    string `json:"browser"`
}

var repositoryRE = regexp.MustCompile(`^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$`)

func send(v any) error {
	data, err := json.Marshal(v)
	if err != nil { return err }
	if len(data) > 1024*1024 { return fmt.Errorf("response too large") }
	var header [4]byte
	binary.LittleEndian.PutUint32(header[:], uint32(len(data)))
	if _, err := os.Stdout.Write(header[:]); err != nil { return err }
	_, err = os.Stdout.Write(data)
	return err
}

func receive(r io.Reader) ([]byte, error) {
	var header [4]byte
	if _, err := io.ReadFull(r, header[:]); err != nil { return nil, err }
	length := binary.LittleEndian.Uint32(header[:])
	if length > 64*1024*1024 { return nil, fmt.Errorf("message too large") }
	data := make([]byte, length)
	_, err := io.ReadFull(r, data)
	return data, err
}

func skillScript() (string, error) {
	candidates := []string{}
	if configured := os.Getenv("EXT_INSTALL_SKILL"); configured != "" {
		candidates = append(candidates, configured)
	}
	home, _ := os.UserHomeDir()
	candidates = append(candidates,
		home+`\\ext-install-skill\\ext-install.ps1`,
		home+`\\.local\\share\\ext-install-skill\\ext-install.ps1`,
	)
	for _, p := range candidates {
		if _, err := os.Stat(p); err == nil { return p, nil }
	}
	return "", fmt.Errorf("ext-install.ps1 not found")
}

func install(req Request) map[string]any {
	if req.Action != "install" { return map[string]any{"ok": false, "error": "unsupported_action"} }
	if !repositoryRE.MatchString(req.Repository) { return map[string]any{"ok": false, "error": "invalid_repository"} }
	if req.Browser != "edge" && req.Browser != "chrome" && req.Browser != "auto" { return map[string]any{"ok": false, "error": "invalid_browser"} }
	script, err := skillScript()
	if err != nil { return map[string]any{"ok": false, "error": err.Error()} }

	cmd := exec.Command("powershell.exe", "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", script, "-Repository", req.Repository, "-Browser", req.Browser)
	var output bytes.Buffer
	cmd.Stdout = &output
	cmd.Stderr = &output
	err = cmd.Run()
	text := output.String()
	if len(text) > 12000 { text = text[len(text)-12000:] }
	if err != nil {
		return map[string]any{"ok": false, "error": "install_failed", "message": err.Error(), "output": text}
	}
	return map[string]any{"ok": true, "message": "Installed / updated " + req.Repository + ".", "repository": req.Repository, "browser": req.Browser, "output": text}
}

func main() {
	_ = os.Setenv("PYTHONIOENCODING", "utf-8")
	reader := bufio.NewReader(os.Stdin)
	data, err := receive(reader)
	if err != nil { _ = send(map[string]any{"ok": false, "error": err.Error()}); return }
	var req Request
	if err := json.Unmarshal(data, &req); err != nil { _ = send(map[string]any{"ok": false, "error": "invalid_json"}); return }
	_ = send(install(req))
	_ = strings.Builder{}
}

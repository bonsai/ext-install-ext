#!/usr/bin/env python3
"""Native Messaging bridge for bonsai/ext-install-ext."""
import json
import os
import struct
import subprocess
import sys
from pathlib import Path

HOST_NAME = "com.bonsai.ext_install"
REPOSITORY_RE = __import__("re").compile(r"^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$")
BROWSERS = {"edge", "chrome", "auto"}


def send(message):
    raw = json.dumps(message, separators=(",", ":")).encode("utf-8")
    sys.stdout.buffer.write(struct.pack("<I", len(raw)))
    sys.stdout.buffer.write(raw)
    sys.stdout.buffer.flush()


def receive():
    header = sys.stdin.buffer.read(4)
    if len(header) != 4:
        return None
    length = struct.unpack("<I", header)[0]
    if length > 1024 * 1024:
        raise ValueError("message_too_large")
    raw = sys.stdin.buffer.read(length)
    if len(raw) != length:
        raise ValueError("incomplete_message")
    return json.loads(raw.decode("utf-8"))


def skill_root():
    candidates = []
    configured = os.environ.get("EXT_INSTALL_SKILL")
    if configured:
        candidates.append(Path(configured).expanduser())
    home = Path.home()
    candidates.extend([
        home / "ext-install-skill",
        home / ".local" / "share" / "ext-install-skill",
    ])
    for candidate in candidates:
        if (candidate / "ext-install.sh").exists() or (candidate / "ext-install.ps1").exists():
            return candidate
    return None


def install(repository, browser):
    root = skill_root()
    if root is None:
        return {"ok": False, "error": "ext-install-skill_not_found"}

    if os.name == "nt":
        script = root / "ext-install.ps1"
        if not script.exists():
            return {"ok": False, "error": "ext-install.ps1_not_found"}
        command = [
            "powershell.exe", "-NoProfile", "-ExecutionPolicy", "Bypass",
            "-File", str(script), "-Repository", repository, "-Browser", browser,
        ]
    else:
        script = root / "ext-install.sh"
        if not script.exists():
            return {"ok": False, "error": "ext-install.sh_not_found"}
        command = ["bash", str(script), repository, browser]

    completed = subprocess.run(
        command,
        cwd=str(root),
        stdin=subprocess.DEVNULL,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        timeout=300,
        check=False,
    )
    output = completed.stdout[-12000:]
    if completed.returncode != 0:
        return {"ok": False, "error": "install_failed", "exit_code": completed.returncode, "output": output}
    return {
        "ok": True,
        "message": f"Installed / updated {repository}.",
        "repository": repository,
        "browser": browser,
        "output": output,
    }


def main():
    try:
        request = receive()
        if request is None:
            return
        if request.get("action") != "install":
            send({"ok": False, "error": "unsupported_action"})
            return
        repository = request.get("repository", "")
        browser = request.get("browser", "auto")
        if not isinstance(repository, str) or not REPOSITORY_RE.fullmatch(repository):
            send({"ok": False, "error": "invalid_repository"})
            return
        if browser not in BROWSERS:
            send({"ok": False, "error": "invalid_browser"})
            return
        send(install(repository, browser))
    except Exception as exc:
        send({"ok": False, "error": type(exc).__name__, "message": str(exc)})


if __name__ == "__main__":
    main()

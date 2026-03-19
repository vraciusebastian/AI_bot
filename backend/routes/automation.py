"""
Terminal automation and tar creation routes.
Uses xdotool on Ubuntu to type text into the active terminal window.
"""
from fastapi import APIRouter, HTTPException
import subprocess
import shutil
import os
import time

router = APIRouter(prefix="/api/automation", tags=["automation"])


def _xdotool_available() -> bool:
    return shutil.which("xdotool") is not None


def _run(cmd: list[str], timeout: int = 10) -> dict:
    try:
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=timeout,
        )
        return {
            "ok": result.returncode == 0,
            "stdout": result.stdout.strip(),
            "stderr": result.stderr.strip(),
            "returncode": result.returncode,
        }
    except subprocess.TimeoutExpired:
        return {"ok": False, "stdout": "", "stderr": "Command timed out", "returncode": -1}
    except Exception as e:
        return {"ok": False, "stdout": "", "stderr": str(e), "returncode": -1}


@router.get("/status")
async def automation_status():
    """Check whether xdotool is available on this system."""
    available = _xdotool_available()
    return {
        "xdotool_available": available,
        "platform": os.name,
        "note": "xdotool only works on Linux/Ubuntu with X11. Install with: sudo apt install xdotool",
    }


@router.post("/type")
async def type_text(data: dict):
    """
    Type text into the currently focused window using xdotool.
    Optionally append a newline (press_enter=true).
    """
    text = data.get("text", "")
    press_enter = data.get("press_enter", False)
    delay_ms = int(data.get("delay_ms", 0))

    if not text and not press_enter:
        raise HTTPException(400, "text or press_enter required")

    if not _xdotool_available():
        raise HTTPException(503, "xdotool not installed. Run: sudo apt install xdotool")

    if delay_ms > 0:
        time.sleep(delay_ms / 1000)

    results = []

    if text:
        r = _run(["xdotool", "type", "--clearmodifiers", "--delay", "20", "--", text])
        results.append(r)
        if not r["ok"]:
            raise HTTPException(500, f"xdotool type failed: {r['stderr']}")

    if press_enter:
        time.sleep(0.05)
        r = _run(["xdotool", "key", "Return"])
        results.append(r)
        if not r["ok"]:
            raise HTTPException(500, f"xdotool key Return failed: {r['stderr']}")

    return {"ok": True, "steps": results}


@router.post("/key")
async def press_key(data: dict):
    """Press a key combination using xdotool (e.g., Return, ctrl+c)."""
    key = data.get("key", "")
    if not key:
        raise HTTPException(400, "key required")

    if not _xdotool_available():
        raise HTTPException(503, "xdotool not installed. Run: sudo apt install xdotool")

    r = _run(["xdotool", "key", key])
    if not r["ok"]:
        raise HTTPException(500, f"xdotool key failed: {r['stderr']}")

    return {"ok": True}


@router.post("/tar")
async def create_tar(data: dict):
    """
    Create a tar archive of a directory.
    body: { "source_path": "/path/to/repo", "output_path": "/path/to/output.tar" }
    """
    source = data.get("source_path", "").strip()
    output = data.get("output_path", "").strip()

    if not source or not output:
        raise HTTPException(400, "source_path and output_path required")

    if not os.path.exists(source):
        raise HTTPException(404, f"Source path not found: {source}")

    source = os.path.abspath(source)
    output = os.path.abspath(output)

    # Ensure output directory exists
    os.makedirs(os.path.dirname(output) or ".", exist_ok=True)

    r = _run(["tar", "cf", output, "-C", os.path.dirname(source), os.path.basename(source)], timeout=120)

    if not r["ok"]:
        raise HTTPException(500, f"tar failed: {r['stderr']}")

    size = os.path.getsize(output) if os.path.exists(output) else 0
    return {
        "ok": True,
        "output_path": output,
        "size_bytes": size,
        "size_mb": round(size / (1024 * 1024), 2),
    }

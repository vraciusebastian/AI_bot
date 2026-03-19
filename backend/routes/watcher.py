"""
File watcher routes.
Polls the filesystem for 1.txt files written by both VSCode repo instances.
"""
from fastapi import APIRouter, HTTPException
import os
import time

router = APIRouter(prefix="/api/watcher", tags=["watcher"])

# In-memory store for configured paths per session
_session_paths: dict[str, dict] = {}


@router.post("/configure")
async def configure_paths(data: dict):
    """Store the repo paths for a session."""
    session_id = data.get("session_id")
    path_a = data.get("path_a", "").strip()
    path_b = data.get("path_b", "").strip()

    if not session_id:
        raise HTTPException(400, "session_id required")

    _session_paths[session_id] = {
        "path_a": path_a,
        "path_b": path_b,
        "configured_at": time.time(),
    }
    return {"ok": True}


@router.get("/check")
async def check_files(session_id: str, since: float = 0.0):
    """
    Check whether the 1.txt files for both repos exist and have been
    modified after `since` (unix timestamp).  Returns their content when ready.
    """
    paths = _session_paths.get(session_id)
    if not paths:
        raise HTTPException(404, "No paths configured for this session. Call /configure first.")

    def probe(raw_path: str):
        if not raw_path:
            return {"ready": False, "reason": "path not set"}

        # Accept either a folder path (we append /1.txt) or a direct file path
        p = raw_path
        if os.path.isdir(p):
            p = os.path.join(p, "1.txt")

        if not os.path.exists(p):
            return {"ready": False, "reason": "file not found", "path": p}

        mtime = os.path.getmtime(p)
        if since and mtime < since:
            return {"ready": False, "reason": "file not updated yet", "path": p, "mtime": mtime}

        try:
            with open(p, "r", encoding="utf-8", errors="replace") as f:
                content = f.read()
        except Exception as e:
            return {"ready": False, "reason": str(e), "path": p}

        return {"ready": True, "path": p, "mtime": mtime, "content": content}

    result_a = probe(paths["path_a"])
    result_b = probe(paths["path_b"])

    return {
        "both_ready": result_a["ready"] and result_b["ready"],
        "file_a": result_a,
        "file_b": result_b,
    }


@router.post("/read")
async def read_file(data: dict):
    """Read a single file by path and return its content."""
    path = data.get("path", "").strip()
    if not path:
        raise HTTPException(400, "path required")

    if os.path.isdir(path):
        path = os.path.join(path, "1.txt")

    if not os.path.exists(path):
        raise HTTPException(404, f"File not found: {path}")

    try:
        with open(path, "r", encoding="utf-8", errors="replace") as f:
            content = f.read()
        return {"path": path, "content": content, "size": len(content)}
    except Exception as e:
        raise HTTPException(500, str(e))

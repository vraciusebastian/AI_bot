from fastapi import APIRouter, HTTPException
from datetime import datetime, timezone
from bson import ObjectId
import httpx
import re

from database import get_db
from models import GitHubRequest

router = APIRouter(prefix="/api/github", tags=["github"])


def parse_github_url(url: str):
    """Parse any GitHub URL into its components."""
    url = url.strip().rstrip("/")

    # Commit: /owner/repo/commit/sha
    m = re.match(r"https?://github\.com/([^/]+)/([^/]+)/commit/([a-f0-9]+)", url)
    if m:
        return {"owner": m.group(1), "repo": m.group(2), "type": "commit", "ref": m.group(3)}

    # Pull request: /owner/repo/pull/123
    m = re.match(r"https?://github\.com/([^/]+)/([^/]+)/pull/(\d+)", url)
    if m:
        return {"owner": m.group(1), "repo": m.group(2), "type": "pull", "ref": m.group(3)}

    # Issue: /owner/repo/issues/123
    m = re.match(r"https?://github\.com/([^/]+)/([^/]+)/issues/(\d+)", url)
    if m:
        return {"owner": m.group(1), "repo": m.group(2), "type": "issue", "ref": m.group(3)}

    # Plain repo: /owner/repo
    m = re.match(r"https?://github\.com/([^/]+)/([^/]+?)(?:\.git)?$", url)
    if m:
        return {"owner": m.group(1), "repo": m.group(2), "type": "repo", "ref": None}

    raise ValueError(f"Could not parse GitHub URL: {url}")


async def github_api_get(path: str, token: str = None):
    headers = {
        "Accept": "application/vnd.github.v3+json",
        "User-Agent": "BehavioralAIBot",
    }
    if token:
        headers["Authorization"] = f"token {token}"

    async with httpx.AsyncClient() as client:
        resp = await client.get(f"https://api.github.com{path}", headers=headers, timeout=30)
        if resp.status_code != 200:
            raise HTTPException(resp.status_code, f"GitHub API error: {resp.text[:200]}")
        return resp.json()


@router.post("/fetch")
async def fetch_github_data(req: GitHubRequest):
    db = get_db()
    if not db:
        raise HTTPException(500, "Database not connected")

    try:
        parsed = parse_github_url(req.url)
    except ValueError as e:
        raise HTTPException(400, str(e))

    owner = parsed["owner"]
    repo = parsed["repo"]
    url_type = parsed["type"]
    ref = parsed["ref"]
    base_path = f"/repos/{owner}/{repo}"

    title = ""
    body = ""
    sha = None
    number = None
    files = []
    head_branch = None
    base_branch = None

    if url_type == "commit":
        data = await github_api_get(f"{base_path}/commits/{ref}", req.github_token)
        title = data.get("commit", {}).get("message", "").split("\n")[0]
        body = data.get("commit", {}).get("message", "")
        sha = data.get("sha", ref)
        raw_files = data.get("files", [])
        files = [
            {
                "filename": f["filename"],
                "status": f.get("status", "modified"),
                "additions": f.get("additions", 0),
                "deletions": f.get("deletions", 0),
                "patch": (f.get("patch") or "")[:500],
            }
            for f in raw_files
        ]

    elif url_type == "pull":
        pr = await github_api_get(f"{base_path}/pulls/{ref}", req.github_token)
        title = pr.get("title", "")
        body = pr.get("body", "") or ""
        number = pr.get("number")
        head_branch = pr.get("head", {}).get("ref")
        base_branch = pr.get("base", {}).get("ref")

        pr_files = await github_api_get(f"{base_path}/pulls/{ref}/files", req.github_token)
        files = [
            {
                "filename": f["filename"],
                "status": f.get("status", "modified"),
                "additions": f.get("additions", 0),
                "deletions": f.get("deletions", 0),
                "patch": (f.get("patch") or "")[:500],
            }
            for f in pr_files
        ]

    elif url_type == "issue":
        issue = await github_api_get(f"{base_path}/issues/{ref}", req.github_token)
        title = issue.get("title", "")
        body = issue.get("body", "") or ""
        number = issue.get("number")

    elif url_type == "repo":
        repo_data = await github_api_get(base_path, req.github_token)
        title = repo_data.get("full_name", f"{owner}/{repo}")
        body = repo_data.get("description", "") or ""

    doc = {
        "url": req.url,
        "repo": f"{owner}/{repo}",
        "url_type": url_type,
        "title": title,
        "body": body[:2000],
        "sha": sha,
        "number": number,
        "head_branch": head_branch,
        "base_branch": base_branch,
        "files": files,
        "fetched_at": datetime.now(timezone.utc).isoformat(),
    }

    result = await db.github_data.insert_one(doc)

    return {
        "id": str(result.inserted_id),
        **{k: v for k, v in doc.items() if k != "_id"},
    }


@router.get("/{data_id}")
async def get_github_data(data_id: str):
    db = get_db()
    if not db:
        raise HTTPException(500, "Database not connected")

    doc = await db.github_data.find_one({"_id": ObjectId(data_id)})
    if not doc:
        raise HTTPException(404, "GitHub data not found")

    doc["id"] = str(doc.pop("_id"))
    return doc

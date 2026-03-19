from fastapi import APIRouter, HTTPException
from datetime import datetime, timezone
from bson import ObjectId
import json

from database import get_db
from models import GeneratePromptsRequest

router = APIRouter(prefix="/api/prompts", tags=["prompts"])


def build_prompts_prompt(github_data: dict, doc_text: str = None):
    """Build the prompt text to send to Claude for generating 10 interaction prompts."""
    file_list = "\n".join(
        f"  - {f['filename']} ({f['status']}, +{f['additions']}/-{f['deletions']})"
        for f in github_data.get("files", [])
    )

    patch_samples = "\n\n---\n\n".join(
        f"File: {f['filename']}\n{f['patch']}"
        for f in github_data.get("files", [])
        if f.get("patch")
    )[:2000]

    context_line = ""
    if github_data.get("sha"):
        context_line = f"- Commit: {github_data['sha']}"
    elif github_data.get("number"):
        hb = github_data.get("head_branch", "")
        bb = github_data.get("base_branch", "")
        context_line = f"- PR #{github_data['number']}, Branch: {hb} -> {bb}"
    else:
        context_line = f"- Repo: {github_data['repo']}"

    doc_section = ""
    if doc_text:
        doc_section = f"\n\nRequirement documentation (uploaded):\n{doc_text[:3000]}\n"

    return f"""I'm working on a code debugging task where I interact with an AI coding agent to find and fix bugs.

Info:
- Repo: {github_data['repo']}
- Title: "{github_data['title']}"
{context_line}
- Description: {(github_data.get('body') or '')[:400]}{doc_section}

Changed files:
{file_list or '(no files listed)'}

Code patches (sample):
{patch_samples or '(no patches available)'}

Generate 10 prompts I'll use to interact with the AI agent. The conversation should go through these phases:
- Prompts 1-2: Look at the issue, understand what's broken, don't fix yet
- Prompts 3-4: Confirm the root cause with evidence from the code
- Prompts 5-6: Implement the fix + write tests
- Prompts 7-8: Verify and handle edge cases
- Prompts 9-10: Improve error handling or docs, wrap up

Style rules:
- Short sentences, max 3-4 sentences per prompt
- Sound like a real developer, not an AI
- No words like "certainly", "absolutely", "I'd be happy", "let's", "please note", "I'd like"
- Use simple words - say "look at" not "examine", "fix" not "rectify", "check" not "verify"
- Each prompt builds naturally on the previous
- Reference actual files or behaviors from the changes when possible

Return only a JSON array, no extra text:
[{{"number": 1, "prompt": "...", "phase": "investigation"}}, ...]"""


@router.post("/generate")
async def generate_prompts(req: GeneratePromptsRequest):
    """Generate the Claude prompt text and create a session. Returns the prompt
    for the user to copy into claude.ai."""
    db = get_db()
    if not db:
        raise HTTPException(500, "Database not connected")

    # Load github data
    gh = await db.github_data.find_one({"_id": ObjectId(req.github_data_id)})
    if not gh:
        raise HTTPException(404, "GitHub data not found")

    # Load document text if provided
    doc_text = None
    if req.document_id:
        doc = await db.documents.find_one({"_id": ObjectId(req.document_id)})
        if doc:
            doc_text = doc.get("text_content")

    prompt_text = build_prompts_prompt(gh, doc_text)

    # Create a session
    session = {
        "github_data_id": req.github_data_id,
        "document_id": req.document_id,
        "prompts": [],
        "interactions": [],
        "prompt_text": prompt_text,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    result = await db.sessions.insert_one(session)

    return {
        "session_id": str(result.inserted_id),
        "prompt_text": prompt_text,
    }


@router.post("/parse")
async def parse_prompts_response(data: dict):
    """Parse the JSON response from Claude and save prompts to the session."""
    session_id = data.get("session_id")
    response_text = data.get("response_text", "")

    if not session_id or not response_text:
        raise HTTPException(400, "session_id and response_text required")

    db = get_db()
    if not db:
        raise HTTPException(500, "Database not connected")

    # Extract JSON array from response
    import re
    match = re.search(r"\[[\s\S]*\]", response_text)
    if not match:
        raise HTTPException(400, "No JSON array found in response. Make sure Claude returned [...] format.")

    try:
        prompts = json.loads(match.group(0))
    except json.JSONDecodeError as e:
        raise HTTPException(400, f"Invalid JSON: {str(e)}")

    if not isinstance(prompts, list) or len(prompts) == 0:
        raise HTTPException(400, "Expected a non-empty JSON array of prompts.")

    # Save to session
    await db.sessions.update_one(
        {"_id": ObjectId(session_id)},
        {"$set": {"prompts": prompts}},
    )

    return {"prompts": prompts}


@router.get("/session/{session_id}")
async def get_session(session_id: str):
    db = get_db()
    if not db:
        raise HTTPException(500, "Database not connected")

    session = await db.sessions.find_one({"_id": ObjectId(session_id)})
    if not session:
        raise HTTPException(404, "Session not found")

    session["id"] = str(session.pop("_id"))
    return session

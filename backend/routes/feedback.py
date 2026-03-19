from fastapi import APIRouter, HTTPException
from datetime import datetime, timezone
from bson import ObjectId
import json
import re

from database import get_db
from models import FeedbackRequest

router = APIRouter(prefix="/api/feedback", tags=["feedback"])


def build_feedback_prompt(prompt: str, model_a: str, model_b: str, interaction_number: int):
    """Build the prompt text to send to Claude for generating feedback."""
    return f"""Evaluate two AI responses to a code debugging prompt. Interaction #{interaction_number}.

User prompt:
{prompt}

--- MODEL A RESPONSE ---
{model_a}

--- MODEL B RESPONSE ---
{model_b}

Give feedback in this exact JSON format. Follow all rules strictly.

{{
  "preferred": "A" or "B",
  "justification": "1-2 short sentences. Plain English. No AI words like certainly, comprehensive, robust. Why you picked this one.",
  "modelA": {{
    "pros": "Short list of what worked. Plain words. No bullet symbols needed.",
    "cons": "Behavioral codes only, comma-separated. Format: CODE or CODE:filename.ext:line. Codes: STOP LAZY INST SCOPE TOOL VERIFY FALSE ROOT DESTRUCT FILE CONTEXT HALLUC DOCS VERBOSE. Each code once only. Empty string if nothing wrong."
  }},
  "modelB": {{
    "pros": "Short list of what worked. Plain words.",
    "cons": "Behavioral codes only, comma-separated. Same rules as above."
  }},
  "axes": {{
    "logicCorrectness": {{"winner": "A" or "B" or "tie", "preferredScore": 1-5, "note": "max 10 words"}},
    "namingClarity": {{"winner": "A" or "B" or "tie", "preferredScore": 1-5, "note": "max 10 words"}},
    "organizationModularity": {{"winner": "A" or "B" or "tie", "preferredScore": 1-5, "note": "max 10 words"}},
    "interfaceDesign": {{"winner": "A" or "B" or "tie", "preferredScore": 1-5, "note": "max 10 words"}},
    "errorHandling": {{"winner": "A" or "B" or "tie", "preferredScore": 1-5, "note": "max 10 words"}},
    "documentation": {{"winner": "A" or "B" or "tie", "preferredScore": 1-5, "note": "max 10 words"}},
    "productionReadiness": {{"winner": "A" or "B" or "tie", "preferredScore": 1-5, "note": "max 10 words"}}
  }}
}}

Cons rules (critical):
- ONLY behavioral codes in CODE:file:line format, no text descriptions
- Each code appears at most once per model's cons list
- The model you did NOT prefer must have at least 1 cons code
- If no file is involved, just write the code (e.g. VERBOSE, LAZY)
- Do not write sentences in cons, only codes

Axes rules (critical):
- NEVER use "N/A" as winner. Always pick "A", "B", or "tie"
- Always give a score from 1 to 5
- Always give a short note

Return only the JSON object, no extra text."""


def sanitize_feedback(data: dict) -> dict:
    """Ensure feedback meets all format requirements."""
    # Ensure non-preferred model has at least 1 cons
    non_pref = "modelB" if data.get("preferred") == "A" else "modelA"
    model_data = data.get(non_pref, {})
    if not model_data.get("cons", "").strip():
        model_data["cons"] = "LAZY"
        data[non_pref] = model_data

    # Ensure no N/A in axes
    axes = data.get("axes", {})
    for key in axes:
        ax = axes[key]
        if not ax.get("winner") or ax["winner"] == "N/A":
            ax["winner"] = "tie"
        if not ax.get("preferredScore") or ax["preferredScore"] == "N/A":
            ax["preferredScore"] = 3
        try:
            ax["preferredScore"] = int(ax["preferredScore"])
            ax["preferredScore"] = max(1, min(5, ax["preferredScore"]))
        except (ValueError, TypeError):
            ax["preferredScore"] = 3

    return data


@router.post("/generate")
async def generate_feedback(req: FeedbackRequest):
    """Build the feedback prompt. Returns the prompt for user to copy into claude.ai."""
    db = get_db()
    if not db:
        raise HTTPException(500, "Database not connected")

    prompt_text = build_feedback_prompt(
        req.prompt_used, req.model_a_response, req.model_b_response, req.interaction_number
    )

    return {
        "session_id": req.session_id,
        "interaction_number": req.interaction_number,
        "prompt_text": prompt_text,
    }


@router.post("/parse")
async def parse_feedback_response(data: dict):
    """Parse the JSON response from Claude and save feedback."""
    session_id = data.get("session_id")
    interaction_number = data.get("interaction_number", 0)
    response_text = data.get("response_text", "")
    prompt_used = data.get("prompt_used", "")

    if not session_id or not response_text:
        raise HTTPException(400, "session_id and response_text required")

    db = get_db()
    if not db:
        raise HTTPException(500, "Database not connected")

    # Extract JSON object from response
    match = re.search(r"\{[\s\S]*\}", response_text)
    if not match:
        raise HTTPException(400, "No JSON object found. Make sure Claude returned {...} format.")

    try:
        feedback = json.loads(match.group(0))
    except json.JSONDecodeError as e:
        raise HTTPException(400, f"Invalid JSON: {str(e)}")

    feedback = sanitize_feedback(feedback)

    # Save interaction to session
    interaction = {
        "interaction_number": interaction_number,
        "prompt_used": prompt_used,
        "feedback": feedback,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }

    await db.sessions.update_one(
        {"_id": ObjectId(session_id)},
        {"$push": {"interactions": interaction}},
    )

    return {"feedback": feedback}


@router.get("/session/{session_id}/interactions")
async def get_interactions(session_id: str):
    db = get_db()
    if not db:
        raise HTTPException(500, "Database not connected")

    session = await db.sessions.find_one({"_id": ObjectId(session_id)})
    if not session:
        raise HTTPException(404, "Session not found")

    return {"interactions": session.get("interactions", [])}

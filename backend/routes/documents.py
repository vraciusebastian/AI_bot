from fastapi import APIRouter, UploadFile, File, HTTPException
from datetime import datetime, timezone
from bson import ObjectId

from database import get_db

router = APIRouter(prefix="/api/documents", tags=["documents"])


@router.post("/upload")
async def upload_document(file: UploadFile = File(...)):
    db = get_db()
    if not db:
        raise HTTPException(500, "Database not connected")

    content = await file.read()

    # Try to decode as text
    text_content = None
    try:
        text_content = content.decode("utf-8")
    except UnicodeDecodeError:
        try:
            text_content = content.decode("latin-1")
        except Exception:
            text_content = None

    doc = {
        "filename": file.filename,
        "content_type": file.content_type or "application/octet-stream",
        "size": len(content),
        "raw_data": content,
        "text_content": text_content,
        "uploaded_at": datetime.now(timezone.utc).isoformat(),
    }

    result = await db.documents.insert_one(doc)

    return {
        "id": str(result.inserted_id),
        "filename": file.filename,
        "content_type": file.content_type,
        "size": len(content),
        "has_text": text_content is not None,
        "uploaded_at": doc["uploaded_at"],
    }


@router.get("/")
async def list_documents():
    db = get_db()
    if not db:
        raise HTTPException(500, "Database not connected")

    docs = []
    cursor = db.documents.find({}, {"raw_data": 0}).sort("uploaded_at", -1)
    async for doc in cursor:
        docs.append({
            "id": str(doc["_id"]),
            "filename": doc["filename"],
            "content_type": doc["content_type"],
            "size": doc["size"],
            "has_text": doc.get("text_content") is not None,
            "uploaded_at": doc["uploaded_at"],
        })
    return docs


@router.get("/{doc_id}")
async def get_document(doc_id: str):
    db = get_db()
    if not db:
        raise HTTPException(500, "Database not connected")

    doc = await db.documents.find_one(
        {"_id": ObjectId(doc_id)}, {"raw_data": 0}
    )
    if not doc:
        raise HTTPException(404, "Document not found")

    return {
        "id": str(doc["_id"]),
        "filename": doc["filename"],
        "content_type": doc["content_type"],
        "size": doc["size"],
        "text_content": doc.get("text_content"),
        "uploaded_at": doc["uploaded_at"],
    }


@router.delete("/{doc_id}")
async def delete_document(doc_id: str):
    db = get_db()
    if not db:
        raise HTTPException(500, "Database not connected")

    result = await db.documents.delete_one({"_id": ObjectId(doc_id)})
    if result.deleted_count == 0:
        raise HTTPException(404, "Document not found")

    return {"deleted": True}

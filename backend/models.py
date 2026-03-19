from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime


class DocumentUpload(BaseModel):
    filename: str
    content_type: str
    size: int


class DocumentOut(BaseModel):
    id: str
    filename: str
    content_type: str
    size: int
    text_content: Optional[str] = None
    uploaded_at: str


class GitHubRequest(BaseModel):
    url: str
    github_token: Optional[str] = None


class GitHubDataOut(BaseModel):
    id: str
    url: str
    repo: str
    title: str
    body: Optional[str] = None
    sha: Optional[str] = None
    number: Optional[int] = None
    files: list = []
    fetched_at: str


class PromptPlan(BaseModel):
    number: int
    prompt: str
    phase: str


class GeneratePromptsRequest(BaseModel):
    github_data_id: str
    document_id: Optional[str] = None


class FeedbackRequest(BaseModel):
    session_id: str
    interaction_number: int
    prompt_used: str
    model_a_response: str
    model_b_response: str


class ModelFeedback(BaseModel):
    pros: str
    cons: str


class AxisEval(BaseModel):
    winner: str
    preferredScore: int
    note: str


class FeedbackResult(BaseModel):
    preferred: str
    justification: str
    modelA: ModelFeedback
    modelB: ModelFeedback
    axes: dict


class SessionOut(BaseModel):
    id: str
    github_data_id: str
    document_id: Optional[str] = None
    prompts: list
    created_at: str

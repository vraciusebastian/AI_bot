from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from database import connect_db, close_db
from routes import documents, github, prompts, feedback, watcher, automation


@asynccontextmanager
async def lifespan(app: FastAPI):
    await connect_db()
    yield
    await close_db()


app = FastAPI(title="Behavioral AI Bot API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(documents.router)
app.include_router(github.router)
app.include_router(prompts.router)
app.include_router(feedback.router)
app.include_router(watcher.router)
app.include_router(automation.router)


@app.get("/api/health")
async def health():
    return {"status": "ok"}

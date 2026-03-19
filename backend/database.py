from motor.motor_asyncio import AsyncIOMotorClient
import os

MONGO_URL = os.getenv("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.getenv("DB_NAME", "behavioral_bot")

client: AsyncIOMotorClient = None
db = None


async def connect_db():
    global client, db
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]
    # Create indexes
    await db.documents.create_index("filename")
    await db.github_data.create_index("url")
    await db.interactions.create_index("session_id")


async def close_db():
    global client
    if client:
        client.close()


def get_db():
    return db

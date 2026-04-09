import asyncio
from motor.motor_asyncio import AsyncIOMotorClient

async def test():
    client = AsyncIOMotorClient('mongodb+srv://aiadmin:Devam2005@reviewanalyzer.j4zck1h.mongodb.net/?appName=ReviewAnalyzer', serverSelectionTimeoutMS=5000)
    try:
        a = await client.server_info()
        print("SUCCESS")
    except Exception as e:
        print(f"FAILED: {e}")

asyncio.run(test())

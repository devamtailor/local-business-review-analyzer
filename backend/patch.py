import sys

file_path = r"c:\Users\HP\Desktop\ai-localBusinessReviewanalyzer\local-business-review-analyzer\backend\server.py"
with open(file_path, "r", encoding="utf-8") as f:
    code = f.read()

old_str = """    db_client = AsyncIOMotorClient(mongo_url)
    db = db_client[db_name]
    await create_indexes()
    await seed_admin()
    print("Database connected")"""

new_str = """    db_client = AsyncIOMotorClient(mongo_url, serverSelectionTimeoutMS=2000)
    db = db_client[db_name]
    try:
        await create_indexes()
        await seed_admin()
        print("Database connected")
    except Exception as e:
        print(f"Warning: Could not connect to MongoDB or initialize DB: {e}")"""

if old_str in code:
    code = code.replace(old_str, new_str)
    with open(file_path, "w", encoding="utf-8") as f:
        f.write(code)
    print("Replaced successfully!")
else:
    print("Old string not found!")

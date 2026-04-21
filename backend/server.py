import os
import sys
from dotenv import load_dotenv

# ─── Env Loading ─────────────────────────────────────────────────────────────
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
env_path = os.path.join(BASE_DIR, ".env")
load_dotenv(dotenv_path=env_path, override=True)

# Add backend dir to sys.path for router imports
sys.path.insert(0, BASE_DIR)

import secrets
from datetime import datetime, timezone, timedelta
from typing import Optional

import bcrypt
import jwt
from bson import ObjectId
from fastapi import FastAPI, HTTPException, Request, Response, Depends
from fastapi.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, EmailStr, Field

from dependencies import (
    get_current_user,
    create_access_token,
    create_refresh_token,
    JWT_ALGORITHM,
    get_jwt_secret
)


def hash_password(password: str) -> str:
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(password.encode("utf-8"), salt)
    return hashed.decode("utf-8")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return bcrypt.checkpw(plain_password.encode("utf-8"), hashed_password.encode("utf-8"))


# ─── Pydantic Models ─────────────────────────────────────────────────────────
class UserRegister(BaseModel):
    email: EmailStr
    password: str
    name: str


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class ReviewCreate(BaseModel):
    business_id: str
    rating: int = Field(ge=1, le=5)
    text: str
    reviewer_name: Optional[str] = None


class ReviewUpdate(BaseModel):
    rating: Optional[int] = Field(default=None, ge=1, le=5)
    text: Optional[str] = None


class BusinessCreate(BaseModel):
    name: str
    category: str
    address: Optional[str] = None
    is_public: bool = True


class BusinessUpdate(BaseModel):
    name: Optional[str] = None
    category: Optional[str] = None
    address: Optional[str] = None
    is_public: Optional[bool] = None


# ─── Database Globals ────────────────────────────────────────────────────────
db_client: AsyncIOMotorClient = None
db = None


async def seed_admin():
    admin_email = os.environ.get("ADMIN_EMAIL", "admin@example.com")
    admin_password = os.environ.get("ADMIN_PASSWORD", "admin123")
    existing = await db.users.find_one({"email": admin_email})
    if existing is None:
        hashed = hash_password(admin_password)
        await db.users.insert_one({
            "email": admin_email,
            "password_hash": hashed,
            "name": "Admin",
            "role": "admin",
            "created_at": datetime.now(timezone.utc)
        })
        print(f"Admin user created: {admin_email}")
    elif not verify_password(admin_password, existing["password_hash"]):
        await db.users.update_one(
            {"email": admin_email},
            {"$set": {"password_hash": hash_password(admin_password)}}
        )
        print(f"Admin password updated: {admin_email}")

    os.makedirs("memory", exist_ok=True)
    with open("memory/test_credentials.md", "w") as f:
        f.write("# Test Credentials\n\n")
        f.write("## Admin User\n")
        f.write(f"- Email: {admin_email}\n")
        f.write(f"- Password: {admin_password}\n")
        f.write("- Role: admin\n\n")


async def create_indexes():
    await db.users.create_index("email", unique=True)
    await db.login_attempts.create_index("identifier")
    await db.businesses.create_index("user_id")
    await db.businesses.create_index("name")
    await db.businesses.create_index("is_public")
    await db.reviews.create_index([("user_id", 1), ("business_id", 1)])
    await db.reviews.create_index("business_id")
    await db.reviews.create_index("user_id")
    await db.analyses.create_index("business_id")
    await db.analyses.create_index("user_id")
    await db.offers.create_index("business_id")
    await db.coupons.create_index("business_id")
    await db.coupons.create_index("coupon_code", unique=True)
    await db.rate_limits.create_index([("ip_address", 1), ("window_start", 1)])


# ─── FastAPI App ─────────────────────────────────────────────────────────────
app = FastAPI(title="Review Analyzer API", version="2.0.0")

# Set up Allowed Origins for CORS
allowed_origins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://[::1]:3000"
]

frontend_url_env = os.environ.get("FRONTEND_URL", "")
for url in frontend_url_env.split(","):
    url = url.strip()
    if url:
        allowed_origins.append(url)
        if url.endswith("/"):
            allowed_origins.append(url[:-1])
        else:
            allowed_origins.append(url + "/")

# CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_origin_regex=r"https://.*\.vercel\.app",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def startup_db_client():
    global db_client, db
    mongo_url = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
    db_name = os.environ.get("DB_NAME", "review_analyzer")
    db_client = AsyncIOMotorClient(mongo_url, serverSelectionTimeoutMS=5000)
    db = db_client[db_name]
    # Share db via app.state for routers
    app.state.db = db
    try:
        await create_indexes()
        await seed_admin()
        print("[OK] Database connected and initialized")
    except Exception as e:
        print(f"[WARNING] DB init error: {e}")


@app.on_event("shutdown")
async def shutdown_db_client():
    db_client.close()
    print("Database disconnected")


# ─── Mount Routers ───────────────────────────────────────────────────────────
from routers.imports import router as import_router
from routers.analyzer import router as analyzer_router
from routers.public import router as public_router
from routers.offers import router as offers_router

app.include_router(import_router)
app.include_router(analyzer_router)
app.include_router(public_router)
app.include_router(offers_router)


# ─── Core Routes ─────────────────────────────────────────────────────────────
@app.get("/")
def read_root():
    return {"message": "Review Analyzer API v2.0 — running"}


@app.get("/test")
def test():
    return {"message": "THIS IS MY LOCAL SERVER"}


@app.get("/api/health")
async def health_check():
    return {"status": "healthy", "timestamp": datetime.now(timezone.utc).isoformat()}


# ─── Auth Helpers ────────────────────────────────────────────────────────────


# ─── Brute Force Protection ───────────────────────────────────────────────────
async def check_brute_force(identifier: str):
    attempt = await db.login_attempts.find_one({"identifier": identifier})
    if attempt and attempt.get("count", 0) >= 5:
        lockout_until = attempt.get("lockout_until")
        if lockout_until and datetime.now(timezone.utc) < lockout_until:
            raise HTTPException(status_code=429, detail="Account locked. Try again later.")
        else:
            await db.login_attempts.delete_one({"identifier": identifier})


async def record_failed_attempt(identifier: str):
    attempt = await db.login_attempts.find_one({"identifier": identifier})
    if attempt:
        new_count = attempt.get("count", 0) + 1
        update = {"$set": {"count": new_count}}
        if new_count >= 5:
            update["$set"]["lockout_until"] = datetime.now(timezone.utc) + timedelta(minutes=15)
        await db.login_attempts.update_one({"identifier": identifier}, update)
    else:
        await db.login_attempts.insert_one({"identifier": identifier, "count": 1})


async def clear_failed_attempts(identifier: str):
    await db.login_attempts.delete_one({"identifier": identifier})


# ─── Auth Endpoints ───────────────────────────────────────────────────────────
@app.post("/api/auth/register")
async def register(user_data: UserRegister, response: Response):
    email = user_data.email.lower()
    existing = await db.users.find_one({"email": email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")

    hashed = hash_password(user_data.password)
    result = await db.users.insert_one({
        "email": email,
        "password_hash": hashed,
        "name": user_data.name,
        "role": "user",
        "created_at": datetime.now(timezone.utc)
    })

    user_id = str(result.inserted_id)
    access_token = create_access_token(user_id, email)
    refresh_token = create_refresh_token(user_id)

    response.set_cookie(key="access_token", value=access_token, httponly=True, secure=True, samesite="none", max_age=900, path="/")
    response.set_cookie(key="refresh_token", value=refresh_token, httponly=True, secure=True, samesite="none", max_age=604800, path="/")

    return {"id": user_id, "email": email, "name": user_data.name, "role": "user"}


@app.post("/api/auth/login")
async def login(user_data: UserLogin, request: Request, response: Response):
    print("🔥 LOGIN HIT")
    try:
        email = user_data.email.lower()
        client_ip = request.client.host if request.client else "unknown"
        identifier = f"{client_ip}:{email}"

        await check_brute_force(identifier)

        user = await db.users.find_one({"email": email})
        if not user:
            await record_failed_attempt(identifier)
            raise HTTPException(status_code=401, detail="Invalid email or password")

        if not verify_password(user_data.password, user["password_hash"]):
            await record_failed_attempt(identifier)
            raise HTTPException(status_code=401, detail="Invalid email or password")

        await clear_failed_attempts(identifier)

        user_id = str(user["_id"])
        access_token = create_access_token(user_id, email)
        refresh_token = create_refresh_token(user_id)

        response.set_cookie(key="access_token", value=access_token, httponly=True, secure=True, samesite="none", max_age=900, path="/")
        response.set_cookie(key="refresh_token", value=refresh_token, httponly=True, secure=True, samesite="none", max_age=604800, path="/")

        return {"id": user_id, "email": user["email"], "name": user["name"], "role": user.get("role", "user")}
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/auth/logout")
async def logout(response: Response):
    response.delete_cookie("access_token", path="/", secure=True, samesite="none")
    response.delete_cookie("refresh_token", path="/", secure=True, samesite="none")
    return {"message": "Logged out successfully"}


@app.get("/api/auth/me")
async def get_me(request: Request):
    user = await get_current_user(request)
    return user


@app.post("/api/auth/refresh")
async def refresh_token(request: Request, response: Response):
    token = request.cookies.get("refresh_token")
    if not token:
        raise HTTPException(status_code=401, detail="No refresh token")
    try:
        payload = jwt.decode(token, get_jwt_secret(), algorithms=[JWT_ALGORITHM])
        if payload.get("type") != "refresh":
            raise HTTPException(status_code=401, detail="Invalid token type")
        user = await db.users.find_one({"_id": ObjectId(payload["sub"])})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")

        user_id = str(user["_id"])
        access_token = create_access_token(user_id, user["email"])
        response.set_cookie(key="access_token", value=access_token, httponly=True, secure=True, samesite="none", max_age=900, path="/")
        return {"message": "Token refreshed"}
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Refresh token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid refresh token")


# ─── Business Endpoints ───────────────────────────────────────────────────────
@app.get("/api/businesses")
async def get_businesses(user: dict = Depends(get_current_user)):
    businesses = []
    cursor = db.businesses.find({"user_id": user["_id"]}).sort("created_at", -1)
    async for business in cursor:
        business["_id"] = str(business["_id"])
        businesses.append(business)
    return businesses


@app.post("/api/businesses")
async def create_business(business_data: BusinessCreate, user: dict = Depends(get_current_user)):
    result = await db.businesses.insert_one({
        "name": business_data.name,
        "category": business_data.category,
        "address": business_data.address,
        "is_public": business_data.is_public,
        "user_id": user["_id"],
        "created_at": datetime.now(timezone.utc),
        "avg_rating": 0,
        "review_count": 0
    })
    return {"id": str(result.inserted_id), "name": business_data.name, "category": business_data.category}


@app.get("/api/businesses/{business_id}")
async def get_business(business_id: str, user: dict = Depends(get_current_user)):
    try:
        business = await db.businesses.find_one({"_id": ObjectId(business_id), "user_id": user["_id"]})
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid business ID")
    if not business:
        raise HTTPException(status_code=404, detail="Business not found or not owned by user")
    business["_id"] = str(business["_id"])
    return business


@app.put("/api/businesses/{business_id}")
async def update_business(business_id: str, business_data: BusinessUpdate, user: dict = Depends(get_current_user)):
    update_data = {k: v for k, v in business_data.model_dump().items() if v is not None}
    if not update_data:
        raise HTTPException(status_code=400, detail="No data to update")
    try:
        result = await db.businesses.update_one({"_id": ObjectId(business_id), "user_id": user["_id"]}, {"$set": update_data})
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid business ID")
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Business not found or not owned by user")
    return {"message": "Business updated"}


@app.delete("/api/businesses/{business_id}")
async def delete_business(business_id: str, user: dict = Depends(get_current_user)):
    try:
        result = await db.businesses.delete_one({"_id": ObjectId(business_id), "user_id": user["_id"]})
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid business ID")
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Business not found or not owned by user")
    await db.reviews.delete_many({"business_id": business_id, "user_id": user["_id"]})
    await db.analyses.delete_many({"business_id": business_id, "user_id": user["_id"]})
    return {"message": "Business deleted"}


# ─── Review Endpoints ─────────────────────────────────────────────────────────
@app.get("/api/reviews")
async def get_reviews(business_id: Optional[str] = None, user: dict = Depends(get_current_user)):
    query = {"user_id": user["_id"]}
    if business_id:
        query["business_id"] = business_id
    reviews = []
    cursor = db.reviews.find(query).sort("created_at", -1)
    async for review in cursor:
        review["_id"] = str(review["_id"])
        reviews.append(review)
    return reviews


@app.post("/api/reviews")
async def create_review(review_data: ReviewCreate, user: dict = Depends(get_current_user)):
    try:
        business = await db.businesses.find_one({"_id": ObjectId(review_data.business_id), "user_id": user["_id"]})
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid business ID")
    if not business:
        raise HTTPException(status_code=404, detail="Business not found or not owned by user")

    sentiment = "neutral"
    if review_data.rating >= 4:
        sentiment = "positive"
    elif review_data.rating <= 2:
        sentiment = "negative"

    result = await db.reviews.insert_one({
        "business_id": review_data.business_id,
        "user_id": user["_id"],
        "reviewer_name": review_data.reviewer_name or user["name"],
        "rating": review_data.rating,
        "text": review_data.text,
        "sentiment": sentiment,
        "source": "manual",
        "ai_summary": None,
        "created_at": datetime.now(timezone.utc)
    })

    pipeline = [
        {"$match": {"business_id": review_data.business_id}},
        {"$group": {"_id": None, "avg": {"$avg": "$rating"}, "count": {"$sum": 1}}}
    ]
    stats = await db.reviews.aggregate(pipeline).to_list(1)
    if stats:
        await db.businesses.update_one(
            {"_id": ObjectId(review_data.business_id)},
            {"$set": {"avg_rating": round(stats[0]["avg"], 1), "review_count": stats[0]["count"]}}
        )

    return {
        "id": str(result.inserted_id),
        "business_id": review_data.business_id,
        "rating": review_data.rating,
        "text": review_data.text,
        "sentiment": sentiment
    }


@app.get("/api/reviews/{review_id}")
async def get_review(review_id: str, user: dict = Depends(get_current_user)):
    try:
        review = await db.reviews.find_one({"_id": ObjectId(review_id), "user_id": user["_id"]})
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid review ID")
    if not review:
        raise HTTPException(status_code=404, detail="Review not found")
    review["_id"] = str(review["_id"])
    return review


@app.put("/api/reviews/{review_id}")
async def update_review(review_id: str, review_data: ReviewUpdate, user: dict = Depends(get_current_user)):
    update_data = {k: v for k, v in review_data.model_dump().items() if v is not None}
    if not update_data:
        raise HTTPException(status_code=400, detail="No data to update")

    if "rating" in update_data:
        r = update_data["rating"]
        update_data["sentiment"] = "positive" if r >= 4 else ("negative" if r <= 2 else "neutral")

    try:
        review = await db.reviews.find_one({"_id": ObjectId(review_id), "user_id": user["_id"]})
        if not review:
            raise HTTPException(status_code=404, detail="Review not found or not owned by user")

        await db.reviews.update_one({"_id": ObjectId(review_id), "user_id": user["_id"]}, {"$set": update_data})

        pipeline = [
            {"$match": {"business_id": review["business_id"]}},
            {"$group": {"_id": None, "avg": {"$avg": "$rating"}, "count": {"$sum": 1}}}
        ]
        stats = await db.reviews.aggregate(pipeline).to_list(1)
        if stats:
            await db.businesses.update_one(
                {"_id": ObjectId(review["business_id"])},
                {"$set": {"avg_rating": round(stats[0]["avg"], 1), "review_count": stats[0]["count"]}}
            )
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid review ID")

    return {"message": "Review updated"}


@app.delete("/api/reviews/{review_id}")
async def delete_review(review_id: str, user: dict = Depends(get_current_user)):
    try:
        review = await db.reviews.find_one({"_id": ObjectId(review_id), "user_id": user["_id"]})
        if not review:
            raise HTTPException(status_code=404, detail="Review not found or not owned by user")

        business_id = review["business_id"]
        await db.reviews.delete_one({"_id": ObjectId(review_id), "user_id": user["_id"]})

        pipeline = [
            {"$match": {"business_id": business_id}},
            {"$group": {"_id": None, "avg": {"$avg": "$rating"}, "count": {"$sum": 1}}}
        ]
        stats = await db.reviews.aggregate(pipeline).to_list(1)
        if stats:
            await db.businesses.update_one(
                {"_id": ObjectId(business_id)},
                {"$set": {"avg_rating": round(stats[0]["avg"], 1), "review_count": stats[0]["count"]}}
            )
        else:
            await db.businesses.update_one(
                {"_id": ObjectId(business_id)},
                {"$set": {"avg_rating": 0, "review_count": 0}}
            )
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid review ID")

    return {"message": "Review deleted"}


# ─── Dashboard Stats ──────────────────────────────────────────────────────────
@app.get("/api/dashboard/stats")
async def get_dashboard_stats(user: dict = Depends(get_current_user)):
    total_businesses = await db.businesses.count_documents({"user_id": user["_id"]})
    total_reviews = await db.reviews.count_documents({"user_id": user["_id"]})

    sentiment_pipeline = [
        {"$match": {"user_id": user["_id"]}},
        {"$group": {"_id": "$sentiment", "count": {"$sum": 1}}}
    ]
    sentiment_data = await db.reviews.aggregate(sentiment_pipeline).to_list(10)
    sentiment_distribution = {"positive": 0, "neutral": 0, "negative": 0}
    for item in sentiment_data:
        if item["_id"] in sentiment_distribution:
            sentiment_distribution[item["_id"]] = item["count"]

    rating_pipeline = [
        {"$match": {"user_id": user["_id"]}},
        {"$group": {"_id": "$rating", "count": {"$sum": 1}}}
    ]
    rating_data = await db.reviews.aggregate(rating_pipeline).to_list(10)
    rating_distribution = {1: 0, 2: 0, 3: 0, 4: 0, 5: 0}
    for item in rating_data:
        if item["_id"] in rating_distribution:
            rating_distribution[item["_id"]] = item["count"]

    recent_reviews = []
    cursor = db.reviews.find({"user_id": user["_id"]}).sort("created_at", -1).limit(5)
    async for review in cursor:
        review["_id"] = str(review["_id"])
        recent_reviews.append(review)

    top_businesses = []
    cursor = db.businesses.find({"user_id": user["_id"], "review_count": {"$gt": 0}}).sort("avg_rating", -1).limit(5)
    async for business in cursor:
        business["_id"] = str(business["_id"])
        top_businesses.append(business)

    # Latest analysis counts
    total_analyses = await db.analyses.count_documents({"user_id": user["_id"]})

    return {
        "total_businesses": total_businesses,
        "total_reviews": total_reviews,
        "total_analyses": total_analyses,
        "sentiment_distribution": sentiment_distribution,
        "rating_distribution": rating_distribution,
        "recent_reviews": recent_reviews,
        "top_businesses": top_businesses
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)

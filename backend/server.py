from dotenv import load_dotenv
load_dotenv()

import os
import secrets
from datetime import datetime, timezone, timedelta
from typing import Optional, List
from contextlib import asynccontextmanager

import bcrypt
import jwt
from bson import ObjectId
from fastapi import FastAPI, HTTPException, Request, Response, Depends
from fastapi.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, EmailStr, Field

# JWT Configuration
JWT_ALGORITHM = "HS256"

def get_jwt_secret() -> str:
    return os.environ["JWT_SECRET"]

def hash_password(password: str) -> str:
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(password.encode("utf-8"), salt)
    return hashed.decode("utf-8")

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return bcrypt.checkpw(plain_password.encode("utf-8"), hashed_password.encode("utf-8"))

def create_access_token(user_id: str, email: str) -> str:
    payload = {
        "sub": user_id,
        "email": email,
        "exp": datetime.now(timezone.utc) + timedelta(minutes=15),
        "type": "access"
    }
    return jwt.encode(payload, get_jwt_secret(), algorithm=JWT_ALGORITHM)

def create_refresh_token(user_id: str) -> str:
    payload = {
        "sub": user_id,
        "exp": datetime.now(timezone.utc) + timedelta(days=7),
        "type": "refresh"
    }
    return jwt.encode(payload, get_jwt_secret(), algorithm=JWT_ALGORITHM)

# Pydantic Models
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

class BusinessUpdate(BaseModel):
    name: Optional[str] = None
    category: Optional[str] = None
    address: Optional[str] = None

# Database
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
    
    # Write test credentials
    os.makedirs("/app/memory", exist_ok=True)
    with open("/app/memory/test_credentials.md", "w") as f:
        f.write("# Test Credentials\n\n")
        f.write("## Admin User\n")
        f.write(f"- Email: {admin_email}\n")
        f.write(f"- Password: {admin_password}\n")
        f.write("- Role: admin\n\n")
        f.write("## Auth Endpoints\n")
        f.write("- POST /api/auth/register\n")
        f.write("- POST /api/auth/login\n")
        f.write("- POST /api/auth/logout\n")
        f.write("- GET /api/auth/me\n")
        f.write("- POST /api/auth/refresh\n")

async def create_indexes():
    await db.users.create_index("email", unique=True)
    await db.login_attempts.create_index("identifier")
    await db.reviews.create_index("business_id")
    await db.reviews.create_index("user_id")

@asynccontextmanager
async def lifespan(app: FastAPI):
    global db_client, db
    mongo_url = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
    db_name = os.environ.get("DB_NAME", "review_analyzer")
    db_client = AsyncIOMotorClient(mongo_url)
    db = db_client[db_name]
    await create_indexes()
    await seed_admin()
    print("Database connected")
    yield
    db_client.close()
    print("Database disconnected")

app = FastAPI(title="AI Review Analyzer API", lifespan=lifespan)

# CORS - Allow multiple origins for dev/preview/production
cors_origins = [
    os.environ.get("FRONTEND_URL", "http://localhost:3000"),
    "http://localhost:3000",
]
# Add production domain pattern
frontend_url = os.environ.get("FRONTEND_URL", "")
if "preview.emergentagent.com" in frontend_url:
    cors_origins.append(frontend_url)

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Auth Helper
async def get_current_user(request: Request) -> dict:
    token = request.cookies.get("access_token")
    if not token:
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            token = auth_header[7:]
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = jwt.decode(token, get_jwt_secret(), algorithms=[JWT_ALGORITHM])
        if payload.get("type") != "access":
            raise HTTPException(status_code=401, detail="Invalid token type")
        user = await db.users.find_one({"_id": ObjectId(payload["sub"])})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        user["_id"] = str(user["_id"])
        user.pop("password_hash", None)
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

# Brute Force Protection
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

# Health Check
@app.get("/api/health")
async def health_check():
    return {"status": "healthy", "timestamp": datetime.now(timezone.utc).isoformat()}

# Auth Endpoints
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
    
    response.set_cookie(key="access_token", value=access_token, httponly=True, secure=False, samesite="lax", max_age=900, path="/")
    response.set_cookie(key="refresh_token", value=refresh_token, httponly=True, secure=False, samesite="lax", max_age=604800, path="/")
    
    return {"id": user_id, "email": email, "name": user_data.name, "role": "user"}

@app.post("/api/auth/login")
async def login(user_data: UserLogin, request: Request, response: Response):
    email = user_data.email.lower()
    client_ip = request.client.host if request.client else "unknown"
    identifier = f"{client_ip}:{email}"
    
    await check_brute_force(identifier)
    
    user = await db.users.find_one({"email": email})
    if not user or not verify_password(user_data.password, user["password_hash"]):
        await record_failed_attempt(identifier)
        raise HTTPException(status_code=401, detail="Invalid email or password")
    
    await clear_failed_attempts(identifier)
    
    user_id = str(user["_id"])
    access_token = create_access_token(user_id, email)
    refresh_token = create_refresh_token(user_id)
    
    response.set_cookie(key="access_token", value=access_token, httponly=True, secure=False, samesite="lax", max_age=900, path="/")
    response.set_cookie(key="refresh_token", value=refresh_token, httponly=True, secure=False, samesite="lax", max_age=604800, path="/")
    
    return {"id": user_id, "email": user["email"], "name": user["name"], "role": user.get("role", "user")}

@app.post("/api/auth/logout")
async def logout(response: Response):
    response.delete_cookie("access_token", path="/")
    response.delete_cookie("refresh_token", path="/")
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
        response.set_cookie(key="access_token", value=access_token, httponly=True, secure=False, samesite="lax", max_age=900, path="/")
        return {"message": "Token refreshed"}
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Refresh token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid refresh token")

# Business Endpoints
@app.get("/api/businesses")
async def get_businesses():
    businesses = []
    cursor = db.businesses.find({})
    async for business in cursor:
        business["_id"] = str(business["_id"])
        businesses.append(business)
    return businesses

@app.post("/api/businesses")
async def create_business(business_data: BusinessCreate, request: Request):
    user = await get_current_user(request)
    result = await db.businesses.insert_one({
        "name": business_data.name,
        "category": business_data.category,
        "address": business_data.address,
        "created_by": user["_id"],
        "created_at": datetime.now(timezone.utc),
        "avg_rating": 0,
        "review_count": 0
    })
    return {"id": str(result.inserted_id), "name": business_data.name, "category": business_data.category}

@app.get("/api/businesses/{business_id}")
async def get_business(business_id: str):
    try:
        business = await db.businesses.find_one({"_id": ObjectId(business_id)})
    except:
        raise HTTPException(status_code=400, detail="Invalid business ID")
    if not business:
        raise HTTPException(status_code=404, detail="Business not found")
    business["_id"] = str(business["_id"])
    return business

@app.put("/api/businesses/{business_id}")
async def update_business(business_id: str, business_data: BusinessUpdate, request: Request):
    user = await get_current_user(request)
    update_data = {k: v for k, v in business_data.model_dump().items() if v is not None}
    if not update_data:
        raise HTTPException(status_code=400, detail="No data to update")
    try:
        result = await db.businesses.update_one({"_id": ObjectId(business_id)}, {"$set": update_data})
    except:
        raise HTTPException(status_code=400, detail="Invalid business ID")
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Business not found")
    return {"message": "Business updated"}

@app.delete("/api/businesses/{business_id}")
async def delete_business(business_id: str, request: Request):
    user = await get_current_user(request)
    try:
        result = await db.businesses.delete_one({"_id": ObjectId(business_id)})
    except:
        raise HTTPException(status_code=400, detail="Invalid business ID")
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Business not found")
    # Also delete associated reviews
    await db.reviews.delete_many({"business_id": business_id})
    return {"message": "Business deleted"}

# Review Endpoints
@app.get("/api/reviews")
async def get_reviews(business_id: Optional[str] = None):
    query = {}
    if business_id:
        query["business_id"] = business_id
    reviews = []
    cursor = db.reviews.find(query).sort("created_at", -1)
    async for review in cursor:
        review["_id"] = str(review["_id"])
        reviews.append(review)
    return reviews

@app.post("/api/reviews")
async def create_review(review_data: ReviewCreate, request: Request):
    user = await get_current_user(request)
    
    # Verify business exists
    try:
        business = await db.businesses.find_one({"_id": ObjectId(review_data.business_id)})
    except:
        raise HTTPException(status_code=400, detail="Invalid business ID")
    if not business:
        raise HTTPException(status_code=404, detail="Business not found")
    
    # Placeholder sentiment analysis
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
        "ai_summary": None,  # Placeholder for AI summary
        "created_at": datetime.now(timezone.utc)
    })
    
    # Update business stats
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
async def get_review(review_id: str):
    try:
        review = await db.reviews.find_one({"_id": ObjectId(review_id)})
    except:
        raise HTTPException(status_code=400, detail="Invalid review ID")
    if not review:
        raise HTTPException(status_code=404, detail="Review not found")
    review["_id"] = str(review["_id"])
    return review

@app.put("/api/reviews/{review_id}")
async def update_review(review_id: str, review_data: ReviewUpdate, request: Request):
    user = await get_current_user(request)
    update_data = {k: v for k, v in review_data.model_dump().items() if v is not None}
    if not update_data:
        raise HTTPException(status_code=400, detail="No data to update")
    
    # Update sentiment if rating changed
    if "rating" in update_data:
        if update_data["rating"] >= 4:
            update_data["sentiment"] = "positive"
        elif update_data["rating"] <= 2:
            update_data["sentiment"] = "negative"
        else:
            update_data["sentiment"] = "neutral"
    
    try:
        review = await db.reviews.find_one({"_id": ObjectId(review_id)})
        if not review:
            raise HTTPException(status_code=404, detail="Review not found")
        if review["user_id"] != user["_id"] and user.get("role") != "admin":
            raise HTTPException(status_code=403, detail="Not authorized to update this review")
        
        await db.reviews.update_one({"_id": ObjectId(review_id)}, {"$set": update_data})
        
        # Update business stats
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
    except:
        raise HTTPException(status_code=400, detail="Invalid review ID")
    
    return {"message": "Review updated"}

@app.delete("/api/reviews/{review_id}")
async def delete_review(review_id: str, request: Request):
    user = await get_current_user(request)
    try:
        review = await db.reviews.find_one({"_id": ObjectId(review_id)})
        if not review:
            raise HTTPException(status_code=404, detail="Review not found")
        if review["user_id"] != user["_id"] and user.get("role") != "admin":
            raise HTTPException(status_code=403, detail="Not authorized to delete this review")
        
        business_id = review["business_id"]
        await db.reviews.delete_one({"_id": ObjectId(review_id)})
        
        # Update business stats
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
    except:
        raise HTTPException(status_code=400, detail="Invalid review ID")
    
    return {"message": "Review deleted"}

# Dashboard Stats
@app.get("/api/dashboard/stats")
async def get_dashboard_stats(request: Request):
    user = await get_current_user(request)
    
    total_businesses = await db.businesses.count_documents({})
    total_reviews = await db.reviews.count_documents({})
    
    # Sentiment distribution
    sentiment_pipeline = [
        {"$group": {"_id": "$sentiment", "count": {"$sum": 1}}}
    ]
    sentiment_data = await db.reviews.aggregate(sentiment_pipeline).to_list(10)
    sentiment_distribution = {"positive": 0, "neutral": 0, "negative": 0}
    for item in sentiment_data:
        if item["_id"] in sentiment_distribution:
            sentiment_distribution[item["_id"]] = item["count"]
    
    # Rating distribution
    rating_pipeline = [
        {"$group": {"_id": "$rating", "count": {"$sum": 1}}}
    ]
    rating_data = await db.reviews.aggregate(rating_pipeline).to_list(10)
    rating_distribution = {1: 0, 2: 0, 3: 0, 4: 0, 5: 0}
    for item in rating_data:
        if item["_id"] in rating_distribution:
            rating_distribution[item["_id"]] = item["count"]
    
    # Recent reviews
    recent_reviews = []
    cursor = db.reviews.find({}).sort("created_at", -1).limit(5)
    async for review in cursor:
        review["_id"] = str(review["_id"])
        recent_reviews.append(review)
    
    # Top rated businesses
    top_businesses = []
    cursor = db.businesses.find({"review_count": {"$gt": 0}}).sort("avg_rating", -1).limit(5)
    async for business in cursor:
        business["_id"] = str(business["_id"])
        top_businesses.append(business)
    
    return {
        "total_businesses": total_businesses,
        "total_reviews": total_reviews,
        "sentiment_distribution": sentiment_distribution,
        "rating_distribution": rating_distribution,
        "recent_reviews": recent_reviews,
        "top_businesses": top_businesses
    }

# AI Placeholder Endpoints
@app.post("/api/ai/analyze-sentiment")
async def analyze_sentiment(request: Request):
    """Placeholder for AI sentiment analysis"""
    user = await get_current_user(request)
    body = await request.json()
    text = body.get("text", "")
    
    # Placeholder: Return mock sentiment
    return {
        "sentiment": "positive",
        "confidence": 0.85,
        "message": "AI sentiment analysis placeholder - integrate actual AI model here"
    }

@app.post("/api/ai/generate-summary")
async def generate_summary(request: Request):
    """Placeholder for AI review summary generation"""
    user = await get_current_user(request)
    body = await request.json()
    business_id = body.get("business_id", "")
    
    # Placeholder: Return mock summary
    return {
        "summary": "This is a placeholder AI-generated summary. Reviews indicate generally positive sentiment with customers appreciating the quality of service.",
        "message": "AI summary generation placeholder - integrate actual AI model here"
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)

from datetime import datetime, timezone, timedelta
import random
import string
import re
from typing import Optional

from fastapi import APIRouter, HTTPException, Request, Depends
from pydantic import BaseModel, Field
from bson import ObjectId

router = APIRouter(prefix="/api/public", tags=["public"])

# --- Models ---
class PublicReviewCreate(BaseModel):
    business_id: str
    rating: int = Field(ge=1, le=5)
    text: str
    reviewer_name: str

# --- Helpers ---
def strip_sensitive(doc: dict):
    """Strip private/internal fields from a document before sending to a public client."""
    if not doc:
        return doc
    doc.pop("user_id", None)
    doc.pop("password", None)
    doc.pop("email", None)
    return doc

def generate_coupon_code(reward_type: str, reward_value: str) -> str:
    """ Generates coupon code like DISCOUNT10-ABC12 """
    random_str = ''.join(random.choices(string.ascii_uppercase + string.digits, k=5))
    prefix = f"{reward_type.upper()}{reward_value}".replace(" ", "").replace("%", "").replace("$", "")
    return f"{prefix}-{random_str}"

async def check_rate_limit(db, ip_address: str):
    """Simple rate limit: max 3 reviews per IP per hour."""
    target_time = datetime.now(timezone.utc) - timedelta(hours=1)
    
    # Clean up old records occasionally (optional, but good for local)
    await db.rate_limits.delete_many({"window_start": {"$lt": target_time}})
    
    count = await db.rate_limits.count_documents({
        "ip_address": ip_address,
        "window_start": {"$gte": target_time}
    })
    
    if count >= 3:
        raise HTTPException(status_code=429, detail="Too many review submissions. Try again later.")

# --- Endpoints ---

@router.get("/businesses/trending")
async def get_trending_businesses(request: Request):
    db = request.app.state.db
    # Find public businesses with most reviews or highest rating
    cursor = db.businesses.find({"is_public": {"$ne": False}}).sort([("review_count", -1), ("avg_rating", -1)]).limit(10)
    businesses = []
    async for b in cursor:
        b["_id"] = str(b["_id"])
        businesses.append(strip_sensitive(b))
    return businesses

@router.get("/businesses/search")
async def search_businesses(request: Request, q: str = ""):
    db = request.app.state.db
    if not q:
        return []
    
    query = {
        "name": {"$regex": q, "$options": "i"},
        "is_public": {"$ne": False}
    }
    # Return specific fields: _id, name, avg_rating
    projection = {"name": 1, "avg_rating": 1, "category": 1}
    cursor = db.businesses.find(query, projection).limit(10)
    businesses = []
    async for b in cursor:
        businesses.append({
            "_id": str(b["_id"]),
            "name": b.get("name", ""),
            "average_rating": b.get("avg_rating", 0),
            "category": b.get("category", "")
        })
    return businesses

@router.get("/businesses/{business_id}")
async def get_public_business(business_id: str, request: Request):
    db = request.app.state.db
    try:
        b_id = ObjectId(business_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid business ID")
    
    business = await db.businesses.find_one({
        "_id": b_id,
        "is_public": {"$ne": False}
    })
    
    if not business:
        raise HTTPException(status_code=404, detail="Business not found")
        
    business["_id"] = str(business["_id"])
    
    # Fetch AI preview
    analysis = await db.analyses.find_one({"business_id": business_id})
    if analysis:
        analysis["_id"] = str(analysis["_id"])
        business["ai_preview"] = strip_sensitive(analysis)
    else:
        business["ai_preview"] = None
        
    return strip_sensitive(business)

@router.get("/reviews")
async def get_public_reviews(business_id: str, request: Request, limit: int = 50):
    db = request.app.state.db
    
    # We only want to return reviews for public businesses, so ideally we verify...
    # But filtering by business_id handles the coupling. 
    # (If the business is private, the frontend shouldn't even reach here or we can double check)
    cursor = db.reviews.find({"business_id": business_id}).sort("created_at", -1).limit(limit)
    reviews = []
    async for r in cursor:
        r["_id"] = str(r["_id"])
        reviews.append(strip_sensitive(r))
    return reviews


@router.get("/offers/business/{business_id}")
async def get_public_offers(business_id: str, request: Request):
    db = request.app.state.db
    # Get active offers
    now = datetime.now(timezone.utc)
    query = {
        "business_id": business_id,
        "$or": [
            {"expiry_date": {"$exists": False}},
            {"expiry_date": None},
            {"expiry_date": {"$gt": now}}
        ]
    }
    cursor = db.offers.find(query)
    offers = []
    async for o in cursor:
        o["_id"] = str(o["_id"])
        offers.append(strip_sensitive(o))
    return offers


@router.post("/reviews")
async def create_public_review(review_data: PublicReviewCreate, request: Request):
    db = request.app.state.db
    
    client_ip = request.client.host if request.client else "unknown"
    await check_rate_limit(db, client_ip)
    
    try:
        business = await db.businesses.find_one({"_id": ObjectId(review_data.business_id), "is_public": {"$ne": False}})
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid business ID")
        
    if not business:
        raise HTTPException(status_code=404, detail="Business not found or is not public")
    
    # Spam/Duplicate prevention
    dup = await db.reviews.find_one({
        "business_id": review_data.business_id,
        "reviewer_name": review_data.reviewer_name,
        "text": review_data.text
    })
    if dup:
        raise HTTPException(status_code=400, detail="Duplicate review submitted")

    # Record IP usage
    await db.rate_limits.insert_one({
        "ip_address": client_ip,
        "window_start": datetime.now(timezone.utc)
    })
    
    sentiment = "neutral"
    if review_data.rating >= 4:
        sentiment = "positive"
    elif review_data.rating <= 2:
        sentiment = "negative"

    # We need the user_id of the business owner to store the review correctly so it shows in their dashboard
    owner_id = business.get("user_id")

    result = await db.reviews.insert_one({
        "business_id": review_data.business_id,
        "user_id": owner_id,
        "reviewer_name": review_data.reviewer_name,
        "rating": review_data.rating,
        "text": review_data.text,
        "sentiment": sentiment,
        "source": "public",
        "ai_summary": None,
        "created_at": datetime.now(timezone.utc)
    })
    
    # Update aggregate
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

    response_data = {
        "id": str(result.inserted_id),
        "business_id": review_data.business_id,
        "rating": review_data.rating,
        "text": review_data.text,
        "sentiment": sentiment,
        "coupon_code": None,
        "offer_text": None
    }
    
    # Check for active offers to trigger a coupon
    now = datetime.now(timezone.utc)
    offer_query = {
        "business_id": review_data.business_id,
        "$or": [
            {"expiry_date": {"$exists": False}},
            {"expiry_date": None},
            {"expiry_date": {"$gt": now}}
        ]
    }
    active_offer = await db.offers.find_one(offer_query)
    
    if active_offer:
        # Generate coupon
        coupon_code = generate_coupon_code(active_offer["reward_type"], active_offer["reward_value"])
        await db.coupons.insert_one({
            "user_name": review_data.reviewer_name,
            "business_id": review_data.business_id,
            "offer_id": str(active_offer["_id"]),
            "user_id": owner_id, # Owner of the business
            "coupon_code": coupon_code,
            "status": "unused",
            "created_at": datetime.now(timezone.utc)
        })
        response_data["coupon_code"] = coupon_code
        response_data["offer_text"] = f"You received {active_offer['reward_value']} {active_offer['reward_type']}! Coupon: {coupon_code}"
    
    return response_data

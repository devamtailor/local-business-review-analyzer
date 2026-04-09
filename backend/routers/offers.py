from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, HTTPException, Request, Depends
from pydantic import BaseModel
from bson import ObjectId

from dependencies import get_current_user

router = APIRouter(prefix="/api", tags=["offers"])

class OfferCreate(BaseModel):
    business_id: str
    title: str
    description: str
    reward_type: str
    reward_value: str
    conditions: Optional[str] = None
    expiry_date: Optional[datetime] = None

@router.post("/offers")
async def create_offer(offer_data: OfferCreate, request: Request, user: dict = Depends(get_current_user)):
    db = request.app.state.db
    
    try:
        business = await db.businesses.find_one({
            "_id": ObjectId(offer_data.business_id),
            "user_id": user["_id"]
        })
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid business ID")
        
    if not business:
        raise HTTPException(status_code=404, detail="Business not found or access denied")
        
    result = await db.offers.insert_one({
        "business_id": offer_data.business_id,
        "user_id": user["_id"],
        "title": offer_data.title,
        "description": offer_data.description,
        "reward_type": offer_data.reward_type,
        "reward_value": offer_data.reward_value,
        "conditions": offer_data.conditions,
        "expiry_date": offer_data.expiry_date,
        "created_at": datetime.now(timezone.utc)
    })
    
    return {"id": str(result.inserted_id), "message": "Offer created successfully"}

@router.get("/offers")
async def get_offers(request: Request, user: dict = Depends(get_current_user)):
    db = request.app.state.db
    cursor = db.offers.find({"user_id": user["_id"]}).sort("created_at", -1)
    offers = []
    async for o in cursor:
        o["_id"] = str(o["_id"])
        offers.append(o)
    return offers

@router.get("/coupons")
async def get_coupons(request: Request, user: dict = Depends(get_current_user)):
    db = request.app.state.db
    # Get all coupons generated for the user's businesses
    cursor = db.coupons.find({"user_id": user["_id"]}).sort("created_at", -1)
    coupons = []
    async for c in cursor:
        c["_id"] = str(c["_id"])
        coupons.append(c)
    return coupons

@router.put("/coupons/{coupon_id}/redeem")
async def redeem_coupon(coupon_id: str, request: Request, user: dict = Depends(get_current_user)):
    db = request.app.state.db
    try:
        c_id = ObjectId(coupon_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid coupon ID")
        
    result = await db.coupons.update_one(
        {"_id": c_id, "user_id": user["_id"]},
        {"$set": {"status": "redeemed", "redeemed_at": datetime.now(timezone.utc)}}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Coupon not found or access denied")
        
    return {"message": "Coupon marked as redeemed"}

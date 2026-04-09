from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException, Request, Depends
from pydantic import BaseModel
from bson import ObjectId
from dependencies import get_current_user

router = APIRouter(prefix="/api/reviews", tags=["analyzer"])


class AnalyzeRequest(BaseModel):
    business_id: str


@router.post("/analyze")
async def analyze_reviews(body: AnalyzeRequest, request: Request, user: dict = Depends(get_current_user)):
    """
    Run AI analysis on all reviews for a given business.
    Stores results in MongoDB `analyses` collection.
    """
    db = request.app.state.db

    # Validate business exists
    try:
        business = await db.businesses.find_one({"_id": ObjectId(body.business_id), "user_id": user["_id"]})
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid business ID")

    if not business:
        raise HTTPException(status_code=404, detail="Business not found or access denied")

    # Fetch all reviews for this business
    reviews = []
    cursor = db.reviews.find({"business_id": body.business_id, "user_id": user["_id"]}).sort("created_at", -1)
    async for review in cursor:
        review["_id"] = str(review["_id"])
        reviews.append(review)

    if not reviews:
        raise HTTPException(
            status_code=422,
            detail="No reviews found for this business. Import reviews first."
        )

    # Call Gemini service
    from services.gemini_service import analyze_reviews as ai_analyze
    result = await ai_analyze(reviews)

    # Update individual review sentiments from AI (if AI powered)
    review_sentiments = result.get("review_sentiments", [])
    for rs in review_sentiments:
        idx = rs.get("index")
        if idx is not None and idx < len(reviews):
            review_id = reviews[idx]["_id"]
            try:
                await db.reviews.update_one(
                    {"_id": ObjectId(review_id), "user_id": user["_id"]},
                    {"$set": {
                        "sentiment": rs["sentiment"],
                        "sentiment_confidence": rs.get("confidence", 0.5),
                        "ai_analyzed": True
                    }}
                )
            except Exception:
                pass

    # Build analysis document
    analysis_doc = {
        "business_id": body.business_id,
        "user_id": user["_id"],
        "business_name": business.get("name", ""),
        "review_count": len(reviews),
        "overall_sentiment": result.get("overall_sentiment", "neutral"),
        "sentiment_distribution": result.get("sentiment_distribution", {"positive": 0, "neutral": 0, "negative": 0}),
        "summary": result.get("summary", ""),
        "top_complaints": result.get("top_complaints", []),
        "improvement_suggestions": result.get("improvement_suggestions", []),
        "top_strengths": result.get("top_strengths", []),
        "keywords": result.get("keywords", []),
        "urgent_issues": result.get("urgent_issues", []),
        "weekly_action_plan": result.get("weekly_action_plan", []),
        "growth_opportunities": result.get("growth_opportunities", []),
        "ai_powered": result.get("ai_powered", True),
        "analyzed_at": datetime.now(timezone.utc)
    }

    # Upsert: replace previous analysis for this business
    await db.analyses.update_one(
        {"business_id": body.business_id, "user_id": user["_id"]},
        {"$set": analysis_doc},
        upsert=True
    )

    # Return enriched response
    analysis_doc["analyzed_at"] = analysis_doc["analyzed_at"].isoformat()
    return analysis_doc


@router.get("/analyze/{business_id}")
async def get_analysis(business_id: str, request: Request, user: dict = Depends(get_current_user)):
    """Get the latest stored analysis for a business."""
    db = request.app.state.db

    analysis = await db.analyses.find_one({"business_id": business_id, "user_id": user["_id"]})
    if not analysis:
        raise HTTPException(
            status_code=404,
            detail="No analysis found. Run analysis first."
        )

    analysis["_id"] = str(analysis["_id"])
    if isinstance(analysis.get("analyzed_at"), datetime):
        analysis["analyzed_at"] = analysis["analyzed_at"].isoformat()

    return analysis

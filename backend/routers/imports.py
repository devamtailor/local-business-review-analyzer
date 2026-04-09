import os
import io
import csv
import httpx
from datetime import datetime, timezone
from typing import Optional, List
from fastapi import APIRouter, HTTPException, Request, UploadFile, File, Form, Depends
from pydantic import BaseModel
from bs4 import BeautifulSoup
from dependencies import get_current_user
from bson import ObjectId

router = APIRouter(prefix="/api/reviews/import", tags=["imports"])

GOOGLE_PLACES_API_KEY = os.getenv("GOOGLE_PLACES_API_KEY", "")


# ─── Pydantic Models ────────────────────────────────────────────────────────

class GoogleImportRequest(BaseModel):
    business_id: str
    place_id: str


class UrlImportRequest(BaseModel):
    business_id: str
    url: str


class ManualImportRequest(BaseModel):
    business_id: str
    text: str


# ─── Helper: normalize & insert reviews ─────────────────────────────────────

def _sentiment_from_rating(rating: float) -> str:
    if rating >= 4:
        return "positive"
    elif rating <= 2:
        return "negative"
    return "neutral"


async def _insert_reviews(db, reviews: list) -> int:
    """Insert normalized reviews into MongoDB, skip duplicates."""
    inserted = 0
    for review in reviews:
        # Deduplicate by text + business_id
        existing = await db.reviews.find_one({
            "business_id": review["business_id"],
            "text": review["text"]
        })
        if not existing:
            await db.reviews.insert_one(review)
            inserted += 1
    return inserted


async def _update_business_stats(db, business_id: str):
    """Recalculate avg_rating and review_count for a business."""
    from bson import ObjectId
    pipeline = [
        {"$match": {"business_id": business_id}},
        {"$group": {"_id": None, "avg": {"$avg": "$rating"}, "count": {"$sum": 1}}}
    ]
    stats = await db.reviews.aggregate(pipeline).to_list(1)
    if stats:
        try:
            await db.businesses.update_one(
                {"_id": ObjectId(business_id)},
                {"$set": {"avg_rating": round(stats[0]["avg"], 1), "review_count": stats[0]["count"]}}
            )
        except Exception:
            pass


# ─── Google Places Import ────────────────────────────────────────────────────

@router.post("/google")
async def import_from_google(body: GoogleImportRequest, request: Request, user: dict = Depends(get_current_user)):
    """Import reviews from Google Places API."""
    db = request.app.state.db

    business = await db.businesses.find_one({"_id": ObjectId(body.business_id), "user_id": user["_id"]})
    if not business:
        raise HTTPException(status_code=404, detail="Business not found or access denied")

    if not GOOGLE_PLACES_API_KEY:
        raise HTTPException(
            status_code=503,
            detail="Google Places API key not configured. Add GOOGLE_PLACES_API_KEY to .env"
        )

    url = (
        f"https://maps.googleapis.com/maps/api/place/details/json"
        f"?place_id={body.place_id}"
        f"&fields=name,reviews"
        f"&key={GOOGLE_PLACES_API_KEY}"
    )

    async with httpx.AsyncClient(timeout=15.0) as client:
        try:
            resp = await client.get(url)
            data = resp.json()
        except Exception as e:
            raise HTTPException(status_code=502, detail=f"Google API error: {str(e)}")

    if data.get("status") != "OK":
        raise HTTPException(
            status_code=400,
            detail=f"Google Places error: {data.get('status')} — {data.get('error_message', '')}"
        )

    raw_reviews = data.get("result", {}).get("reviews", [])
    if not raw_reviews:
        return {"inserted": 0, "message": "No reviews found for this Place ID"}

    normalized = []
    for r in raw_reviews:
        rating = r.get("rating", 3)
        text = r.get("text", "").strip()
        if not text:
            continue
        normalized.append({
            "business_id": body.business_id,
            "user_id": user["_id"],
            "rating": rating,
            "text": text,
            "reviewer_name": r.get("author_name", "Google Reviewer"),
            "source": "google",
            "sentiment": _sentiment_from_rating(rating),
            "ai_summary": None,
            "created_at": datetime.now(timezone.utc)
        })

    inserted = await _insert_reviews(db, normalized)
    await _update_business_stats(db, body.business_id)

    return {
        "inserted": inserted,
        "total_found": len(raw_reviews),
        "message": f"Successfully imported {inserted} new reviews from Google"
    }


# ─── Manual Import ───────────────────────────────────────────────────────────

@router.post("/manual")
async def import_manual(body: ManualImportRequest, request: Request, user: dict = Depends(get_current_user)):
    """Import reviews from pasted text (line-by-line)."""
    db = request.app.state.db

    business = await db.businesses.find_one({"_id": ObjectId(body.business_id), "user_id": user["_id"]})
    if not business:
        raise HTTPException(status_code=404, detail="Business not found or access denied")

    lines = [line.strip() for line in body.text.split("\n") if line.strip()]
    if not lines:
        raise HTTPException(status_code=422, detail="No review text provided")

    normalized = []
    for line in lines:
        normalized.append({
            "business_id": body.business_id,
            "user_id": user["_id"],
            "rating": 3,
            "text": line[:2000],
            "reviewer_name": "Manual Paste",
            "source": "manual",
            "sentiment": "neutral",
            "ai_summary": None,
            "created_at": datetime.now(timezone.utc)
        })

    inserted = await _insert_reviews(db, normalized)
    await _update_business_stats(db, body.business_id)

    return {
        "inserted": inserted,
        "total_found": len(lines),
        "message": f"Processed {len(lines)} lines, imported {inserted} new reviews"
    }


# ─── URL Scraping Import ─────────────────────────────────────────────────────

@router.post("/url")
async def import_from_url(body: UrlImportRequest, request: Request, user: dict = Depends(get_current_user)):
    """Scrape reviews from a webpage."""
    db = request.app.state.db

    business = await db.businesses.find_one({"_id": ObjectId(body.business_id), "user_id": user["_id"]})
    if not business:
        raise HTTPException(status_code=404, detail="Business not found or access denied")

    headers = {
        "User-Agent": (
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/120.0.0.0 Safari/537.36"
        )
    }

    async with httpx.AsyncClient(timeout=20.0, headers=headers, follow_redirects=True) as client:
        try:
            resp = await client.get(body.url)
            resp.raise_for_status()
            html = resp.text
        except httpx.HTTPStatusError as e:
            raise HTTPException(status_code=400, detail=f"URL returned {e.response.status_code}")
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Could not fetch URL: {str(e)}")

    soup = BeautifulSoup(html, "html.parser")

    # Remove scripts/styles
    for tag in soup(["script", "style", "nav", "footer", "header"]):
        tag.decompose()

    # Try common review selectors
    review_texts = []

    # Common patterns: p tags inside review containers, blockquotes, li items
    selectors = [
        "[class*='review'] p",
        "[class*='comment'] p",
        "[class*='testimonial'] p",
        "blockquote",
        "[itemprop='reviewBody']",
        "[class*='review-text']",
        "[class*='review-content']",
    ]

    for selector in selectors:
        elements = soup.select(selector)
        for el in elements:
            text = el.get_text(separator=" ", strip=True)
            if len(text) > 30:  # filter very short snippets
                review_texts.append(text)

    # Fallback: grab all paragraphs with sufficient content
    if len(review_texts) < 2:
        for p in soup.find_all("p"):
            text = p.get_text(separator=" ", strip=True)
            if 40 < len(text) < 1000:
                review_texts.append(text)

    # Deduplicate
    seen = set()
    unique_texts = []
    for t in review_texts:
        if t not in seen:
            seen.add(t)
            unique_texts.append(t)

    if not unique_texts:
        raise HTTPException(
            status_code=422,
            detail="No review-like content found on the page. Try a different URL."
        )

    # Limit to 20 extracted items
    unique_texts = unique_texts[:20]

    normalized = []
    for text in unique_texts:
        # Assign neutral rating since we can't determine rating from scraped text
        normalized.append({
            "business_id": body.business_id,
            "user_id": user["_id"],
            "rating": 3,
            "text": text[:2000],  # cap length
            "reviewer_name": "Web Scrape",
            "source": "url_scrape",
            "sentiment": "neutral",
            "ai_summary": None,
            "created_at": datetime.now(timezone.utc)
        })

    inserted = await _insert_reviews(db, normalized)
    await _update_business_stats(db, body.business_id)

    return {
        "inserted": inserted,
        "total_found": len(unique_texts),
        "message": f"Scraped {len(unique_texts)} text snippets, imported {inserted} new reviews",
        "preview": [t[:100] + "..." for t in unique_texts[:3]]
    }


# ─── CSV File Import ─────────────────────────────────────────────────────────

@router.post("/csv")
async def import_from_csv(
    request: Request,
    file: UploadFile = File(...),
    business_id: str = Form(...),
    user: dict = Depends(get_current_user)
):
    """Import reviews from a CSV file. Expected columns: rating, text, reviewer_name (optional)."""
    db = request.app.state.db

    business = await db.businesses.find_one({"_id": ObjectId(business_id), "user_id": user["_id"]})
    if not business:
        raise HTTPException(status_code=404, detail="Business not found or access denied")

    if not file.filename.endswith(".csv"):
        raise HTTPException(status_code=400, detail="Only .csv files are accepted")

    content = await file.read()
    try:
        text_content = content.decode("utf-8-sig")  # handle BOM
    except UnicodeDecodeError:
        text_content = content.decode("latin-1")

    reader = csv.DictReader(io.StringIO(text_content))
    
    # Normalize column names (lowercase, strip spaces)
    if not reader.fieldnames:
        raise HTTPException(status_code=400, detail="CSV file is empty or has no headers")
    
    reader.fieldnames = [f.strip().lower() for f in reader.fieldnames]

    # Identify columns flexibly
    text_cols = ["text", "review", "comment", "content", "body", "message", "feedback"]
    rating_cols = ["rating", "score", "stars", "grade"]
    name_cols = ["reviewer_name", "reviewer", "name", "author", "user", "customer"]

    text_col = next((c for c in reader.fieldnames if c in text_cols), None)
    rating_col = next((c for c in reader.fieldnames if c in rating_cols), None)
    name_col = next((c for c in reader.fieldnames if c in name_cols), None)

    if not text_col:
        raise HTTPException(
            status_code=422,
            detail=f"Could not identify a review text column (expected one of: {', '.join(text_cols)}). Found: {reader.fieldnames}"
        )

    normalized = []
    errors = []
    for i, row in enumerate(reader, start=2):
        text = str(row.get(text_col, "")).strip()
        if not text:
            continue

        rating_raw = str(row.get(rating_col, "3")).strip() if rating_col else "3"
        try:
            rating = max(1, min(5, int(float(rating_raw))))
        except (ValueError, TypeError):
            rating = 3
            errors.append(f"Row {i}: invalid rating '{rating_raw}', defaulted to 3")

        reviewer_name = str(row.get(name_col, "CSV Import")).strip() if name_col else "CSV Import"
        source = str(row.get("source", "csv")).strip()

        normalized.append({
            "business_id": business_id,
            "user_id": user["_id"],
            "rating": rating,
            "text": text[:2000],
            "reviewer_name": reviewer_name or "CSV Import",
            "source": source,
            "sentiment": _sentiment_from_rating(rating),
            "ai_summary": None,
            "created_at": datetime.now(timezone.utc)
        })

    if not normalized:
        raise HTTPException(status_code=422, detail="No valid reviews found in CSV")

    inserted = await _insert_reviews(db, normalized)
    await _update_business_stats(db, business_id)

    return {
        "inserted": inserted,
        "total_found": len(normalized),
        "errors": errors[:5],  # return first 5 errors max
        "message": f"Processed {len(normalized)} rows, imported {inserted} new reviews"
    }

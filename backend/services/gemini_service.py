import os
import json
import asyncio
from typing import Optional

def _get_model():
    """Get Gemini model instance."""
    api_key = os.getenv("GEMINI_API_KEY", "")
    if not api_key:
        return None
    try:
        import google.generativeai as genai
        genai.configure(api_key=api_key)
        return genai.GenerativeModel("gemini-2.5-flash")
    except Exception:
        return None


async def analyze_reviews(reviews: list) -> dict:
    """
    Analyze a list of reviews using Gemini AI.
    Returns structured dict with sentiment, summary, complaints, suggestions.
    Falls back to rule-based analysis if no API key.
    """
    model = _get_model()

    api_key = os.getenv("GEMINI_API_KEY", "")
    if not model or not api_key:
        return _rule_based_analysis(reviews, error_msg="No API Key configured.")

    reviews_input = {"reviews": []}
    for r in reviews[:50]:
        reviews_input["reviews"].append({
            "rating": r.get("rating", 3),
            "text": r.get("text", "")
        })

    reviews_json_text = json.dumps(reviews_input, indent=2)

    prompt = f"""Act as an expert business consultant. Analyze the following customer reviews and identify patterns across ALL reviews. Focus heavily on actionable insights and avoid generic statements.

INPUT DATA (STRICT JSON):
{reviews_json_text}

Return STRICTLY a JSON object with this exact structure (no markdown borders or extra text):
{{
  "overall_sentiment": "positive" | "neutral" | "negative",
  "sentiment_distribution": {{
    "positive": <count>,
    "neutral": <count>,
    "negative": <count>
  }},
  "summary": "<specific 2-3 sentence overview isolating the root sentiment drivers>",
  "top_complaints": [
    "<complaint 1>",
    "<complaint 2>"
  ],
  "top_strengths": [
    "<strength 1>",
    "<strength 2>"
  ],
  "improvement_suggestions": [
    "<actionable suggestion 1>",
    "<actionable suggestion 2>"
  ],
  "keywords": [
    "<keyword 1>",
    "<keyword 2>"
  ],
  "urgent_issues": [
    "<what is hurting the business most uniquely>"
  ],
  "weekly_action_plan": [
    "<what should be fixed THIS WEEK>"
  ],
  "growth_opportunities": [
    "<what customers LOVE (double down strategy)>"
  ],
  "review_sentiments": [
    {{"index": 0, "sentiment": "positive" | "neutral" | "negative", "confidence": <float 0.0-1.0>}}
  ]
}}
Ensure exactly one review_sentiments entry per review given in the input (index matches input array).
"""

    try:
        loop = asyncio.get_event_loop()
        response = await loop.run_in_executor(None, lambda: model.generate_content(prompt))
        text = response.text.strip()
        # Strip markdown code blocks if present
        if text.startswith("```"):
            lines = text.split("\n")
            text = "\n".join(lines[1:-1])
        result = json.loads(text)
        return result
    except Exception as e:
        print(f"Gemini API error: {e}")
        return _rule_based_analysis(reviews, error_msg=str(e))

def _rule_based_analysis(reviews: list, error_msg: str = "") -> dict:
    """Fallback rule-based analysis when Gemini is not available."""
    positive = sum(1 for r in reviews if r.get("rating", 3) >= 4)
    negative = sum(1 for r in reviews if r.get("rating", 3) <= 2)
    neutral = len(reviews) - positive - negative

    overall = "positive" if positive > negative else ("negative" if negative > positive else "neutral")

    # Basic keyword analysis for complaints
    complaint_keywords = {
        "slow service": ["slow", "wait", "waited", "long time", "forever"],
        "poor quality": ["bad", "poor", "terrible", "awful", "worst"],
        "unfriendly staff": ["rude", "unfriendly", "unhelpful", "unprofessional"],
        "high prices": ["expensive", "overpriced", "pricey", "costly"],
        "cleanliness issues": ["dirty", "unclean", "messy", "filthy"]
    }

    complaint_counts = {}
    all_text = " ".join(r.get("text", "").lower() for r in reviews if r.get("rating", 3) <= 2)
    for complaint, keywords in complaint_keywords.items():
        if any(k in all_text for k in keywords):
            complaint_counts[complaint] = True

    complaints = list(complaint_counts.keys())[:3] or [
        "Some customers reported service issues",
        "Wait times mentioned in negative reviews",
        "Quality consistency noted as area for improvement"
    ]

    suggestions = [
        "Improve response time to customer feedback",
        "Train staff on customer service excellence",
        "Consider a loyalty program for returning customers"
    ]

    strengths = [
        f"{positive} out of {len(reviews)} reviews were positive",
        "Overall customer engagement indicates active business"
    ]

    review_sentiments = []
    for i, r in enumerate(reviews[:50]):
        rating = r.get("rating", 3)
        if rating >= 4:
            s, c = "positive", 0.8
        elif rating <= 2:
            s, c = "negative", 0.8
        else:
            s, c = "neutral", 0.6
        review_sentiments.append({"index": i, "sentiment": s, "confidence": c})

    return {
        "overall_sentiment": overall,
        "sentiment_distribution": {"positive": positive, "neutral": neutral, "negative": negative},
        "summary": f"Based on {len(reviews)} reviews... The overall sentiment is {overall}. (Gemini Failed: {error_msg})",
        "top_complaints": complaints,
        "improvement_suggestions": suggestions,
        "top_strengths": strengths,
        "keywords": ["service", "wait", "quality", "price"],
        "urgent_issues": ["No AI analysis available. Add API key for urgent issue detection."] if negative > 0 else [],
        "weekly_action_plan": ["Review recent feedback manually and address negative comments."],
        "growth_opportunities": ["Continue providing good service to maintain positive reviews."] if positive > 0 else [],
        "review_sentiments": review_sentiments,
        "ai_powered": False
    }

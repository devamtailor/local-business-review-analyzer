import requests
import sys

URL = "http://127.0.0.1:8001"

try:
    print("Fetching businesses...")
    res = requests.get(f"{URL}/api/businesses")
    businesses = res.json()
    if not businesses:
        print("No businesses found.")
        sys.exit(1)
        
    for idx, b in enumerate(businesses):
        print(f"[{idx}] {b.get('name')} (ID: {b.get('_id')})")
        
    b_id = businesses[0]["_id"]
    print(f"\nAnalyzing business ID: {b_id} ...")
    res2 = requests.post(f"{URL}/api/reviews/analyze", json={"business_id": b_id})
    print(f"Status: {res2.status_code}")
    print("Response payload:")
    print(res2.text[:1000]) # Print first 1000 chars

except Exception as e:
    print(f"Error: {e}")

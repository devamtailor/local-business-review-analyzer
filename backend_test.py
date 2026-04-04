#!/usr/bin/env python3
import requests
import sys
import json
from datetime import datetime

class ReviewAnalyzerAPITester:
    def __init__(self, base_url="http://localhost:8001"):
        self.base_url = base_url
        self.session = requests.Session()
        self.tests_run = 0
        self.tests_passed = 0
        self.failed_tests = []
        self.admin_credentials = {
            "email": "admin@example.com",
            "password": "admin123"
        }
        self.test_business_id = None
        self.test_review_id = None

    def log_test(self, name, success, details=""):
        """Log test results"""
        self.tests_run += 1
        if success:
            self.tests_passed += 1
            print(f"✅ {name}")
        else:
            print(f"❌ {name} - {details}")
            self.failed_tests.append({"test": name, "details": details})

    def test_health_check(self):
        """Test health check endpoint"""
        try:
            response = self.session.get(f"{self.base_url}/api/health", timeout=10)
            success = response.status_code == 200
            details = f"Status: {response.status_code}"
            if success:
                data = response.json()
                details += f", Response: {data}"
            self.log_test("Health Check", success, details)
            return success
        except Exception as e:
            self.log_test("Health Check", False, f"Exception: {str(e)}")
            return False

    def test_user_registration(self):
        """Test user registration"""
        try:
            test_user = {
                "email": f"test_{datetime.now().strftime('%H%M%S')}@example.com",
                "password": "testpass123",
                "name": "Test User"
            }
            response = self.session.post(
                f"{self.base_url}/api/auth/register",
                json=test_user,
                timeout=10
            )
            success = response.status_code == 200
            details = f"Status: {response.status_code}"
            if not success and response.status_code == 400:
                # Check if it's duplicate email error
                try:
                    error_data = response.json()
                    if "already registered" in error_data.get("detail", ""):
                        success = True  # This is expected behavior
                        details = "Registration validation working (duplicate email rejected)"
                except:
                    pass
            self.log_test("User Registration", success, details)
            return success
        except Exception as e:
            self.log_test("User Registration", False, f"Exception: {str(e)}")
            return False

    def test_admin_login(self):
        """Test admin login"""
        try:
            response = self.session.post(
                f"{self.base_url}/api/auth/login",
                json=self.admin_credentials,
                timeout=10
            )
            success = response.status_code == 200
            details = f"Status: {response.status_code}"
            if success:
                data = response.json()
                details += f", User: {data.get('name', 'Unknown')}, Role: {data.get('role', 'Unknown')}"
            self.log_test("Admin Login", success, details)
            return success
        except Exception as e:
            self.log_test("Admin Login", False, f"Exception: {str(e)}")
            return False

    def test_get_current_user(self):
        """Test get current user endpoint"""
        try:
            response = self.session.get(f"{self.base_url}/api/auth/me", timeout=10)
            success = response.status_code == 200
            details = f"Status: {response.status_code}"
            if success:
                data = response.json()
                details += f", User: {data.get('name', 'Unknown')}"
            self.log_test("Get Current User", success, details)
            return success
        except Exception as e:
            self.log_test("Get Current User", False, f"Exception: {str(e)}")
            return False

    def test_create_business(self):
        """Test create business"""
        try:
            test_business = {
                "name": f"Test Restaurant {datetime.now().strftime('%H%M%S')}",
                "category": "Restaurant",
                "address": "123 Test Street"
            }
            response = self.session.post(
                f"{self.base_url}/api/businesses",
                json=test_business,
                timeout=10
            )
            success = response.status_code == 200
            details = f"Status: {response.status_code}"
            if success:
                data = response.json()
                self.test_business_id = data.get("id")
                details += f", Business ID: {self.test_business_id}"
            self.log_test("Create Business", success, details)
            return success
        except Exception as e:
            self.log_test("Create Business", False, f"Exception: {str(e)}")
            return False

    def test_get_businesses(self):
        """Test get all businesses"""
        try:
            response = self.session.get(f"{self.base_url}/api/businesses", timeout=10)
            success = response.status_code == 200
            details = f"Status: {response.status_code}"
            if success:
                data = response.json()
                details += f", Count: {len(data)}"
                # If we don't have a test business ID, try to get one from the list
                if not self.test_business_id and data:
                    self.test_business_id = data[0].get("_id")
            self.log_test("Get Businesses", success, details)
            return success
        except Exception as e:
            self.log_test("Get Businesses", False, f"Exception: {str(e)}")
            return False

    def test_create_review(self):
        """Test create review"""
        if not self.test_business_id:
            self.log_test("Create Review", False, "No business ID available")
            return False
        
        try:
            test_review = {
                "business_id": self.test_business_id,
                "rating": 5,
                "text": "Great service and food! Highly recommended.",
                "reviewer_name": "Test Reviewer"
            }
            response = self.session.post(
                f"{self.base_url}/api/reviews",
                json=test_review,
                timeout=10
            )
            success = response.status_code == 200
            details = f"Status: {response.status_code}"
            if success:
                data = response.json()
                self.test_review_id = data.get("id")
                details += f", Review ID: {self.test_review_id}, Sentiment: {data.get('sentiment')}"
            self.log_test("Create Review", success, details)
            return success
        except Exception as e:
            self.log_test("Create Review", False, f"Exception: {str(e)}")
            return False

    def test_get_reviews(self):
        """Test get all reviews"""
        try:
            response = self.session.get(f"{self.base_url}/api/reviews", timeout=10)
            success = response.status_code == 200
            details = f"Status: {response.status_code}"
            if success:
                data = response.json()
                details += f", Count: {len(data)}"
            self.log_test("Get Reviews", success, details)
            return success
        except Exception as e:
            self.log_test("Get Reviews", False, f"Exception: {str(e)}")
            return False

    def test_dashboard_stats(self):
        """Test dashboard stats endpoint"""
        try:
            response = self.session.get(f"{self.base_url}/api/dashboard/stats", timeout=10)
            success = response.status_code == 200
            details = f"Status: {response.status_code}"
            if success:
                data = response.json()
                details += f", Businesses: {data.get('total_businesses', 0)}, Reviews: {data.get('total_reviews', 0)}"
            self.log_test("Dashboard Stats", success, details)
            return success
        except Exception as e:
            self.log_test("Dashboard Stats", False, f"Exception: {str(e)}")
            return False

    def test_ai_sentiment_analysis(self):
        """Test AI sentiment analysis placeholder"""
        try:
            test_data = {"text": "This is a great restaurant with excellent service!"}
            response = self.session.post(
                f"{self.base_url}/api/ai/analyze-sentiment",
                json=test_data,
                timeout=10
            )
            success = response.status_code == 200
            details = f"Status: {response.status_code}"
            if success:
                data = response.json()
                details += f", Sentiment: {data.get('sentiment')}, Confidence: {data.get('confidence')}"
            self.log_test("AI Sentiment Analysis", success, details)
            return success
        except Exception as e:
            self.log_test("AI Sentiment Analysis", False, f"Exception: {str(e)}")
            return False

    def test_ai_generate_summary(self):
        """Test AI summary generation placeholder"""
        try:
            test_data = {"business_id": self.test_business_id or "test_id"}
            response = self.session.post(
                f"{self.base_url}/api/ai/generate-summary",
                json=test_data,
                timeout=10
            )
            success = response.status_code == 200
            details = f"Status: {response.status_code}"
            if success:
                data = response.json()
                details += f", Summary length: {len(data.get('summary', ''))}"
            self.log_test("AI Generate Summary", success, details)
            return success
        except Exception as e:
            self.log_test("AI Generate Summary", False, f"Exception: {str(e)}")
            return False

    def test_logout(self):
        """Test logout"""
        try:
            response = self.session.post(f"{self.base_url}/api/auth/logout", timeout=10)
            success = response.status_code == 200
            details = f"Status: {response.status_code}"
            self.log_test("Logout", success, details)
            return success
        except Exception as e:
            self.log_test("Logout", False, f"Exception: {str(e)}")
            return False

    def run_all_tests(self):
        """Run all API tests"""
        print("🚀 Starting API Tests for Review Analyzer")
        print("=" * 50)
        
        # Test health check first
        if not self.test_health_check():
            print("❌ Health check failed - API may be down")
            return False
        
        # Test user registration
        self.test_user_registration()
        
        # Test admin login (required for authenticated endpoints)
        if not self.test_admin_login():
            print("❌ Admin login failed - cannot test authenticated endpoints")
            return False
        
        # Test authenticated endpoints
        self.test_get_current_user()
        self.test_create_business()
        self.test_get_businesses()
        self.test_create_review()
        self.test_get_reviews()
        self.test_dashboard_stats()
        self.test_ai_sentiment_analysis()
        self.test_ai_generate_summary()
        self.test_logout()
        
        # Print summary
        print("\n" + "=" * 50)
        print(f"📊 Test Results: {self.tests_passed}/{self.tests_run} passed")
        
        if self.failed_tests:
            print("\n❌ Failed Tests:")
            for test in self.failed_tests:
                print(f"  - {test['test']}: {test['details']}")
        
        return self.tests_passed == self.tests_run

def main():
    tester = ReviewAnalyzerAPITester()
    success = tester.run_all_tests()
    return 0 if success else 1

if __name__ == "__main__":
    sys.exit(main())
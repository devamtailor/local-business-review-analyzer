# Test Credentials

## Admin User
- Email: admin@example.com
- Password: admin123
- Role: admin

## Test User (register via app)
- Use any valid email format
- Password: minimum 6 characters

## Auth Endpoints
- POST /api/auth/register - Create new user
- POST /api/auth/login - Login user
- POST /api/auth/logout - Logout user
- GET /api/auth/me - Get current user (requires auth)
- POST /api/auth/refresh - Refresh access token

## Business Endpoints
- GET /api/businesses - List all businesses
- POST /api/businesses - Create business (requires auth)
- GET /api/businesses/{id} - Get business details
- PUT /api/businesses/{id} - Update business (requires auth)
- DELETE /api/businesses/{id} - Delete business (requires auth)

## Review Endpoints
- GET /api/reviews - List all reviews
- POST /api/reviews - Create review (requires auth)
- GET /api/reviews/{id} - Get review details
- PUT /api/reviews/{id} - Update review (requires auth)
- DELETE /api/reviews/{id} - Delete review (requires auth)

## Dashboard
- GET /api/dashboard/stats - Get dashboard statistics (requires auth)

## AI Placeholders (MOCKED)
- POST /api/ai/analyze-sentiment - Returns mock sentiment response
- POST /api/ai/generate-summary - Returns mock AI summary

# AI-Powered Local Business Review Analyzer - PRD

## Original Problem Statement
Build a full-stack web application skeleton for "AI-Powered Local Business Review Analyzer" with:
- React frontend with Tailwind
- FastAPI backend (Python)
- MongoDB database
- JWT authentication
- Review CRUD APIs
- Simple dashboard with placeholder charts
- AI placeholders for sentiment analysis and summaries

## User Choices
- **Database**: MongoDB
- **Authentication**: JWT-based custom auth
- **Charts**: Chart.js (bar/pie charts)
- **AI Features**: Placeholders for sentiment analysis + AI summaries

## Architecture

### Tech Stack
- **Frontend**: React 18, Tailwind CSS, Chart.js, Phosphor Icons
- **Backend**: FastAPI (Python), Motor (async MongoDB driver)
- **Database**: MongoDB
- **Authentication**: JWT with httpOnly cookies, bcrypt password hashing

### File Structure
```
/app
├── backend/
│   ├── server.py          # FastAPI application
│   ├── requirements.txt   # Python dependencies
│   ├── .env              # Environment variables
│   └── .env.example      # Environment template
├── frontend/
│   ├── src/
│   │   ├── App.js        # Main app with routing
│   │   ├── contexts/     # AuthContext
│   │   └── pages/        # Login, Register, Dashboard, Businesses, Reviews
│   ├── package.json
│   └── tailwind.config.js
└── memory/
    └── test_credentials.md
```

## Core Requirements (Static)

### Authentication
- [x] User registration with email/password
- [x] User login with JWT tokens
- [x] Admin seeding on startup
- [x] Protected routes
- [x] Brute force protection

### Business Management
- [x] Create business (name, category, address)
- [x] List all businesses
- [x] Update business
- [x] Delete business (with associated reviews)

### Review System
- [x] Create review (rating 1-5, text)
- [x] Automatic sentiment classification (positive/neutral/negative based on rating)
- [x] List reviews (filterable by business)
- [x] Update/delete reviews (own or admin)
- [x] Business stats update on review changes

### Dashboard
- [x] Total businesses count
- [x] Total reviews count
- [x] Sentiment distribution (pie chart)
- [x] Rating distribution (bar chart)
- [x] Recent reviews
- [x] Top-rated businesses

### AI Placeholders
- [x] Sentiment analysis endpoint (placeholder)
- [x] AI summary generation endpoint (placeholder)
- [x] AI Insights card in dashboard

## What's Been Implemented (April 4, 2026)

### Backend APIs
| Endpoint | Method | Description | Status |
|----------|--------|-------------|--------|
| /api/health | GET | Health check | ✅ |
| /api/auth/register | POST | User registration | ✅ |
| /api/auth/login | POST | User login | ✅ |
| /api/auth/logout | POST | User logout | ✅ |
| /api/auth/me | GET | Get current user | ✅ |
| /api/auth/refresh | POST | Refresh token | ✅ |
| /api/businesses | GET/POST | List/Create businesses | ✅ |
| /api/businesses/{id} | GET/PUT/DELETE | CRUD operations | ✅ |
| /api/reviews | GET/POST | List/Create reviews | ✅ |
| /api/reviews/{id} | GET/PUT/DELETE | CRUD operations | ✅ |
| /api/dashboard/stats | GET | Dashboard statistics | ✅ |
| /api/ai/analyze-sentiment | POST | AI placeholder | ✅ |
| /api/ai/generate-summary | POST | AI placeholder | ✅ |

### Frontend Pages
- Login page with error handling
- Registration page
- Dashboard with charts (Chart.js)
- Businesses management (CRUD)
- Reviews management (CRUD with filtering)
- Responsive sidebar navigation

### Design System
- Swiss/High-Contrast minimalist theme
- Cabinet Grotesk + Satoshi typography
- Sharp edges (rounded-none)
- Accent color: Signal Red (#FF331F)

## Test Results
- Backend: 100% (12/12 tests passed)
- Frontend: 95% (external preview environment sleeping)

## Deployment Readiness
- [x] Environment variables configured
- [x] CORS configured for production
- [x] .gitignore created
- [x] .env.example files created

## Prioritized Backlog

### P0 - Critical (Next)
- Integrate actual AI sentiment analysis (OpenAI/Anthropic)
- Integrate AI summary generation
- Add pagination for reviews/businesses

### P1 - Important
- Password reset flow
- User profile management
- Review images upload
- Email notifications

### P2 - Nice to Have
- Advanced analytics dashboard
- Export reports (CSV/PDF)
- Multi-language support
- Dark mode toggle

## User Personas
1. **Business Owner**: Wants to track customer feedback and improve services
2. **Analyst**: Needs aggregated sentiment data and trends
3. **Admin**: Manages businesses and moderates reviews

## Next Tasks
1. Integrate OpenAI/Anthropic for real sentiment analysis
2. Add review image uploads (Cloudinary)
3. Implement pagination
4. Add email notifications for new reviews

# Smart.pr Helper API Proxy Architecture

## Overview

This document outlines the architecture for moving from client-side OpenAI API calls to a secure proxy API hosted on Replit. This approach provides better security, usage tracking, rate limiting, and user management.

## Architecture Diagram

```
┌─────────────────┐
│  Chrome         │
│  Extension      │
│  (Client)       │
└────────┬────────┘
         │
         │ HTTPS POST
         │ /api/generate-subjects
         │ Body: { email, prompt, context }
         │
         ▼
┌─────────────────┐
│  Replit API     │
│  (Proxy Server) │
│                 │
│  - Auth check   │
│  - Rate limit   │
│  - Usage log    │
└────────┬────────┘
         │
         │ OpenAI API call
         │ (with server's API key)
         │
         ▼
┌─────────────────┐
│  OpenAI API     │
└─────────────────┘
```

## Benefits

1. **Security**
   - OpenAI API key never exposed to client
   - No risk of key theft from browser
   - Server-side validation and sanitization

2. **Control & Monitoring**
   - Track usage per user (by email)
   - Set rate limits (requests per hour/day)
   - Monitor costs in real-time
   - Block abusive users

3. **User Experience**
   - No API key setup required
   - Just enter email address
   - Instant access for authorized users

4. **Flexibility**
   - Switch AI providers without extension updates
   - A/B test different prompts server-side
   - Add features like caching, retries, fallbacks
   - Upgrade models without user intervention

## Implementation Tasks

---

## CHROME EXTENSION TASKS (Claude Code)

### 1. Remove Direct OpenAI Integration

**Files to modify:**
- `smartpr-helper-v2/content.js`
- `smartpr-helper-v2/manifest.json`

**Changes:**
- Remove OpenAI API key storage logic
- Remove `host_permissions` for OpenAI API
- Remove direct `fetch()` calls to OpenAI

### 2. Add Email Configuration

**Files to modify:**
- `smartpr-helper-v2/options.html`
- `smartpr-helper-v2/options.js`
- `smartpr-helper-v2/popup.html`
- `smartpr-helper-v2/popup.js`

**Changes:**
- Replace "API Key" input with "Email Address" input
- Update storage key from `smartpr_api_key` to `smartpr_user_email`
- Add email validation (basic format check)
- Update UI copy to explain email is for usage tracking

**New UI Copy:**
```
Settings Page:
Title: "Smart.pr Helper Settings"
Label: "Your Email Address"
Help Text: "We use your email to track usage and provide you with AI-powered suggestions. Your Smart.pr team account email works best."
Placeholder: "you@company.com"
```

### 3. Create API Client Module

**New file:** `smartpr-helper-v2/api-client.js`

**Purpose:** Centralized API communication layer

**Functions needed:**
```javascript
// Base configuration
const API_BASE_URL = 'https://YOUR-REPLIT-APP.repl.co/api';

// Main API call function
async function callProxyAPI(endpoint, payload) {
  // GET user email from storage
  // POST to proxy API with email + payload
  // Handle errors (network, 429 rate limit, 403 forbidden, etc.)
  // Return response or throw meaningful error
}

// Subject generation endpoint
async function generateSubjectLines(userPrompt, context) {
  return callProxyAPI('/generate-subjects', {
    prompt: userPrompt,
    context: context || {}
  });
}

// Subject feedback endpoint
async function getSubjectFeedback(subjectLine) {
  return callProxyAPI('/feedback-subject', {
    subject: subjectLine
  });
}

// Health check / user validation
async function validateUser(email) {
  return callProxyAPI('/validate-user', { email });
}
```

### 4. Update Content Script

**Files to modify:**
- `smartpr-helper-v2/content.js`

**Changes:**
- Import/include `api-client.js` functionality
- Replace `callOpenAI()` with `generateSubjectLines()` from API client
- Update error handling for new error types:
  - `USER_NOT_FOUND` - email not authorized
  - `RATE_LIMIT_EXCEEDED` - too many requests
  - `SERVER_ERROR` - proxy server issues
  - `OPENAI_ERROR` - OpenAI API issues
- Update loading/error messages to be user-friendly

**Error Message Examples:**
```javascript
{
  USER_NOT_FOUND: "Please enter your Smart.pr email address in settings.",
  RATE_LIMIT_EXCEEDED: "You've reached your hourly limit. Please try again in a few minutes.",
  INVALID_EMAIL: "Please enter a valid email address in settings.",
  SERVER_ERROR: "Our AI service is temporarily unavailable. Please try again.",
  NETWORK_ERROR: "Connection failed. Please check your internet connection."
}
```

### 5. Update Manifest

**Files to modify:**
- `smartpr-helper-v2/manifest.json`

**Changes:**
```json
{
  "host_permissions": [
    "https://YOUR-REPLIT-APP.repl.co/*"
  ],
  "content_scripts": [{
    "js": ["api-client.js", "content.js"]
  }]
}
```

### 6. Testing Checklist

- [ ] Email saved to storage correctly
- [ ] API calls include email in headers/body
- [ ] Error states display user-friendly messages
- [ ] Rate limiting errors show helpful guidance
- [ ] Unauthorized email shows clear instructions
- [ ] Network errors handled gracefully
- [ ] Settings page validates email format

---

## REPLIT API SERVER TASKS (Replit Agent)

### 1. Initialize Node.js/Express Server

**Setup:**
- Initialize new Node.js project
- Install dependencies: `express`, `cors`, `dotenv`, `node-fetch` or `axios`
- Set up environment variables for OpenAI API key
- Configure CORS to allow Chrome extension origin

**File structure:**
```
/replit-api
├── .env                 # OpenAI API key, secrets
├── package.json
├── server.js            # Express app entry point
├── routes/
│   └── api.js          # API route handlers
├── middleware/
│   ├── auth.js         # Email validation
│   ├── rateLimit.js    # Rate limiting logic
│   └── errorHandler.js # Error handling
├── services/
│   └── openai.js       # OpenAI API wrapper
└── db/
    └── users.json      # Simple user store (upgrade to DB later)
```

### 2. User Authentication/Authorization

**File:** `middleware/auth.js`

**Features:**
- Validate email format
- Check if email is in authorized users list
- Block requests from unauthorized emails
- Return 403 with clear error message if not authorized

**Authorized Users Store:**
```json
// db/users.json (initial simple version)
{
  "users": [
    {
      "email": "john@company.com",
      "status": "active",
      "rateLimit": {
        "requestsPerHour": 50,
        "requestsPerDay": 200
      },
      "addedAt": "2026-01-20T10:00:00Z"
    }
  ]
}
```

### 3. Rate Limiting

**File:** `middleware/rateLimit.js`

**Features:**
- Track requests per user (by email)
- Enforce hourly and daily limits
- Use in-memory store initially (upgrade to Redis later)
- Return 429 status with retry-after header when limit exceeded

**Rate Limit Response:**
```json
{
  "error": "RATE_LIMIT_EXCEEDED",
  "message": "You've exceeded your hourly limit of 50 requests.",
  "retryAfter": 3600,
  "limits": {
    "hourly": { "limit": 50, "remaining": 0, "resetsAt": "2026-01-21T15:00:00Z" },
    "daily": { "limit": 200, "remaining": 150, "resetsAt": "2026-01-22T00:00:00Z" }
  }
}
```

### 4. API Endpoints

**File:** `routes/api.js`

#### POST `/api/generate-subjects`

**Request:**
```json
{
  "email": "user@company.com",
  "prompt": "Generate 3-5 subject lines for: [user's PR description]",
  "context": {
    "currentSubject": "optional existing subject",
    "language": "en"
  }
}
```

**Response:**
```json
{
  "success": true,
  "subjects": [
    "Subject line 1",
    "Subject line 2",
    "Subject line 3"
  ],
  "usage": {
    "requestsRemaining": 45,
    "dailyRemaining": 195
  }
}
```

#### POST `/api/feedback-subject`

**Request:**
```json
{
  "email": "user@company.com",
  "subject": "Current subject line to analyze",
  "context": {
    "keepLanguage": true
  }
}
```
`context` is optional; `keepLanguage` enforces same-language responses.

**Response:**
```json
{
  "success": true,
  "feedback": "Detailed feedback text from AI...",
  "usage": {
    "requestsRemaining": 44,
    "dailyRemaining": 194
  }
}
```

#### POST `/api/validate-user`

**Request:**
```json
{
  "email": "user@company.com"
}
```

**Response:**
```json
{
  "valid": true,
  "status": "active",
  "limits": {
    "hourly": 50,
    "daily": 200
  }
}
```

### 5. OpenAI Integration

**File:** `services/openai.js`

**Features:**
- Wrapper around OpenAI API
- Use server's API key from environment variable
- Handle OpenAI errors gracefully
- Add retry logic for transient failures
- Log requests for debugging/monitoring

**Key Functions:**
```javascript
async function generateSubjects(systemPrompt, userPrompt) {
  // Call OpenAI Chat Completions API
  // Model: gpt-4o-mini
  // Temperature: 0.8
  // Parse JSON response
  // Return subjects array
}

async function generateFeedback(systemPrompt, userPrompt) {
  // Call OpenAI Chat Completions API
  // Model: gpt-4o-mini
  // Temperature: 0.7
  // Keep output in the same language as the subject line
  // Return feedback text
}
```

### 6. Usage Logging

**File:** `services/logger.js`

**Features:**
- Log all requests with timestamp, email, endpoint
- Track OpenAI token usage
- Monitor costs per user
- Export logs for analysis

**Log Format:**
```json
{
  "timestamp": "2026-01-21T14:30:00Z",
  "email": "user@company.com",
  "endpoint": "/api/generate-subjects",
  "tokensUsed": 450,
  "cost": 0.0023,
  "responseTime": 1250,
  "success": true
}
```

### 7. Error Handling

**File:** `middleware/errorHandler.js`

**Features:**
- Catch all errors
- Return consistent error format
- Log errors for debugging
- Don't expose internal details to client

**Standard Error Response:**
```json
{
  "success": false,
  "error": "ERROR_CODE",
  "message": "User-friendly error message",
  "details": {} // Optional additional context
}
```

### 8. Environment Configuration

**File:** `.env`

```env
# OpenAI
OPENAI_API_KEY=sk-...

# Server
PORT=3000
NODE_ENV=production

# CORS
ALLOWED_ORIGINS=chrome-extension://YOUR-EXTENSION-ID

# Rate Limits (defaults)
DEFAULT_HOURLY_LIMIT=50
DEFAULT_DAILY_LIMIT=200

# Feature Flags
ENABLE_LOGGING=true
ENABLE_RATE_LIMITING=true
```

### 9. Admin Endpoints (Optional)

**Protected endpoints for managing users:**

- `POST /admin/users` - Add new authorized user
- `DELETE /admin/users/:email` - Remove user
- `PUT /admin/users/:email/limits` - Update rate limits
- `GET /admin/usage` - Get usage statistics
- `GET /admin/costs` - Get cost breakdown

### 10. Testing & Deployment

**Pre-deployment checklist:**
- [ ] Environment variables configured
- [ ] CORS allows extension origin
- [ ] Rate limiting tested
- [ ] OpenAI integration working
- [ ] Error handling covers all cases
- [ ] Logging captures important events
- [ ] Health check endpoint works
- [ ] Load testing completed

**Deployment:**
- Deploy to Replit
- Get production URL
- Update Chrome extension with production API URL
- Add initial authorized users
- Monitor logs for issues

---

## Future Enhancements

### Phase 2 (After Initial Launch)
1. **Database Migration**: Move from JSON file to PostgreSQL/MongoDB
2. **Caching**: Cache common requests to reduce OpenAI costs
3. **Analytics Dashboard**: Web UI to view usage statistics
4. **User Self-Service**: Allow users to check their own usage
5. **Webhooks**: Notify admins when limits are reached or errors occur

### Phase 3 (Advanced Features)
1. **Team Management**: Group users by organization
2. **Custom Prompts**: Allow admins to A/B test different prompts
3. **Multi-Provider**: Support for Claude, Gemini as fallbacks
4. **Smart Caching**: Cache similar requests with fuzzy matching
5. **Usage Predictions**: Alert users before hitting limits
6. **Priority Tiers**: Different limits for different user levels

---

## Security Considerations

1. **API Key Protection**
   - Never log the full OpenAI API key
   - Rotate key periodically
   - Monitor for unusual usage patterns

2. **User Privacy**
   - Don't store PR content long-term
   - Anonymize logs after analysis
   - GDPR compliance for EU users

3. **Rate Limiting**
   - Prevent abuse and cost overruns
   - Implement exponential backoff
   - Add CAPTCHA for suspicious activity

4. **Input Validation**
   - Sanitize all user inputs
   - Limit prompt length
   - Block injection attempts

5. **CORS Configuration**
   - Only allow specific extension origins
   - Validate origin header
   - Use HTTPS only

---

## Cost Estimation

**OpenAI API Costs (GPT-4o-mini):**
- Input: ~$0.15 per 1M tokens
- Output: ~$0.60 per 1M tokens

**Average Request:**
- System prompt: ~300 tokens
- User prompt: ~200 tokens
- Response: ~150 tokens
- **Total per request: ~650 tokens ≈ $0.0004**

**Monthly Costs (50 users, 20 requests/day each):**
- 50 users × 20 requests × 30 days = 30,000 requests
- 30,000 × $0.0004 = **$12/month**

Very affordable, even with safety margin for spikes.

---

## Timeline Estimate

**Chrome Extension Updates:** 2-3 hours
- Remove OpenAI key logic
- Add email configuration
- Create API client
- Update error handling
- Testing

**Replit API Development:** 4-6 hours
- Express server setup
- Auth & rate limiting middleware
- OpenAI integration
- Error handling & logging
- Testing & deployment

**Total:** 6-9 hours to complete both parts

---

## Questions to Resolve

1. **User Management**: How will you initially populate authorized users? Manual addition via admin endpoint?

2. **Rate Limits**: Are 50 requests/hour and 200/day reasonable defaults? Should power users get higher limits?

3. **Error Handling**: Should users see different messages for "email not found" vs "email not authorized" or keep it generic for security?

4. **Deployment**: Will the Replit app be always-on (paid plan) or can it tolerate cold starts?

5. **Extension ID**: The extension ID will change between development and production. How to handle CORS for both?

6. **Monitoring**: Do you want email alerts when things go wrong, or just check Replit logs?

---

## Next Steps

1. **Review this document** - Make sure architecture meets your needs
2. **Set up Replit project** - Create the API server (Replit Agent task)
3. **Update Chrome extension** - Implement API client (Claude Code task)
4. **Testing** - Test end-to-end with a test user
5. **Deploy** - Push both to production
6. **Add users** - Populate initial authorized users list
7. **Monitor** - Watch logs for issues in first week

---

## Contact & Support

Once deployed:
- **API URL**: https://YOUR-APP.repl.co
- **Health Check**: GET /health
- **Admin Access**: [Define how admins authenticate]
- **Logs**: Available in Replit dashboard

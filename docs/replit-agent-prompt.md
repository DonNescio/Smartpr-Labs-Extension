# Replit Agent Prompt: Smart.pr Helper Proxy API

## Project Overview

Build a secure Node.js/Express API server that acts as a proxy between a Chrome extension and the OpenAI API. This proxy will protect the OpenAI API key, track usage per user (by email), enforce rate limits, and provide monitoring capabilities.

## Technical Stack

- **Runtime**: Node.js (latest LTS)
- **Framework**: Express.js
- **Dependencies**:
  - `express` - Web framework
  - `cors` - CORS middleware
  - `dotenv` - Environment variables
  - `axios` - HTTP client for OpenAI API
  - `express-rate-limit` - Rate limiting (optional, we'll build custom)
- **Storage**: JSON file initially (easy to upgrade to database later)

## Project Structure

Create this file structure:

```
/
├── .env                    # Environment variables (OpenAI key, config)
├── .gitignore              # Ignore .env, node_modules
├── package.json            # Dependencies
├── server.js               # Main Express app
├── config.js               # Configuration loader
├── middleware/
│   ├── auth.js            # Email validation middleware
│   ├── rateLimit.js       # Rate limiting middleware
│   └── errorHandler.js    # Global error handler
├── routes/
│   └── api.js             # API route handlers
├── services/
│   ├── openai.js          # OpenAI API wrapper
│   └── logger.js          # Usage logging
└── data/
    └── users.json         # Authorized users store
```

## Required Endpoints

### 1. POST `/api/generate-subjects`

Generate subject line suggestions using OpenAI.

**Request Body:**
```json
{
  "email": "user@company.com",
  "prompt": "Generate 3-5 subject lines for: [description]",
  "context": {
    "currentSubject": "optional",
    "language": "en"
  }
}
```

**Success Response (200):**
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
    "hourlyLimit": 50,
    "dailyRemaining": 195,
    "dailyLimit": 200
  }
}
```

**Error Responses:**
- 400: Invalid request (missing email/prompt)
- 403: Unauthorized email
- 429: Rate limit exceeded
- 500: Server/OpenAI error

### 2. POST `/api/feedback-subject`

Get feedback on a subject line using OpenAI.

**Request Body:**
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

**Success Response (200):**
```json
{
  "success": true,
  "feedback": "Detailed feedback text from AI...",
  "usage": {
    "requestsRemaining": 44,
    "hourlyLimit": 50,
    "dailyRemaining": 194,
    "dailyLimit": 200
  }
}
```

### 3. POST `/api/validate-user`

Check if a user email is authorized and get their limits.

**Request Body:**
```json
{
  "email": "user@company.com"
}
```

**Success Response (200):**
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

**Error Response (403):**
```json
{
  "valid": false,
  "error": "USER_NOT_AUTHORIZED",
  "message": "This email is not authorized to use the service."
}
```

### 4. GET `/health`

Health check endpoint.

**Response (200):**
```json
{
  "status": "healthy",
  "timestamp": "2026-01-21T14:30:00Z"
}
```

## Middleware Requirements

### Authentication Middleware (`middleware/auth.js`)

1. Extract email from request body
2. Validate email format (basic regex)
3. Check if email exists in `data/users.json`
4. Check if user status is "active"
5. If invalid/unauthorized, return 403 error
6. If valid, attach user object to `req.user` and continue

### Rate Limiting Middleware (`middleware/rateLimit.js`)

1. Track requests per user email using in-memory Map
2. Store: `{ email: { hourly: { count, resetAt }, daily: { count, resetAt } } }`
3. Check if user exceeded hourly limit (default: 50)
4. Check if user exceeded daily limit (default: 200)
5. Reset counters when time window expires
6. If limit exceeded, return 429 with retry-after header
7. If within limits, increment counter and continue

**Rate Limit Error Response (429):**
```json
{
  "success": false,
  "error": "RATE_LIMIT_EXCEEDED",
  "message": "You've exceeded your hourly limit of 50 requests.",
  "retryAfter": 3600,
  "limits": {
    "hourly": {
      "limit": 50,
      "remaining": 0,
      "resetsAt": "2026-01-21T15:00:00Z"
    },
    "daily": {
      "limit": 200,
      "remaining": 150,
      "resetsAt": "2026-01-22T00:00:00Z"
    }
  }
}
```

### Error Handler Middleware (`middleware/errorHandler.js`)

1. Catch all errors from routes
2. Log error details to console
3. Return consistent error format
4. Don't expose internal errors to client

**Standard Error Format:**
```json
{
  "success": false,
  "error": "ERROR_CODE",
  "message": "User-friendly error message"
}
```

**Error Codes to Handle:**
- `INVALID_REQUEST` - Missing/invalid parameters
- `USER_NOT_AUTHORIZED` - Email not in authorized list
- `RATE_LIMIT_EXCEEDED` - Too many requests
- `OPENAI_ERROR` - OpenAI API error
- `SERVER_ERROR` - Internal server error

## OpenAI Integration (`services/openai.js`)

### Function: `generateSubjects(systemPrompt, userPrompt)`

1. Call OpenAI Chat Completions API
2. Use model: `gpt-4o-mini`
3. Temperature: `0.8`
4. Messages:
   ```javascript
   [
     { role: "system", content: systemPrompt },
     { role: "user", content: userPrompt }
   ]
   ```
5. Parse response to extract content
6. Handle OpenAI errors (invalid key, rate limit, etc.)
7. Return the generated text

### Function: `generateFeedback(systemPrompt, userPrompt)`

1. Same as above but with temperature: `0.7`
2. Return feedback text

**System Prompts (use these):**

For subject generation:
```
You are an award-winning PR strategist specializing in press release subject lines. Your goal is to create compelling, newsworthy subject lines that get opened.

Guidelines:
1. Keep subject lines under 70 characters
2. Lead with the news hook or key benefit
3. Use active voice and strong verbs
4. Avoid spam indicators (all caps, excessive punctuation, "FREE", "ACT NOW")
5. Detect language (Dutch/English) and match it
6. Make each suggestion distinct with different angles

Return ONLY valid JSON in this exact format:
{"subjects": ["subject 1", "subject 2", "subject 3"]}
```

For feedback:
```
You are an experienced PR strategist providing constructive feedback on press release subject lines.

Analyze the subject line for:
1. Clarity and impact
2. Length (40-60 characters is ideal)
3. News hook presence
4. Language effectiveness
5. Potential improvements

Provide specific, actionable feedback in a friendly tone.
Respond in the same language as the subject line. Do not translate.
```

## User Management (`data/users.json`)

Create initial users file with this structure:

```json
{
  "users": [
    {
      "email": "test@smart.pr",
      "status": "active",
      "limits": {
        "hourly": 50,
        "daily": 200
      },
      "addedAt": "2026-01-21T10:00:00Z"
    },
    {
      "email": "demo@smart.pr",
      "status": "active",
      "limits": {
        "hourly": 100,
        "daily": 500
      },
      "addedAt": "2026-01-21T10:00:00Z"
    }
  ]
}
```

**Note:** Load this file into memory at startup. We can add database later.

## Logging (`services/logger.js`)

### Function: `logRequest(data)`

Log all API requests with this information:

```javascript
{
  timestamp: new Date().toISOString(),
  email: req.body.email,
  endpoint: req.path,
  success: true/false,
  responseTime: milliseconds,
  error: errorMessage (if failed)
}
```

For now, just log to console. Format nicely for readability.

## Environment Variables (`.env`)

```env
# OpenAI Configuration
OPENAI_API_KEY=sk-proj-your-key-here

# Server Configuration
PORT=3000
NODE_ENV=production

# CORS Configuration
# Note: Chrome extension ID will be provided later
ALLOWED_ORIGINS=*

# Rate Limit Defaults
DEFAULT_HOURLY_LIMIT=50
DEFAULT_DAILY_LIMIT=200

# Feature Flags
ENABLE_LOGGING=true
ENABLE_RATE_LIMITING=true
```

## CORS Configuration

Set up CORS to allow:
1. Any origin for now (we'll restrict to extension ID later)
2. Methods: POST, GET, OPTIONS
3. Headers: Content-Type, Authorization
4. Credentials: true

```javascript
app.use(cors({
  origin: '*', // Will be restricted to extension ID later
  methods: ['POST', 'GET', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));
```

## Main Server Setup (`server.js`)

1. Load environment variables with dotenv
2. Initialize Express app
3. Add CORS middleware
4. Add body parser (express.json())
5. Add request logging
6. Mount API routes at `/api`
7. Add health check endpoint at `/health`
8. Add error handler middleware (must be last)
9. Start server on PORT from env

Example structure:
```javascript
const express = require('express');
const cors = require('cors');
require('dotenv').config();

const apiRoutes = require('./routes/api');
const errorHandler = require('./middleware/errorHandler');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors({ origin: '*' }));
app.use(express.json());

// Routes
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

app.use('/api', apiRoutes);

// Error handler (must be last)
app.use(errorHandler);

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Smart.pr Helper API running on port ${PORT}`);
  console.log(`📝 Environment: ${process.env.NODE_ENV}`);
  console.log(`🔐 OpenAI Key: ${process.env.OPENAI_API_KEY ? 'Configured' : 'MISSING'}`);
});
```

## Testing Requirements

Before considering this complete, test:

1. **Health Check**: `GET /health` returns 200
2. **Valid User**: POST to `/api/generate-subjects` with authorized email succeeds
3. **Invalid User**: POST with unauthorized email returns 403
4. **Rate Limiting**: Make 51 requests in an hour, verify 51st returns 429
5. **OpenAI Integration**: Verify actual subject lines are generated
6. **Error Handling**: Invalid requests return proper error format
7. **CORS**: Verify CORS headers are present

## Success Criteria

✅ Server starts without errors
✅ Health check endpoint works
✅ User authentication works (authorized/unauthorized)
✅ Rate limiting tracks and enforces limits
✅ OpenAI integration generates subjects successfully
✅ Error responses use consistent format
✅ CORS configured correctly
✅ Logs show request details
✅ All endpoints return expected JSON structure

## Important Notes

1. **Security**: Never log the full OpenAI API key
2. **Error Messages**: Be specific but don't expose internal details
3. **Rate Limits**: Reset counters when time window expires
4. **JSON Parsing**: Handle cases where OpenAI doesn't return valid JSON
5. **Validation**: Validate all inputs before processing
6. **Status Codes**: Use correct HTTP status codes (200, 400, 403, 429, 500)

## Example Request Flow

```
1. Chrome Extension → POST /api/generate-subjects
   Body: { email: "test@smart.pr", prompt: "..." }

2. Auth Middleware → Check if email in users.json
   ✅ Found, status: active

3. Rate Limit Middleware → Check hourly/daily counts
   ✅ Within limits (45/50 hourly, 195/200 daily)

4. Route Handler → Call OpenAI service
   ✅ Generate subjects with gpt-4o-mini

5. Response → Return subjects + usage info
   Status: 200
   Body: { success: true, subjects: [...], usage: {...} }

6. Logger → Log request details to console
```

## Deployment Notes

Once built and tested:
1. Deploy to Replit (keep app always on)
2. Note the production URL: `https://YOUR-APP.repl.co`
3. Update Chrome extension with this URL
4. Add real user emails to `users.json`
5. Restrict CORS to actual extension ID

## Questions?

If anything is unclear:
1. Start with the basic Express server
2. Add one feature at a time
3. Test each feature before moving to the next
4. Console log liberally for debugging

Good luck! 🚀

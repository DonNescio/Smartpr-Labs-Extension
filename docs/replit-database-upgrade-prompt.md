# Replit Agent Prompt: Add Database & Admin Dashboard

## Project Overview

Upgrade the existing Smart.pr Helper Proxy API to use Replit Database for user management and add a secure admin dashboard to view usage statistics.

## Current State

You have a working Express API with:
- User authentication via `data/users.json` file
- Rate limiting in memory
- OpenAI integration
- Basic statistics endpoint

## What to Build

### 1. Database Integration
Replace the JSON file with Replit Database for user management and usage tracking.

### 2. Admin Dashboard
Create a secure web interface to:
- View all users and their usage
- See request counts per user
- Monitor rate limits
- Add/remove users
- Adjust user limits

## Implementation Tasks

---

## PART 1: Database Schema & Migration

### Install Replit Database

Replit Database is built-in, no installation needed. Use the `@replit/database` package.

```bash
npm install @replit/database
```

### Database Schema

Use these keys in Replit Database:

#### User Records
```
Key: user:{email}
Value: {
  email: "user@company.com",
  status: "active" | "inactive",
  limits: {
    hourly: 50,
    daily: 200
  },
  createdAt: "2026-01-21T10:00:00Z",
  updatedAt: "2026-01-21T10:00:00Z"
}
```

#### Usage Records
```
Key: usage:{email}:{date}
Value: {
  email: "user@company.com",
  date: "2026-01-21",
  requests: [
    {
      timestamp: "2026-01-21T14:30:00Z",
      endpoint: "/api/generate-subjects",
      success: true,
      responseTime: 1234
    }
  ],
  totalRequests: 5,
  hourlyRequests: {
    "14": 3,
    "15": 2
  }
}
```

#### Rate Limit Tracking
```
Key: ratelimit:{email}:{hour}
Value: {
  email: "user@company.com",
  hour: "2026-01-21T14",
  count: 5,
  resetAt: "2026-01-21T15:00:00Z"
}
```

### Create Database Service

**File:** `services/database.js`

```javascript
const Database = require('@replit/database');
const db = new Database();

// User Management
async function getUser(email) {
  const key = `user:${email}`;
  return await db.get(key);
}

async function createUser(email, limits = { hourly: 50, daily: 200 }) {
  const key = `user:${email}`;
  const user = {
    email,
    status: 'active',
    limits,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  await db.set(key, user);
  return user;
}

async function updateUser(email, updates) {
  const user = await getUser(email);
  if (!user) throw new Error('User not found');

  const updated = {
    ...user,
    ...updates,
    updatedAt: new Date().toISOString()
  };
  await db.set(`user:${email}`, updated);
  return updated;
}

async function deleteUser(email) {
  await db.delete(`user:${email}`);
}

async function getAllUsers() {
  const keys = await db.list();
  const userKeys = keys.filter(k => k.startsWith('user:'));
  const users = await Promise.all(
    userKeys.map(key => db.get(key))
  );
  return users.filter(u => u !== null);
}

// Usage Tracking
async function logRequest(email, endpoint, success, responseTime) {
  const date = new Date().toISOString().split('T')[0];
  const key = `usage:${email}:${date}`;

  const usage = await db.get(key) || {
    email,
    date,
    requests: [],
    totalRequests: 0,
    hourlyRequests: {}
  };

  const hour = new Date().getHours();
  usage.requests.push({
    timestamp: new Date().toISOString(),
    endpoint,
    success,
    responseTime
  });
  usage.totalRequests++;
  usage.hourlyRequests[hour] = (usage.hourlyRequests[hour] || 0) + 1;

  await db.set(key, usage);
}

async function getUserUsage(email, date) {
  const key = `usage:${email}:${date}`;
  return await db.get(key);
}

async function getUserUsageRange(email, startDate, endDate) {
  const keys = await db.list();
  const usageKeys = keys.filter(k =>
    k.startsWith(`usage:${email}:`) &&
    k >= `usage:${email}:${startDate}` &&
    k <= `usage:${email}:${endDate}`
  );

  const usages = await Promise.all(
    usageKeys.map(key => db.get(key))
  );
  return usages.filter(u => u !== null);
}

// Rate Limiting
async function getRateLimit(email) {
  const now = new Date();
  const hour = now.toISOString().slice(0, 13); // "2026-01-21T14"
  const key = `ratelimit:${email}:${hour}`;

  return await db.get(key) || {
    email,
    hour,
    count: 0,
    resetAt: new Date(now.getTime() + 3600000).toISOString()
  };
}

async function incrementRateLimit(email) {
  const now = new Date();
  const hour = now.toISOString().slice(0, 13);
  const key = `ratelimit:${email}:${hour}`;

  const limit = await getRateLimit(email);
  limit.count++;
  await db.set(key, limit);

  return limit;
}

// Admin Stats
async function getAdminStats() {
  const users = await getAllUsers();
  const today = new Date().toISOString().split('T')[0];

  const stats = {
    totalUsers: users.length,
    activeUsers: users.filter(u => u.status === 'active').length,
    todayRequests: 0,
    userStats: []
  };

  for (const user of users) {
    const usage = await getUserUsage(user.email, today);
    const rateLimit = await getRateLimit(user.email);

    stats.userStats.push({
      email: user.email,
      status: user.status,
      limits: user.limits,
      todayRequests: usage?.totalRequests || 0,
      hourlyUsed: rateLimit.count,
      hourlyLimit: user.limits.hourly,
      dailyLimit: user.limits.daily,
      createdAt: user.createdAt
    });

    if (usage) {
      stats.todayRequests += usage.totalRequests;
    }
  }

  return stats;
}

module.exports = {
  getUser,
  createUser,
  updateUser,
  deleteUser,
  getAllUsers,
  logRequest,
  getUserUsage,
  getUserUsageRange,
  getRateLimit,
  incrementRateLimit,
  getAdminStats
};
```

### Migrate Existing Users

**File:** `scripts/migrate-users.js`

```javascript
const fs = require('fs');
const db = require('../services/database');

async function migrateUsers() {
  console.log('Starting user migration...');

  const jsonData = JSON.parse(fs.readFileSync('./data/users.json', 'utf8'));

  for (const user of jsonData.users) {
    await db.createUser(user.email, user.limits);
    console.log(`Migrated: ${user.email}`);
  }

  console.log('Migration complete!');
}

migrateUsers().catch(console.error);
```

Run migration:
```bash
node scripts/migrate-users.js
```

---

## PART 2: Update Middleware to Use Database

### Update Auth Middleware

**File:** `middleware/auth.js`

Replace the JSON file reading with database calls:

```javascript
const db = require('../services/database');

async function authenticateUser(req, res, next) {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({
      success: false,
      error: 'INVALID_REQUEST',
      message: 'Email is required'
    });
  }

  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({
      success: false,
      error: 'INVALID_EMAIL',
      message: 'Invalid email format'
    });
  }

  // Check if user exists in database
  const user = await db.getUser(email);

  if (!user || user.status !== 'active') {
    return res.status(403).json({
      success: false,
      error: 'USER_NOT_AUTHORIZED',
      message: 'This email is not authorized to use the service.'
    });
  }

  // Attach user to request
  req.user = user;
  next();
}

module.exports = authenticateUser;
```

### Update Rate Limit Middleware

**File:** `middleware/rateLimit.js`

Replace in-memory tracking with database:

```javascript
const db = require('../services/database');

async function checkRateLimit(req, res, next) {
  const { email } = req.body;
  const user = req.user;

  // Get current rate limit
  const rateLimit = await db.getRateLimit(email);

  // Get today's usage
  const today = new Date().toISOString().split('T')[0];
  const usage = await db.getUserUsage(email, today);
  const dailyCount = usage?.totalRequests || 0;

  // Check hourly limit
  if (rateLimit.count >= user.limits.hourly) {
    return res.status(429).json({
      success: false,
      error: 'RATE_LIMIT_EXCEEDED',
      message: `You've exceeded your hourly limit of ${user.limits.hourly} requests.`,
      retryAfter: 3600,
      limits: {
        hourly: {
          limit: user.limits.hourly,
          remaining: 0,
          resetsAt: rateLimit.resetAt
        },
        daily: {
          limit: user.limits.daily,
          remaining: Math.max(0, user.limits.daily - dailyCount),
          resetsAt: new Date().toISOString().split('T')[0] + 'T23:59:59Z'
        }
      }
    });
  }

  // Check daily limit
  if (dailyCount >= user.limits.daily) {
    return res.status(429).json({
      success: false,
      error: 'RATE_LIMIT_EXCEEDED',
      message: `You've exceeded your daily limit of ${user.limits.daily} requests.`,
      retryAfter: 86400,
      limits: {
        hourly: {
          limit: user.limits.hourly,
          remaining: user.limits.hourly - rateLimit.count,
          resetsAt: rateLimit.resetAt
        },
        daily: {
          limit: user.limits.daily,
          remaining: 0,
          resetsAt: new Date().toISOString().split('T')[0] + 'T23:59:59Z'
        }
      }
    });
  }

  // Increment rate limit
  await db.incrementRateLimit(email);

  // Attach limits to request for response
  req.rateLimits = {
    hourly: {
      limit: user.limits.hourly,
      remaining: user.limits.hourly - rateLimit.count - 1
    },
    daily: {
      limit: user.limits.daily,
      remaining: user.limits.daily - dailyCount - 1
    }
  };

  next();
}

module.exports = checkRateLimit;
```

### Update Routes to Log Usage

**File:** `routes/api.js`

Add usage logging to each endpoint:

```javascript
const db = require('../services/database');

router.post('/generate-subjects', authenticateUser, checkRateLimit, async (req, res) => {
  const startTime = Date.now();

  try {
    // ... existing OpenAI logic ...

    const responseTime = Date.now() - startTime;

    // Log successful request
    await db.logRequest(
      req.user.email,
      '/api/generate-subjects',
      true,
      responseTime
    );

    res.json({
      success: true,
      subjects: result.subjects,
      usage: {
        requestsRemaining: req.rateLimits.hourly.remaining,
        hourlyLimit: req.rateLimits.hourly.limit,
        dailyRemaining: req.rateLimits.daily.remaining,
        dailyLimit: req.rateLimits.daily.limit
      }
    });

  } catch (error) {
    const responseTime = Date.now() - startTime;

    // Log failed request
    await db.logRequest(
      req.user.email,
      '/api/generate-subjects',
      false,
      responseTime
    );

    // ... error handling ...
  }
});
```

---

## PART 3: Admin Dashboard

### Create Admin Routes

**File:** `routes/admin.js`

```javascript
const express = require('express');
const router = express.Router();
const db = require('../services/database');

// Admin authentication middleware
function requireAdmin(req, res, next) {
  const adminKey = req.headers['x-admin-key'];

  if (adminKey !== process.env.ADMIN_KEY) {
    return res.status(403).json({
      error: 'Forbidden',
      message: 'Invalid admin credentials'
    });
  }

  next();
}

// Get admin stats
router.get('/stats', requireAdmin, async (req, res) => {
  try {
    const stats = await db.getAdminStats();
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get all users
router.get('/users', requireAdmin, async (req, res) => {
  try {
    const users = await db.getAllUsers();
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get user details
router.get('/users/:email', requireAdmin, async (req, res) => {
  try {
    const user = await db.getUser(req.params.email);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Get recent usage
    const today = new Date().toISOString().split('T')[0];
    const usage = await db.getUserUsage(req.params.email, today);
    const rateLimit = await db.getRateLimit(req.params.email);

    res.json({
      user,
      usage,
      rateLimit
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create user
router.post('/users', requireAdmin, async (req, res) => {
  try {
    const { email, limits } = req.body;
    const user = await db.createUser(email, limits);
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update user
router.put('/users/:email', requireAdmin, async (req, res) => {
  try {
    const user = await db.updateUser(req.params.email, req.body);
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete user
router.delete('/users/:email', requireAdmin, async (req, res) => {
  try {
    await db.deleteUser(req.params.email);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
```

### Create Admin Dashboard HTML

**File:** `public/admin.html`

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Smart.pr Helper - Admin Dashboard</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }

    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background: #f5f5f5;
      padding: 20px;
    }

    .container {
      max-width: 1400px;
      margin: 0 auto;
    }

    header {
      background: white;
      padding: 20px;
      border-radius: 8px;
      margin-bottom: 20px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    }

    h1 {
      font-size: 24px;
      color: #0a313c;
      margin-bottom: 8px;
    }

    .stats {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 16px;
      margin-bottom: 20px;
    }

    .stat-card {
      background: white;
      padding: 20px;
      border-radius: 8px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    }

    .stat-label {
      font-size: 12px;
      color: #666;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 8px;
    }

    .stat-value {
      font-size: 32px;
      font-weight: 600;
      color: #0a313c;
    }

    .users-table {
      background: white;
      border-radius: 8px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
      overflow: hidden;
    }

    table {
      width: 100%;
      border-collapse: collapse;
    }

    th {
      background: #f9fafb;
      padding: 12px 16px;
      text-align: left;
      font-size: 12px;
      font-weight: 600;
      color: #666;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      border-bottom: 2px solid #e5e7eb;
    }

    td {
      padding: 12px 16px;
      border-bottom: 1px solid #e5e7eb;
    }

    tr:hover {
      background: #f9fafb;
    }

    .status {
      display: inline-block;
      padding: 4px 8px;
      border-radius: 4px;
      font-size: 12px;
      font-weight: 500;
    }

    .status-active {
      background: #d1fae5;
      color: #065f46;
    }

    .status-inactive {
      background: #fee2e2;
      color: #991b1b;
    }

    .progress-bar {
      width: 100px;
      height: 8px;
      background: #e5e7eb;
      border-radius: 4px;
      overflow: hidden;
    }

    .progress-fill {
      height: 100%;
      background: #3b82f6;
      transition: width 0.3s;
    }

    .progress-fill.warning {
      background: #f59e0b;
    }

    .progress-fill.danger {
      background: #ef4444;
    }

    .btn {
      padding: 8px 16px;
      border-radius: 6px;
      border: none;
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s;
    }

    .btn-primary {
      background: #3b82f6;
      color: white;
    }

    .btn-primary:hover {
      background: #2563eb;
    }

    .btn-danger {
      background: #ef4444;
      color: white;
    }

    .btn-danger:hover {
      background: #dc2626;
    }

    .error {
      background: #fee2e2;
      color: #991b1b;
      padding: 12px;
      border-radius: 6px;
      margin-bottom: 20px;
    }

    #loginForm {
      max-width: 400px;
      margin: 100px auto;
      background: white;
      padding: 32px;
      border-radius: 8px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    }

    input[type="password"] {
      width: 100%;
      padding: 10px;
      border: 1px solid #e5e7eb;
      border-radius: 6px;
      font-size: 14px;
      margin: 12px 0;
    }
  </style>
</head>
<body>
  <div id="loginForm">
    <h1>Admin Login</h1>
    <p style="color: #666; margin: 8px 0 16px;">Enter admin key to access dashboard</p>
    <input type="password" id="adminKey" placeholder="Admin Key" />
    <button class="btn btn-primary" onclick="login()" style="width: 100%;">Login</button>
    <div id="loginError" class="error" style="display: none; margin-top: 16px;"></div>
  </div>

  <div id="dashboard" style="display: none;">
    <div class="container">
      <header>
        <h1>Smart.pr Helper Admin Dashboard</h1>
        <p style="color: #666;">Monitor usage and manage users</p>
      </header>

      <div class="stats">
        <div class="stat-card">
          <div class="stat-label">Total Users</div>
          <div class="stat-value" id="totalUsers">-</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Active Users</div>
          <div class="stat-value" id="activeUsers">-</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Today's Requests</div>
          <div class="stat-value" id="todayRequests">-</div>
        </div>
      </div>

      <div class="users-table">
        <table>
          <thead>
            <tr>
              <th>Email</th>
              <th>Status</th>
              <th>Today's Requests</th>
              <th>Hourly Usage</th>
              <th>Daily Limit</th>
              <th>Created</th>
            </tr>
          </thead>
          <tbody id="usersTableBody">
            <tr>
              <td colspan="6" style="text-align: center; padding: 40px;">Loading...</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>

  <script>
    let adminKey = '';

    function login() {
      adminKey = document.getElementById('adminKey').value;
      if (!adminKey) {
        showLoginError('Please enter admin key');
        return;
      }

      loadDashboard();
    }

    function showLoginError(message) {
      const errorDiv = document.getElementById('loginError');
      errorDiv.textContent = message;
      errorDiv.style.display = 'block';
    }

    async function loadDashboard() {
      try {
        const response = await fetch('/admin/stats', {
          headers: { 'x-admin-key': adminKey }
        });

        if (response.status === 403) {
          showLoginError('Invalid admin key');
          return;
        }

        const stats = await response.json();

        // Show dashboard
        document.getElementById('loginForm').style.display = 'none';
        document.getElementById('dashboard').style.display = 'block';

        // Update stats
        document.getElementById('totalUsers').textContent = stats.totalUsers;
        document.getElementById('activeUsers').textContent = stats.activeUsers;
        document.getElementById('todayRequests').textContent = stats.todayRequests;

        // Populate users table
        const tbody = document.getElementById('usersTableBody');
        tbody.innerHTML = '';

        stats.userStats.forEach(user => {
          const row = document.createElement('tr');

          const hourlyPercent = (user.hourlyUsed / user.hourlyLimit) * 100;
          let progressClass = '';
          if (hourlyPercent > 80) progressClass = 'danger';
          else if (hourlyPercent > 60) progressClass = 'warning';

          row.innerHTML = `
            <td>${user.email}</td>
            <td><span class="status status-${user.status}">${user.status}</span></td>
            <td>${user.todayRequests}</td>
            <td>
              <div style="display: flex; align-items: center; gap: 8px;">
                <div class="progress-bar">
                  <div class="progress-fill ${progressClass}" style="width: ${hourlyPercent}%"></div>
                </div>
                <span style="font-size: 12px; color: #666;">${user.hourlyUsed}/${user.hourlyLimit}</span>
              </div>
            </td>
            <td>${user.dailyLimit}</td>
            <td style="font-size: 12px; color: #666;">${new Date(user.createdAt).toLocaleDateString()}</td>
          `;

          tbody.appendChild(row);
        });

        // Refresh every 30 seconds
        setTimeout(loadDashboard, 30000);

      } catch (error) {
        showLoginError('Failed to load dashboard: ' + error.message);
      }
    }
  </script>
</body>
</html>
```

### Update Server.js

Add admin routes:

```javascript
const adminRoutes = require('./routes/admin');

// Serve admin dashboard
app.use(express.static('public'));

// Admin routes
app.use('/admin', adminRoutes);
```

---

## PART 4: Environment Variables

Add to `.env`:

```env
# Admin Dashboard
ADMIN_KEY=your-secure-admin-key-here
```

Generate a secure admin key:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

## Testing

### Test Database Operations

```bash
# Create a user
curl -X POST http://localhost:3000/admin/users \
  -H "x-admin-key: YOUR_ADMIN_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "newuser@smart.pr",
    "limits": { "hourly": 50, "daily": 200 }
  }'

# Get all users
curl http://localhost:3000/admin/users \
  -H "x-admin-key: YOUR_ADMIN_KEY"

# Get stats
curl http://localhost:3000/admin/stats \
  -H "x-admin-key: YOUR_ADMIN_KEY"
```

### Test Admin Dashboard

1. Visit `https://YOUR-APP.repl.co/admin.html`
2. Enter admin key
3. View statistics and users

---

## Success Criteria

✅ Replit Database integrated
✅ Users migrated from JSON to database
✅ All API endpoints use database
✅ Usage logging working
✅ Rate limiting uses database
✅ Admin dashboard accessible
✅ Admin can view all users
✅ Admin can see usage per user
✅ Real-time stats updating
✅ Secure admin authentication

---

## Deployment Notes

1. Run migration script to move existing users to database
2. Test all endpoints still work
3. Verify admin dashboard loads
4. Keep `data/users.json` as backup for 1 week
5. Monitor logs for any database errors

---

## Future Enhancements

After this is working, consider:
- Add user creation form in admin dashboard
- Export usage data to CSV
- Usage charts/graphs
- Email notifications for rate limit hits
- Bulk user import
- User search/filter in dashboard

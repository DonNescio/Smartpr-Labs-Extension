# API Configuration

## ✅ API URL Configured

The API is now connected to the deployed Replit server:

```javascript
const API_BASE_URL = 'https://smarthelper.replit.app/api';
```

**Primary URL:** https://smarthelper.replit.app

### Steps to Configure

1. **Deploy the Replit API server** (using the prompt in `docs/replit-agent-prompt.md`)

2. **Get your Replit app URL**
   - After deployment, Replit will provide a URL like: `https://smartpr-helper-api.replit.app`

3. **Update api-client.js**
   - Open `smartpr-helper-v2/api-client.js`
   - Find line 6: `const API_BASE_URL = 'https://YOUR-REPLIT-APP.repl.co/api';`
   - Replace with your actual URL: `const API_BASE_URL = 'https://smartpr-helper-api.replit.app/api';`

4. **Test the connection**
   - Load the extension in Chrome
   - Enter your email in settings
   - Try generating subject lines
   - Check browser console for any errors

## Test Users Available

The Replit API has two pre-configured test users:

1. **test@smart.pr**
   - Hourly limit: 50 requests
   - Daily limit: 200 requests

2. **demo@smart.pr**
   - Hourly limit: 100 requests
   - Daily limit: 500 requests

Use either of these emails to test the extension!

### Testing Endpoints

You can test the API endpoints directly:

```bash
# Health check
curl https://smarthelper.replit.app/health

# Validate user
curl -X POST https://smarthelper.replit.app/api/validate-user \
  -H "Content-Type: application/json" \
  -d '{"email":"test@smart.pr"}'

# Generate subjects
curl -X POST https://smarthelper.replit.app/api/generate-subjects \
  -H "Content-Type: application/json" \
  -d '{
    "email":"test@smart.pr",
    "prompt":"Generate subject lines for: New product launch",
    "context":{}
  }'
```

### CORS Configuration

Make sure the Replit API server has CORS configured to allow requests from the Chrome extension:

```javascript
// In Replit server.js
app.use(cors({
  origin: '*', // Allow all origins initially
  // Later, restrict to: 'chrome-extension://YOUR-EXTENSION-ID'
  methods: ['POST', 'GET', 'OPTIONS'],
  allowedHeaders: ['Content-Type'],
  credentials: true
}));
```

### Extension ID (Optional)

If you want to restrict CORS to only your extension:

1. Load the extension in Chrome
2. Go to `chrome://extensions/`
3. Find your extension's ID (e.g., `abcdefghijklmnopqrstuvwxyz123456`)
4. Update Replit's CORS config to: `origin: 'chrome-extension://abcdefghijklmnopqrstuvwxyz123456'`

### Troubleshooting

**"Connection failed" error:**
- Check that Replit app is running (visit the health endpoint in browser)
- Verify API_BASE_URL is correct in api-client.js
- Check browser console for CORS errors

**"User not authorized" error:**
- Verify your email is added to `data/users.json` on Replit
- Check that email in settings matches exactly (case-sensitive)

**"Rate limit exceeded" error:**
- This is expected behavior - wait for the reset time
- Check Replit logs to see current rate limit status

### Development vs Production

**Development:**
- Use `*` for CORS origin (allows testing from any source)
- Use test emails like `test@smart.pr`

**Production:**
- Restrict CORS to specific extension ID
- Add real Smart.pr team emails to users.json
- Set appropriate rate limits

---

## Checklist Before Going Live

- [ ] Replit API deployed and running
- [ ] API_BASE_URL updated in api-client.js
- [ ] Test email added to Replit users.json
- [ ] Tested subject generation successfully
- [ ] Tested feedback generation successfully
- [ ] CORS configured (wildcard for now, specific ID later)
- [ ] Error messages display correctly
- [ ] Rate limiting works as expected
- [ ] Real team emails added to Replit users.json

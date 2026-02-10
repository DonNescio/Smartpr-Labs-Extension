# Testing Guide

## 🎉 Ready to Test!

The Chrome extension is now fully configured and connected to the Replit API.

## Quick Start Testing

### 1. Load the Extension

1. Open Chrome and go to `chrome://extensions/`
2. Enable "Developer mode" (toggle in top-right)
3. Click "Load unpacked"
4. Select the `smartpr-helper-v2` folder
5. Extension should load without errors

### 2. Configure Your Email

1. Click the extension icon in Chrome toolbar
2. Click "Open Settings"
3. Enter one of the test emails:
   - `test@smart.pr` (50/hour, 200/day)
   - `demo@smart.pr` (100/hour, 500/day)
4. Click "Save Settings"
5. Should see "✓ Email saved successfully!"

### 3. Test on Smart.pr

1. Visit any Smart.pr page (e.g., https://smart.pr)
2. Look for the floating icon (logo) in bottom-right corner
3. Click the icon - sidebar should slide in from right
4. Try the features:

**Test Subject Generation (Empty Field):**
1. In the sidebar, enter a press release description:
   - "We're launching a new eco-friendly product line that reduces plastic waste by 80%"
2. Click "Generate Subject Lines"
3. Should see 3-5 AI-generated suggestions
4. Click "Copy" on any suggestion
5. Should see toast: "✓ Copied to clipboard"

**Test Subject Feedback (Existing Subject):**
1. If there's a subject field on the page, enter some text
2. Click the floating icon
3. Click "Get Feedback"
4. Should see AI-generated feedback

## Expected Behavior

### ✅ Success States

**Settings Page:**
- Email input accepts valid emails
- Invalid emails show error: "Please enter a valid email address"
- Save button shows "Saving..." then "Saved!"
- Success message: "✓ Email saved successfully!"

**Popup:**
- Shows: "✓ Ready to help! (test@smart.pr)"
- If no email: "⚠ Email not configured"

**Floating Icon:**
- Appears in bottom-right (100px from bottom, 24px from right)
- White logo on gradient background
- Hover: scales up slightly
- Click: opens sidebar

**Sidebar:**
- Slides in from right smoothly
- Shows "Subject Line Helper" title in Gelica font
- Icon rotates 180° when sidebar open
- Icon changes to cool gradient when open

**Subject Generation:**
- Shows loading spinner
- Returns 3-5 suggestions
- Each suggestion has "Copy" button
- Suggestions are contextual to input
- Toast shows "✨ Suggestions generated!"

**Subject Feedback:**
- Shows loading spinner
- Returns constructive feedback
- Shows current subject
- Has "Generate Better Alternatives" button

### ❌ Error States to Test

**No Email Configured:**
1. Clear email from settings
2. Try to generate subjects
3. Should show: "Please enter your email address in the extension settings."
4. Should show "Open Settings" button
5. Clicking button opens settings page

**Invalid Email:**
1. Enter "notanemail" in settings
2. Try to save
3. Should show: "Please enter a valid email address"

**Unauthorized Email:**
1. Enter "unauthorized@example.com" in settings
2. Save it
3. Try to generate subjects
4. Should show: "Please enter your Smart.pr email address in the extension settings."
5. Should show "Open Settings" button

**Rate Limit (Hard to Test):**
- Would require 51+ requests in an hour
- Error message: "You've reached your usage limit. Please try again later."
- Shows retry info

**Network Error:**
1. Disconnect internet
2. Try to generate subjects
3. Should show: "Connection failed. Please check your internet connection."

## Browser Console Checks

Open Chrome DevTools (F12) and check console for:

**Expected Logs:**
```
[Smart.pr Helper] Initializing...
[Smart.pr Helper] Subject field found
```

**No Errors Should Appear Like:**
- ❌ CORS errors
- ❌ Failed to fetch
- ❌ Undefined window.SmartPRAPI
- ❌ JSON parse errors

## API Endpoint Testing

You can also test the API directly:

### Health Check
```bash
curl https://smarthelper.replit.app/health
```
Expected: `{"status":"healthy","timestamp":"..."}`

### Validate User
```bash
curl -X POST https://smarthelper.replit.app/api/validate-user \
  -H "Content-Type: application/json" \
  -d '{"email":"test@smart.pr"}'
```
Expected: `{"valid":true,"status":"active","limits":{...}}`

### Generate Subjects
```bash
curl -X POST https://smarthelper.replit.app/api/generate-subjects \
  -H "Content-Type: application/json" \
  -d '{
    "email":"test@smart.pr",
    "prompt":"Generate subject lines for: New product launch",
    "context":{}
  }'
```
Expected: `{"success":true,"subjects":[...], "usage":{...}}`

## Troubleshooting

### Issue: "Connection failed"
**Solutions:**
- Check Replit app is running: Visit https://smarthelper.replit.app/health
- Check browser console for CORS errors
- Verify API_BASE_URL in api-client.js is correct

### Issue: "User not authorized"
**Solutions:**
- Verify email in settings is exactly `test@smart.pr` or `demo@smart.pr`
- Check for typos (case-sensitive)
- Try clearing extension storage and re-entering email

### Issue: Extension not loading
**Solutions:**
- Check manifest.json for syntax errors
- Look for errors in `chrome://extensions/`
- Try removing and re-adding extension
- Check all files are present in folder

### Issue: API client not found
**Solutions:**
- Verify api-client.js is in the folder
- Check manifest.json includes: `"js": ["api-client.js", "content.js"]`
- Reload extension after changes

### Issue: Sidebar not appearing
**Solutions:**
- Check if floating icon appears first
- Look for console errors
- Verify styles.css is loading
- Try clicking floating icon vs nudge

### Issue: Font not displaying (Gelica)
**Solutions:**
- Verify fonts/gelica/*.otf files exist
- Check web_accessible_resources in manifest.json
- Look for font loading errors in console

## Performance Checks

### Load Time
- Extension should initialize in < 1 second
- Sidebar should open/close smoothly
- No janky animations

### API Response Time
- Subject generation: 2-5 seconds typical
- Feedback generation: 2-4 seconds typical
- If slower, check Replit server logs

### Memory Usage
- Check Chrome Task Manager (Shift+Esc)
- Extension should use < 50MB RAM
- No memory leaks on repeated use

## Security Checks

### What Should NOT Be Visible:
- ❌ OpenAI API key anywhere in browser
- ❌ API key in network requests
- ❌ API key in console logs
- ❌ API key in extension storage

### What SHOULD Be Visible:
- ✅ User email in extension popup
- ✅ User email in settings
- ✅ User email in storage (chrome.storage.sync)
- ✅ API requests to smarthelper.replit.app

## Production Readiness Checklist

Before deploying to real users:

- [ ] All test scenarios pass
- [ ] No console errors
- [ ] API responses are fast
- [ ] Error messages are user-friendly
- [ ] Settings save correctly
- [ ] Popup shows correct status
- [ ] Floating icon appears on Smart.pr pages
- [ ] Subject generation works
- [ ] Feedback generation works
- [ ] Copy to clipboard works
- [ ] Rate limiting displays helpful message
- [ ] CORS is configured (currently allows all origins)
- [ ] Real Smart.pr team emails added to Replit
- [ ] Extension tested on multiple Smart.pr pages
- [ ] Tested with slow network
- [ ] Tested with network offline
- [ ] Memory leaks checked
- [ ] Multiple users tested

## Next Steps After Testing

1. **Add Real Users**: Update `data/users.json` on Replit with actual Smart.pr team emails
2. **Restrict CORS**: Update Replit to allow only your extension ID
3. **Monitor Usage**: Check Replit logs for any issues
4. **Gather Feedback**: Have team try it and report issues
5. **Iterate**: Fix bugs and improve UX based on feedback

## Support

If you encounter issues:
1. Check browser console for errors
2. Check Replit logs: https://smarthelper.replit.app
3. Verify API is responding: `curl https://smarthelper.replit.app/health`
4. Test API endpoints directly with curl
5. Check email is in users.json on Replit

---

Happy testing! 🚀

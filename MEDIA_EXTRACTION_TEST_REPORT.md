# Media Extraction Test Report

**Generated:** 2026-01-17T06:20:29.669Z
**Test URL:** https://www.tiktok.com/@BetterHelp/video/7495811174135581959?is_from_webapp=1&sender_device=pc
**App URL:** http://localhost:3000

## Summary

| Metric | Count |
|--------|-------|
| Total Tests | 6 |
| ✅ Passed | 3 |
| ❌ Failed | 3 |
| ⏭️  Skipped | 0 |

## Detailed Results

### 1. ✅ SERVER_CONNECTION

- **Status:** PASS
- **Message:** Server is accessible (status: 200)
- **Details:**
```json
{
  "status": 200,
  "url": "http://localhost:3000"
}
```
- **Duration:** 310ms

### 2. ✅ AUTHENTICATION

- **Status:** PASS
- **Message:** Successfully authenticated

### 3. ✅ SUBMIT_SUBTITLE

- **Status:** PASS
- **Message:** Task submitted successfully
- **Details:**
```json
{
  "taskId": "e23ca0ee-ea71-4e43-a146-a5d5f6999058",
  "outputType": "subtitle"
}
```
- **Duration:** 36348ms

### 4. ❌ SUBTITLE_EXTRACTION

- **Status:** FAIL
- **Message:** Extraction failed: Failed to fetch TikTok transcript: Both APIs failed. Free: Free API failed: NO_TRANSCRIPT, Paid: HTTP 404: Not Found
- **Details:**
```json
{
  "status": "failed",
  "error": "Failed to fetch TikTok transcript: Both APIs failed. Free: Free API failed: NO_TRANSCRIPT, Paid: HTTP 404: Not Found",
  "progress": 0
}
```

### 5. ❌ SUBMIT_VIDEO

- **Status:** FAIL
- **Message:** Please sign in to continue.
- **Details:**
```json
{
  "code": -1,
  "status": 200
}
```
- **Duration:** 7638ms

### 6. ❌ VIDEO_EXTRACTION

- **Status:** FAIL
- **Message:** Task submission failed


# IDS Project: Cleanup & Dead Code Analysis

## Overview
This document identifies unnecessary code, technical debt, and structural issues that should be removed or refactored to improve maintainability and reduce codebase complexity.

---

## 1. **Duplicate Utility Functions Across Modules**

### Issue
The functions `json()`, `escapeHtml()`, and `readJsonBody()` are replicated across multiple files without being centralized.

**Locations:**
- `admin/src/server.js` - lines 73-93 (json), 99-106 (sendValidationError)
- `player/src/server.js` - lines 282-290 (json), 300-307 (escapeHtml), 309-324 (readJsonBody)

**Impact:** Medium - Code duplication makes maintenance harder and inconsistency risks.

### Recommended Action
**Create a shared utility module** at `shared/utils/http-helpers.js`:
```javascript
// shared/utils/http-helpers.js
function json(res, code, obj) {
  const body = JSON.stringify(obj, null, 2);
  res.writeHead(code, {
    "Content-Type": "application/json",
    "Content-Length": Buffer.byteLength(body),
  });
  res.end(body);
}

function escapeHtml(input) {
  return String(input)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function readJsonBody(req, maxBytes = 100_000) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => {
      data += chunk;
      if (data.length > maxBytes) {
        req.destroy();
        reject(new Error("Body too large"));
      }
    });
    req.on("end", () => {
      try {
        resolve(JSON.parse(data || "{}"));
      } catch {
        reject(new Error("Invalid JSON"));
      }
    });
  });
}

module.exports = { json, escapeHtml, readJsonBody };
```

Then import in both `admin/src/server.js` and `player/src/server.js`:
```javascript
const { json, escapeHtml, readJsonBody } = require("../../../shared/utils/http-helpers.js");
```

**Effort:** Low | **Priority:** Medium

---

## 2. **Unused/Dead Functions**

### 2.1 - `resolveMimeByExtension()` in admin/src/server.js (line 235)
**Issue:** This function is defined but never called. The project uses `getExtFromMime()` instead for the opposite mapping.

**Code Location:** Lines 235-244 in `admin/src/server.js`
```javascript
function resolveMimeByExtension(filename) {
  // ... never invoked
}
```

**Recommendation:** Remove entirely.

**Effort:** Trivial | **Priority:** Low

### 2.2 - `text()` function in admin/src/server.js (line 93)
**Issue:** Defined but only used once in old code path, with no clear purpose.

**Code Location:** Lines 93-100 in `admin/src/server.js`

**Recommendation:** Check all usages; if truly unused, remove or consolidate with `json()`.

**Effort:** Low | **Priority:** Low

---

## 3. **Backward Compatibility Code That Can Be Removed**

### Issue
The codebase maintains backward compatibility with a legacy "campaigns array" config format that complicates the runtime model.

**Locations:**
- `player/src/server.js` - lines 20-63 in `normalizeRuntimeConfig()` function
- Config validation attempts to support both old and new formats

**Code Example (lines 43-63):**
```javascript
// Backward compatibility with old config examples.
if (Array.isArray(input.campaigns)) {
  const byId = new Map(input.campaigns.map((c) => [c.campaignId, { ...c, items: sortItems(c.items) }]));
  const idleCampaign = byId.get("idle-welcome") || input.campaigns[0] || null;
  const menuCampaign = byId.get("menu-choices") || null;
  const visitorCampaign = byId.get("info-visitor") || null;
  // ... more legacy handling
}
```

**Impact:** High - This adds ~20 lines of defensive code to handle deprecated format. All migrations should be completed before removing.

**Recommendation:**
1. Verify all existing configs have been migrated to new format (search for `config.*.json` files)
2. Update validation schema to reject old format explicitly with helpful error message
3. Remove entire backward-compatibility block from `normalizeRuntimeConfig()`
4. Update tests to ensure new format is only accepted

**Prerequisite:** Ensure no production configs use old format.

**Effort:** Medium | **Priority:** Medium (after migration verification)

---

## 4. **Unused Test Infrastructure**

### Issue
Test files exist but lack comprehensive coverage, and some utility functions in tests are not utilized.

**Locations:**
- `admin/test/` has only 2 test files
- `player/test/` has only 1 test file
- No E2E tests despite having two services that communicate

**Current Coverage:**
- Admin: storage validation, media upload validation
- Player: state machine flow tests
- Missing: API endpoint tests, integration tests, edge cases

**Recommendation:** While not "dead code" per se, the test infrastructure could be expanded. Consider:
1. Add API endpoint tests for both admin and player
2. Add integration tests between admin config changes and player runtime updates
3. Mock HTTP responses to test error handling

**Effort:** Medium | **Priority:** Low-Medium

---

## 5. **Unused Environment Variables & Configuration**

### Issue
Several environment variables are defined but inconsistently used or never checked:

**Locations:**
- `admin/src/server.js` - `IDS_PUBLIC_ADMIN_URL` is used, but fallback logic is convoluted
- `player/src/index.js` - Multiple env var checks that could be consolidated
- `.env.example` may contain unmaintained keys

**Code Example (admin/src/server.js, line 119):**
```javascript
const configured = process.env.IDS_PUBLIC_ADMIN_URL;
if (configured) {
  return `${configured.replace(/\/$/, "")}${pathname}`;
}
```

**Recommendation:**
1. Document all expected environment variables in `README.md`
2. Create a central config file: `shared/config/env-schema.js` that validates required vs optional vars
3. Consolidate env var reading into one place per service
4. Remove unused env checks

**Effort:** Low | **Priority:** Low

---

## 6. **Overly Complex Multipart Parser**

### Issue
The multipart form parser in `admin/src/server.js` (lines 143-199) is hand-written and fragile.

**Code Location:** `parseMultipartFile()` function

**Problems:**
- Regex-based boundary detection is brittle
- Manual string splitting on `\r\n` is error-prone
- No support for edge cases (missing headers, malformed multipart)
- Could be replaced by a battle-tested library

**Recommendation:**
Consider using `busboy` or `formidable` npm packages for robust multipart handling:
```javascript
const busboy = require('busboy');

// In route handler:
const bb = busboy({ headers: req.headers });
bb.on('file', (fieldname, file, info) => {
  // Handle file stream safely
});
```

**Tradeoff:** Adds dependency but significantly improves robustness.

**Effort:** Medium | **Priority:** Medium

---

## 7. **Unused Mock/Demo Data in Default State**

### Issue
The default state in `storage.js` includes hardcoded demo student with NFC UID "demo-uid-001" that clutters production data.

**Code Location:** `admin/src/storage.js`, lines 103-149

**Example:**
```javascript
{
  nfcUid: "demo-uid-001",
  name: "Demo Student",
  campaign: { /* ... */ }
}
```

**Recommendation:**
1. Keep demo data for tests/examples only
2. Initialize production states with empty `students: []`
3. Create separate demo seed function: `seedDemoState()` for development

**Effort:** Low | **Priority:** Low

---

## 8. **Redundant HTML Rendering in Admin Server**

### Issue
The entire admin UI HTML is embedded as a long string literal in `server.js` (lines 245-1408).

**Location:** `renderAdminPage()` function - 1100+ lines of HTML/CSS/JavaScript

**Problems:**
- Makes file extremely long (1408 lines) and hard to navigate
- CSS should be separate for maintenance
- JavaScript UI logic is intertwined with HTTP server logic
- No syntax highlighting in IDE for embedded HTML/CSS/JS

**Recommendation:**
Extract to separate files:
```
admin/public/
  ├── index.html       (HTML structure only)
  ├── styles.css       (All CSS currently in renderAdminPage)
  └── app.js           (Already exists, but server.js still renders it inline)
```

Then serve static files instead of rendering as string:
```javascript
// In admin/src/server.js route handler:
if (req.url === "/" || req.url === "/index.html") {
  const html = fs.readFileSync(path.join(__dirname, "../public/index.html"), "utf8");
  res.writeHead(200, { "Content-Type": "text/html" });
  res.end(html);
}
```

**Effort:** Medium | **Priority:** Medium

---

## 9. **Inconsistent Error Handling**

### Issue
Error handling varies across modules with no consistent pattern:

**Locations:**
- Admin catches errors and sends validation responses
- Player has some try-catch blocks but inconsistent
- No logging of errors (they just 500 without details)

**Examples:**
- `admin/src/server.js` - uses `sendValidationError()` for some paths but generic JSON for others
- `player/src/server.js` - some routes have error handling, others don't

**Recommendation:**
1. Create centralized error handler middleware: `shared/middleware/error-handler.js`
2. Define error types: `ValidationError`, `NotFoundError`, `InternalError`
3. Log all errors with context (timestamp, path, user agent)
4. Consistent JSON error response format across all endpoints

**Effort:** Medium | **Priority:** Medium

---

## 10. **Missing Input Validation on Some Routes**

### Issue
Not all routes validate incoming data; some rely on assumptions about client behavior.

**Examples:**
- Player `/events` endpoint doesn't strictly validate event schema
- Admin campaign endpoints may not validate all fields consistently

**Recommendation:**
1. Create validation middleware using a schema library (Zod, Joi, or custom)
2. Apply to all POST/PATCH/PUT routes
3. Ensure all external input is validated before processing

**Effort:** Medium | **Priority:** High

---

## Summary of Recommended Cleanups

| Issue | Effort | Priority | Estimated LOC to Remove |
|-------|--------|----------|------------------------|
| Duplicate utility functions | Low | Medium | ~100 |
| Unused `resolveMimeByExtension()` | Trivial | Low | ~10 |
| Unused `text()` function | Low | Low | ~8 |
| Backward compatibility code | Medium | Medium | ~25 |
| Unused demo data | Low | Low | ~40 |
| Embedded HTML in server | Medium | Medium | Extract 1100+ |
| Multipart parser cleanup | Medium | Medium | ~60 |
| **Total estimated cleanup** | — | — | **~1300+ LOC** |

---

## Implementation Order (Recommended Phases)

**Phase 1 (Quick Wins - 1-2 hours):**
- Remove `resolveMimeByExtension()`
- Remove `text()` function
- Remove demo student from default state
- Consolidate duplicate utility functions

**Phase 2 (Medium Effort - 3-4 hours):**
- Extract embedded admin HTML to static files
- Centralize error handling
- Consider multipart parser upgrade

**Phase 3 (Post-Migration):**
- Remove backward compatibility code (after all configs migrated)
- Add comprehensive input validation


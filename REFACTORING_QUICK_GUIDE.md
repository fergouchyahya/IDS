# IDS Refactoring - Quick Reference Guide

**Use this as a quick lookup while working through the refactoring plan.**

---

## Phase Quick Links

### Phase 1: Foundation (Week 1-2)
**Focus:** Infrastructure & patterns

**Key Files to Create:**
```
shared/utils/logger.js          → Enhanced logging
shared/config/index.js          → Config management
shared/errors/index.js          → Custom errors
shared/validation/index.js      → Input validation
shared/middleware/error-handler.js
shared/middleware/request-logger.js
CODING_STANDARDS.md
docs/adr/001-architecture.md
```

**Checklist:**
- [ ] Logger has debug, info, warn, error, metric methods
- [ ] Config validates all environment variables
- [ ] Error classes: ValidationError, NotFoundError, InternalError
- [ ] Validation helpers for campaigns, events, files
- [ ] CODING_STANDARDS.md written
- [ ] All services updated to use new infrastructure

---

### Phase 2: Admin Refactor (Week 2-3)
**Focus:** Break apart admin monolith

**Directory Structure:**
```
admin/src/
├── index.js
├── server.js         (HTTP server, ~80 LOC)
├── router.js         (Route dispatcher)
├── config.js
├── middleware/       (3-4 files)
├── handlers/         (5-6 handler files)
├── services/         (5-6 service files)
├── utils/            (3-4 utility files)
└── storage.js
```

**Order of Refactoring:**
1. Extract middleware (error-handler, logger, validation)
2. Create router to replace inline route handling
3. Extract handlers (campaigns, media, settings, students, health)
4. Extract services (CampaignService, MediaService, etc.)
5. Rewrite server.js to be simple HTTP setup
6. Test each step

**Key Insight:**
```
OLD: server.js has all logic inline
NEW: server.js → router → handlers → services → storage
```

---

### Phase 3: Player Refactor (Week 3-4)
**Focus:** Extract render + split concerns

**What's Moving:**
```
playerserver.js (1638 LOC) →
├── server.js (100 LOC)
├── router.js (150 LOC)
├── services/
│   ├── state-machine.js (200 LOC)
│   ├── render-service.js (800+ LOC)
│   ├── config-service.js
│   ├── detector-service.js
│   └── admin-sync-service.js
├── handlers/
│   ├── ui.js
│   ├── events.js
│   ├── current.js
│   ├── health.js
│   └── debug.js
└── utils/
    ├── event-validators.js
    └── state-utils.js
```

**Note:** state-machine.js already exists, just needs better documentation

---

### Phase 4: Admin UI (Week 4-5)
**Focus:** Component-based architecture

**Extract From:** `admin/public/admin-ui.js` (1665 LOC)

**Extract To:**
```
admin/public/
├── index.html              ← NEW (50 LOC, just structure)
├── styles.css              ← Extract CSS (~800 LOC)
├── app.js                  ← Main app logic (~200 LOC)
├── components/
│   ├── campaign-editor.js
│   ├── block-builder.js
│   ├── media-uploader.js
│   ├── student-manager.js
│   └── settings-panel.js
├── services/
│   ├── api-client.js
│   ├── state-manager.js
│   └── ui-helpers.js
└── utils/
    └── validators.js
```

**Pattern for Each Component:**
```javascript
const ComponentName = {
  init(options) { /* setup */ },
  render() { /* create HTML */ },
  bind() { /* attach listeners */ },
  update(state) { /* refresh */ },
  destroy() { /* cleanup */ }
};
```

---

### Phase 5: Documentation (Week 5)
**Focus:** Codify practices

**Files to Create:**
```
CODING_STANDARDS.md          (Already planned)
docs/
├── adr/                     (Architecture Decisions)
│   ├── 001-modular-architecture.md
│   ├── 002-jsdoc-over-ts.md
│   ├── 003-error-handling.md
│   ├── 004-logging-strategy.md
│   └── 005-testing-approach.md
├── api/                     (API Reference)
│   ├── admin-api.md
│   └── player-api.md
├── development/
│   ├── setup.md
│   ├── adding-feature.md
│   ├── debugging.md
│   └── performance.md
└── deployment/
    └── raspberry-pi.md
```

---

## Common Patterns

### JSDoc Template - Function
```javascript
/**
 * Brief one-liner description
 * 
 * Longer explanation if needed, describing:
 * - What the function does
 * - When to use it
 * - Any side effects
 * 
 * @param {type} paramName - Description
 * @param {string} paramName.property - Nested property
 * @returns {type} What is returned
 * @throws {ErrorType} When this happens
 * 
 * @example
 * const result = myFunction('value');
 * console.log(result);
 */
function myFunction(paramName) {
  // Implementation
}
```

### JSDoc Template - Class
```javascript
/**
 * Brief class description
 * 
 * Detailed explanation of what this class does and its purpose.
 * 
 * @class ClassName
 * @example
 * const instance = new ClassName(options);
 * instance.method();
 */
class ClassName {
  /**
   * Constructor description
   * @param {object} options
   */
  constructor(options) {}

  /**
   * Method description
   * @returns {type}
   */
  method() {}
}
```

### JSDoc Template - Module
```javascript
/**
 * Module description - what this file does
 * 
 * Detailed explanation:
 * - Main responsibilities
 * - Key exports
 * - Usage examples
 * 
 * @module path/to/module
 * @example
 * const { functionName } = require('./module');
 */
```

### Error Pattern
```javascript
const { ValidationError, NotFoundError } = require('shared/errors');

async function handler(req, res) {
  try {
    // Validate input
    if (!data.name) {
      throw new ValidationError([
        { field: 'name', message: 'Name is required' }
      ]);
    }

    // Business logic
    const result = await service.create(data);

    // Success
    json(res, 201, result);
  } catch (error) {
    if (error instanceof ValidationError) {
      logger.warn('Validation failed', error, { path: req.url });
      return json(res, 400, { error: 'validation_failed', ...error });
    }

    logger.error('Handler error', error, { path: req.url, method: req.method });
    json(res, 500, { error: 'internal_error' });
  }
}
```

### Service Pattern
```javascript
/**
 * Business logic service
 * 
 * Responsibilities:
 * - Validate data
 * - Apply business rules
 * - Coordinate data access
 * - Log operations
 * 
 * Does NOT:
 * - Know about HTTP
 * - Know about UI
 * - Know about storage format
 */
class MyService {
  constructor(deps) {
    this.storage = deps.storage;
    this.logger = deps.logger;
  }

  /**
   * Create resource
   * @param {object} data - Input data
   * @returns {Promise<object>} Created resource
   */
  async create(data) {
    // 1. Validate
    this._validate(data);

    // 2. Apply business logic
    const resource = this._prepare(data);

    // 3. Persist
    const saved = await this.storage.save(resource);

    // 4. Log
    this.logger.info('Resource created', { id: saved.id });

    // 5. Return
    return saved;
  }

  /**
   * Validate data
   * @private
   * @throws {ValidationError}
   */
  _validate(data) {
    const issues = [];
    if (!data.name?.trim()) {
      issues.push({ field: 'name', message: 'Required' });
    }
    if (issues.length > 0) {
      throw new ValidationError(issues);
    }
  }

  /**
   * Prepare resource for storage
   * @private
   */
  _prepare(data) {
    return {
      id: generateId(),
      ...data,
      createdAt: new Date().toISOString()
    };
  }
}
```

### Handler Pattern
```javascript
/**
 * HTTP request handler
 * 
 * Responsibilities:
 * - Parse HTTP request
 * - Validate input
 * - Call service
 * - Format HTTP response
 * - Log request
 * 
 * Does NOT:
 * - Contain business logic
 * - Access storage directly
 */
async function handleCreate(req, res, { service }) {
  try {
    // 1. Parse input
    const data = await readJsonBody(req);

    // 2. Validate (at boundary)
    const { error, value } = validateCreateInput(data);
    if (error) {
      logger.warn('Invalid input', error);
      return json(res, 400, { error: 'validation_failed', issues: error.issues });
    }

    // 3. Call service
    const result = await service.create(value);

    // 4. Format response
    json(res, 201, result);
  } catch (error) {
    // 5. Error handling
    logger.error('Create failed', error);
    json(res, 500, { error: 'internal_error' });
  }
}

module.exports = { handleCreate };
```

### Middleware Pattern
```javascript
/**
 * Request middleware
 * 
 * Responsibilities:
 * - Extract data from request
 * - Add to context
 * - Pass to next handler
 */
function addCorrelationId(req, res, next) {
  req.correlationId = req.headers['x-correlation-id'] || generateId();
  res.setHeader('x-correlation-id', req.correlationId);
  next();
}

/**
 * Middleware chain in server
 */
const server = http.createServer((req, res) => {
  try {
    addCorrelationId(req, res, () => {
      requestLogger(req, res, () => {
        router.handle(req, res);
      });
    });
  } catch (error) {
    errorHandler(error, req, res);
  }
});
```

---

## Logging Examples

```javascript
const logger = createLogger('my-service');

// Info: Important business events
logger.info('Campaign created', { campaignId: 'idle-123', name: 'Welcome' });

// Warn: Unusual but handled situations
logger.warn('Campaign already exists', { campaignId: 'idle-123' });

// Error: Something went wrong
logger.error('Failed to upload file', error, { fileName: 'test.mp4' });

// Debug: Development/troubleshooting (disabled in production)
logger.debug('Cache hit', { key: 'config-idle', age: 5000 });

// Metric: Performance tracking
logger.metric('campaign_creation', 125); // 125ms
```

---

## Git Workflow Commands

```bash
# Create feature branch for each phase
git checkout -b refactor/phase-1-foundation

# Commit with clear message
git commit -m "Refactor: Phase 1 - Add logger service

- Create structured logger with levels
- Add performance metrics
- Add request correlation IDs
- Update all services to use logger

See: REFACTORING_PLAN.md Phase 1.1"

# Push and create PR
git push -u origin refactor/phase-1-foundation
# Create PR on GitHub

# After review and approval, merge
git checkout main
git pull
git merge --no-ff refactor/phase-1-foundation
```

---

## Testing Commands

```bash
# Run all tests
npm test

# Run specific test file
npm test -- admin/test/unit/services/campaign-service.test.js

# Run with verbose output
npm test -- --verbose

# Run and watch for changes
npm test -- --watch

# Run with coverage (add to package.json)
npm run test:coverage
```

---

## Debugging Tips

### Enable Debug Logging
```bash
# In development
NODE_ENV=development node admin/src/index.js

# With debug output
DEBUG=* node admin/src/index.js
```

### Add Temporary Logging
```javascript
logger.debug('State:', JSON.stringify(state, null, 2));
logger.debug('Event:', event);
```

### Use Correlation IDs
```javascript
// All logs for this request will have same correlationId
logger.info('Creating campaign', { correlationId, campaignId });
logger.info('Saving to storage', { correlationId, campaignId });
logger.info('Returned response', { correlationId, campaignId });
```

---

## File Size Guidelines

| File Type | Max Lines | Rationale |
|-----------|-----------|-----------|
| Function | 40 | Single responsibility |
| Handler | 60 | Request → Service → Response |
| Service | 200 | One domain concern |
| Router | 100 | Route mapping |
| Middleware | 30 | Single transformation |
| Utility | 50 | Helper functions |
| Test | 150 | One test module |

---

## Performance Checklist

- [ ] No synchronous I/O in handlers
- [ ] No N+1 queries (use maps for lookups)
- [ ] Logging doesn't block
- [ ] Config loaded once at startup
- [ ] Database connections pooled
- [ ] Cache frequently accessed data
- [ ] Measure before/after refactoring

---

## Security Checklist

- [ ] All input validated at boundary
- [ ] Error messages don't leak details
- [ ] Sensitive data not logged
- [ ] File uploads sanitized
- [ ] CORS headers set correctly
- [ ] Size limits on uploads
- [ ] Rate limiting on API

---

## Code Review Checklist

**Before merging a refactoring PR:**

- [ ] All tests pass locally
- [ ] New tests written
- [ ] JSDoc complete for all public APIs
- [ ] No console.log statements
- [ ] Error handling present
- [ ] Logging at key points
- [ ] File sizes within guidelines
- [ ] Follows CODING_STANDARDS.md
- [ ] No performance regression
- [ ] Git history clean (squash if needed)

---

## Troubleshooting

### "Module not found" after refactoring
**Solution:** Check import paths match new file structure

### Performance degradation
**Solution:** Profile before/after, check for N+1, unnecessary logging

### Tests failing after refactoring
**Solution:** Update import paths, mock new dependencies

### Git merge conflicts
**Solution:** Rebase and resolve, or recreate branch

---

## Decision Log

**Track all decisions made during refactoring**

### Decision: Logger Implementation
- **Date:** 2026-03-03
- **Context:** Need structured logging for observability
- **Options:** Winston, Pino, custom simple logger
- **Decision:** Custom simple logger (low overhead)
- **Rationale:** No external dependencies, works on Raspberry Pi
- **Impact:** Logging requires implementation, but maintainable

### Decision: Error Classes
- **Date:** 2026-03-03
- **Context:** Error handling was inconsistent
- **Decision:** Create error hierarchy (ValidationError, NotFoundError, etc)
- **Rationale:** Type-safe error handling, clear HTTP mapping
- **Impact:** More code but safer, better error messages

---

## Success Stories to Track

Document achievements as you complete them:

```
✅ Phase 1 Complete - Foundation
   - Logger implemented and all services updated
   - Config validation working
   - Error handling framework in place
   - Time spent: 16 hours (planned 16 hours) ✓

🎯 Phase 2 In Progress - Admin Refactor
   - Router extracted
   - Campaign handler complete
   - Media handler complete
   - Need to complete: Students, Settings
```

---

## Contact & Questions

For questions about refactoring:
1. Check REFACTORING_PLAN.md
2. Check CODING_STANDARDS.md
3. Review similar code patterns
4. Ask in team meeting


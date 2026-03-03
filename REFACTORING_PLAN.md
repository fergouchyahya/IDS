# IDS Refactoring Plan - Clean Code Best Practices

**Version:** 1.0  
**Date:** March 3, 2026  
**Goal:** Transform codebase from V0 MVP to production-ready, maintainable code following SOLID principles, clean code practices, and industry standards.

---

## Table of Contents
1. [Current State Assessment](#current-state-assessment)
2. [Architecture Decisions](#architecture-decisions)
3. [Phase-by-Phase Refactoring Plan](#phase-by-phase-refactoring-plan)
4. [Code Organization Structure](#code-organization-structure)
5. [Coding Standards & Guidelines](#coding-standards--guidelines)
6. [Documentation Strategy](#documentation-strategy)
7. [Testing Strategy](#testing-strategy)
8. [Implementation Checklist](#implementation-checklist)

---

## Current State Assessment

### Strengths
✅ Modular approach (admin, player, shared separation)  
✅ HTTP-only architecture (no dependencies bloat)  
✅ Working test structure exists  
✅ Some shared utilities created  
✅ Environment-based configuration  
✅ Separation of concerns (storage, rendering, routing)

### Pain Points
❌ Monolithic server files (1638 LOC in player, 245 LOC in admin)  
❌ Mixed concerns (HTTP routing + business logic + rendering)  
❌ Inconsistent error handling  
❌ Limited documentation  
❌ No clear naming conventions  
❌ Inline HTML in server (admin-ui.js)  
❌ No input validation middleware  
❌ Minimal logging  

### Code Metrics
| Module | Current LOC | Current Issues | Target LOC |
|--------|-------------|-----------------|-----------|
| player/src/server.js | 1,638 | Mixed concerns | ~400 |
| admin/src/server.js | 245 | Unclear separation | ~150 |
| admin/public/admin-ui.js | 1,665 | Needs refactoring | ~800 |
| Total | ~3,600 | High complexity | ~2,500 |

---

## Architecture Decisions

### Decision 1: Modular Server Architecture
**Decision:** Refactor each service into layers:
- **Router/Entry Point** - HTTP routing
- **Middleware** - Auth, validation, error handling, logging
- **Handlers** - Request processing
- **Services** - Business logic
- **Data Access** - Storage/persistence

**Rationale:** Single Responsibility Principle, easier testing, clearer flow.

**Impact:** Medium refactoring effort, high maintainability gain.

---

### Decision 2: Component-Based Admin UI
**Decision:** Extract admin-ui.js into modular components:
- Keep vanilla JS (no frameworks)
- Separate logic by component (CampaignEditor, BlockBuilder, MediaUploader)
- Clear event delegation patterns

**Rationale:** Maintainability, testability, feature isolation.

**Impact:** Significant but manageable refactoring.

---

### Decision 3: Comprehensive JSDoc Over TypeScript
**Decision:** Use JSDoc + .jshintrc for type hints (not TypeScript migration).

**Rationale:**
- No build step required
- Works with vanilla Node.js
- IDE provides autocomplete
- Migration to TS possible later
- Lighter learning curve for team

**Impact:** Low effort, medium benefit for code clarity.

---

### Decision 4: Logger-First Approach
**Decision:** All major operations must be logged with context.

**Rationale:** Debugging on Raspberry Pi (no console access), system observability.

**Impact:** Improves troubleshooting significantly.

---

### Decision 5: Explicit Validation at Boundaries
**Decision:** All inputs validated at HTTP routes; business logic assumes valid data.

**Rationale:** Security, predictability, cleaner business logic.

**Impact:** More code initially, but safer overall.

---

## Phase-by-Phase Refactoring Plan

### PHASE 1: Foundation (Week 1-2)
**Goal:** Establish infrastructure for clean code practices.

#### 1.1 - Enhanced Logging System
**File:** `shared/utils/logger.js` (ALREADY EXISTS - ENHANCE)

```javascript
/**
 * Logger service with multiple levels and structured output.
 * @module shared/utils/logger
 */

class Logger {
  constructor(service) {
    this.service = service;
    this.startTime = Date.now();
  }

  /**
   * Log debug-level message (development only)
   * @param {string} message - Message text
   * @param {object} data - Optional context data
   */
  debug(message, data) { /* ... */ }

  /**
   * Log info-level message
   * @param {string} message - Message text
   * @param {object} data - Optional context data
   */
  info(message, data) { /* ... */ }

  /**
   * Log warning
   * @param {string} message - Message text
   * @param {object} data - Optional context data
   */
  warn(message, data) { /* ... */ }

  /**
   * Log error with stack trace
   * @param {string} message - Message text
   * @param {Error} error - Error object
   * @param {object} data - Optional context data
   */
  error(message, error, data) { /* ... */ }

  /**
   * Log performance metric
   * @param {string} operation - Operation name
   * @param {number} durationMs - Duration in milliseconds
   */
  metric(operation, durationMs) { /* ... */ }
}
```

**Tasks:**
- [ ] Add performance timing
- [ ] Add structured error context
- [ ] Add request correlation IDs
- [ ] Ensure all services use logger
- [ ] Add log rotation setup for Pi

**Effort:** 2-3 hours | **Priority:** HIGH

---

#### 1.2 - Centralized Configuration
**File:** `shared/config/index.js` (NEW)

```javascript
/**
 * Centralized configuration management
 * @module shared/config
 */

const ENV_SCHEMA = {
  // Admin config
  ADMIN_PORT: { type: 'number', default: 8081, min: 1, max: 65535 },
  IDS_ADMIN_DATA_DIR: { type: 'string', default: null },
  IDS_PUBLIC_ADMIN_URL: { type: 'string', default: null },

  // Player config
  PLAYER_PORT: { type: 'number', default: 7070, min: 1, max: 65535 },
  IDS_CONFIG: { type: 'string', default: 'shared/contract/examples/config.welcome.json' },
  IDS_ADMIN_URL: { type: 'string', default: '' },

  // Common
  NODE_ENV: { type: 'string', enum: ['development', 'production', 'test'], default: 'production' },
};

class Config {
  constructor() {
    this.validate();
    this.cache = {};
  }

  validate() {
    // Validate all env vars against schema
  }

  get(key) {
    // Return config value with defaults
  }

  getAdmin() {
    // Return admin-specific config
  }

  getPlayer() {
    // Return player-specific config
  }
}

module.exports = new Config();
```

**Tasks:**
- [ ] Create schema validation
- [ ] Document all env vars in README
- [ ] Add validation on startup
- [ ] Create config dump for debugging
- [ ] Add env variable documentation in comments

**Effort:** 3-4 hours | **Priority:** HIGH

---

#### 1.3 - Error Handling Framework
**File:** `shared/errors/index.js` (NEW)

```javascript
/**
 * Custom error classes for type-safe error handling
 * @module shared/errors
 */

/**
 * Base application error
 */
class AppError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.code = code;
    this.details = details;
    this.timestamp = new Date().toISOString();
  }
}

/**
 * Validation error - 400 Bad Request
 */
class ValidationError extends AppError {
  constructor(issues) {
    super('VALIDATION_ERROR', 'Validation failed', { issues });
  }
}

/**
 * Not found error - 404
 */
class NotFoundError extends AppError {
  constructor(resource, id) {
    super('NOT_FOUND', `${resource} not found: ${id}`);
  }
}

/**
 * Internal server error - 500
 */
class InternalError extends AppError {
  constructor(message, details) {
    super('INTERNAL_ERROR', message, details);
  }
}

/**
 * Convert error to HTTP response
 * @param {Error} error
 * @returns {object} { statusCode, body }
 */
function errorToResponse(error) {
  if (error instanceof ValidationError) return { statusCode: 400, body: error };
  if (error instanceof NotFoundError) return { statusCode: 404, body: error };
  return { statusCode: 500, body: new InternalError(error.message) };
}
```

**Tasks:**
- [ ] Create error hierarchy
- [ ] Implement error-to-HTTP mapping
- [ ] Add error middleware to servers
- [ ] Test error scenarios
- [ ] Document error codes

**Effort:** 2-3 hours | **Priority:** HIGH

---

#### 1.4 - Input Validation Framework
**File:** `shared/validation/index.js` (NEW)

```javascript
/**
 * Input validation utilities
 * @module shared/validation
 */

class Validator {
  /**
   * Validate campaign object
   * @param {object} data
   * @throws ValidationError
   */
  static validateCampaign(data) { /* ... */ }

  /**
   * Validate event object
   * @param {object} event
   * @throws ValidationError
   */
  static validateEvent(event) { /* ... */ }

  /**
   * Validate media upload
   * @param {object} file
   * @throws ValidationError
   */
  static validateMediaUpload(file) { /* ... */ }

  /**
   * Validate field
   * @param {*} value
   * @param {object} rules
   * @throws ValidationError
   */
  static validateField(value, rules) { /* ... */ }
}
```

**Tasks:**
- [ ] Implement validation methods
- [ ] Create reusable validation rules
- [ ] Add message i18n support (future)
- [ ] Document validation rules
- [ ] Add field-level error messages

**Effort:** 3-4 hours | **Priority:** HIGH

---

### PHASE 2: Refactor Admin Service (Week 2-3)
**Goal:** Clean up admin server and separate concerns.

#### 2.1 - Reorganize Admin File Structure
```
admin/src/
├── index.js                 (Entry point)
├── server.js               (HTTP server setup)
├── config.js               (Admin-specific config)
├── middleware/
│   ├── error-handler.js    (Error handling)
│   ├── logger.js           (Request logging)
│   └── validation.js       (Input validation)
├── handlers/
│   ├── campaigns.js        (Campaign CRUD)
│   ├── media.js            (Media upload/serve)
│   ├── settings.js         (Settings endpoints)
│   ├── students.js         (Student management)
│   ├── menu.js             (Menu campaign)
│   └── health.js           (Health checks)
├── services/
│   ├── campaign-service.js (Campaign logic)
│   ├── media-service.js    (Media handling)
│   ├── sync-service.js     (Player sync)
│   └── backup-service.js   (State backups)
├── utils/
│   ├── multipart-parser.js (File upload parsing)
│   ├── mime-types.js       (MIME type helpers)
│   └── filename-utils.js   (Filename sanitization)
└── data/                   (Persist directory)
    ├── state.json
    ├── uploads/
    └── backups/

admin/public/
├── index.html              (HTML structure)
├── components/
│   ├── campaign-editor.js
│   ├── block-builder.js
│   ├── media-uploader.js
│   ├── student-manager.js
│   └── settings-panel.js
├── services/
│   ├── api-client.js
│   ├── state-manager.js
│   └── ui-utils.js
└── styles.css              (All styles)
```

**Tasks:**
- [ ] Create new directory structure
- [ ] Move functions to appropriate handlers
- [ ] Create middleware chain
- [ ] Document file purposes
- [ ] Update imports in index.js

**Effort:** 4-5 hours | **Priority:** HIGH

---

#### 2.2 - Refactor Admin Server (admin/src/server.js)
**Current:** 245 LOC mixed concerns  
**Target:** 80 LOC pure HTTP setup

```javascript
/**
 * IDS Admin — HTTP Server Setup
 * 
 * Responsibilities:
 * - Create HTTP server
 * - Attach middleware chain
 * - Register routes
 * - Handle graceful shutdown
 * 
 * @module admin/src/server
 */

const http = require('http');
const { createLogger } = require('../../shared/utils/logger');
const { createAdminRouter } = require('./handlers/router');
const { errorHandler, requestLogger } = require('./middleware');

const logger = createLogger('admin-server');

/**
 * Create and start admin server
 * 
 * @param {object} options
 * @param {number} options.port - Server port
 * @param {string} options.dataDir - Data directory
 * @returns {http.Server}
 */
function createServer({ port = 8081, dataDir } = {}) {
  // Validate options
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`Invalid port: ${port}`);
  }

  // Create router with dependencies
  const router = createAdminRouter({ dataDir });

  // Create HTTP server
  const server = http.createServer(async (req, res) => {
    try {
      // Middleware chain
      requestLogger(req, res);
      
      // Route handling
      await router.handle(req, res);
    } catch (error) {
      errorHandler(error, req, res);
    }
  });

  // Graceful shutdown
  process.on('SIGTERM', () => gracefulShutdown(server));
  process.on('SIGINT', () => gracefulShutdown(server));

  // Start listening
  server.listen(port, () => {
    logger.info(`Admin server started on port ${port}`, { port });
  });

  return server;
}

function gracefulShutdown(server) {
  logger.info('Graceful shutdown initiated');
  
  server.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });

  setTimeout(() => {
    logger.error('Graceful shutdown timeout');
    process.exit(1);
  }, 30000);
}

module.exports = { createServer };
```

**Tasks:**
- [ ] Extract router creation
- [ ] Extract middleware
- [ ] Extract error handling
- [ ] Add graceful shutdown
- [ ] Add JSDoc comments
- [ ] Test server startup

**Effort:** 2-3 hours | **Priority:** MEDIUM

---

#### 2.3 - Create Admin Router (admin/src/handlers/router.js)
**File:** `admin/src/handlers/router.js` (NEW)

```javascript
/**
 * Route dispatcher for admin API
 * 
 * Responsibilities:
 * - Parse URL paths
 * - Route to appropriate handler
 * - Handle 404s
 * 
 * @module admin/src/handlers/router
 */

const { createLogger } = require('../../../shared/utils/logger');

const logger = createLogger('admin-router');

/**
 * Create admin router
 * 
 * @param {object} deps - Dependency injection
 * @param {string} deps.dataDir - Data directory
 * @returns {object} Router with handle method
 */
function createAdminRouter({ dataDir }) {
  // Import handlers
  const campaignHandler = require('./campaigns');
  const mediaHandler = require('./media');
  const settingsHandler = require('./settings');
  const studentHandler = require('./students');
  const healthHandler = require('./health');

  /**
   * Main route handler
   * 
   * @param {http.IncomingMessage} req
   * @param {http.ServerResponse} res
   */
  async function handle(req, res) {
    const { pathname, searchParams } = new URL(req.url, `http://${req.headers.host}`);
    
    logger.debug(`Route request`, { method: req.method, pathname });

    // Route mapping
    if (pathname === '/' || pathname === '/index.html') {
      return handleUI(req, res);
    }

    if (pathname.startsWith('/api/campaigns')) {
      return campaignHandler.handle(req, res, { dataDir });
    }

    if (pathname.startsWith('/api/media')) {
      return mediaHandler.handle(req, res, { dataDir });
    }

    if (pathname.startsWith('/api/settings')) {
      return settingsHandler.handle(req, res, { dataDir });
    }

    if (pathname.startsWith('/api/students')) {
      return studentHandler.handle(req, res, { dataDir });
    }

    if (pathname === '/health') {
      return healthHandler.handle(req, res);
    }

    // 404
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'not_found', message: 'Route not found' }));
  }

  return { handle };
}

module.exports = { createAdminRouter };
```

**Tasks:**
- [ ] Create routes map
- [ ] Implement each handler
- [ ] Add URL parsing
- [ ] Handle 404s properly
- [ ] Add logging to each route
- [ ] Test routing

**Effort:** 3-4 hours | **Priority:** HIGH

---

#### 2.4 - Create Campaign Handler (admin/src/handlers/campaigns.js)
**File:** `admin/src/handlers/campaigns.js` (NEW)

```javascript
/**
 * Campaign management endpoint handlers
 * 
 * Endpoints:
 * - GET /api/campaigns          - List all campaigns
 * - POST /api/campaigns         - Create campaign
 * - GET /api/campaigns/:id      - Get campaign
 * - PATCH /api/campaigns/:id    - Update campaign
 * - DELETE /api/campaigns/:id   - Delete campaign
 * 
 * @module admin/src/handlers/campaigns
 */

const { createLogger } = require('../../../shared/utils/logger');
const { json } = require('../../../shared/utils/http-helpers');
const CampaignService = require('../services/campaign-service');

const logger = createLogger('admin-campaigns');

/**
 * Handle campaign requests
 * 
 * @param {http.IncomingMessage} req
 * @param {http.ServerResponse} res
 * @param {object} options - { dataDir }
 */
async function handle(req, res, { dataDir }) {
  const service = new CampaignService(dataDir);
  const { pathname } = new URL(req.url, `http://${req.headers.host}`);

  try {
    if (req.method === 'GET' && pathname === '/api/campaigns') {
      return handleListCampaigns(req, res, service);
    }

    if (req.method === 'POST' && pathname === '/api/campaigns') {
      return handleCreateCampaign(req, res, service);
    }

    const idMatch = pathname.match(/^\/api\/campaigns\/([^/]+)$/);
    if (idMatch) {
      const campaignId = idMatch[1];

      if (req.method === 'GET') {
        return handleGetCampaign(req, res, service, campaignId);
      }

      if (req.method === 'PATCH') {
        return handleUpdateCampaign(req, res, service, campaignId);
      }

      if (req.method === 'DELETE') {
        return handleDeleteCampaign(req, res, service, campaignId);
      }
    }

    json(res, 404, { error: 'not_found' });
  } catch (error) {
    logger.error('Campaign handler error', error, { pathname });
    json(res, 500, { error: 'internal_error', message: error.message });
  }
}

async function handleListCampaigns(req, res, service) {
  logger.debug('List campaigns');
  const campaigns = await service.listAll();
  json(res, 200, campaigns);
}

async function handleCreateCampaign(req, res, service) {
  const data = await readJsonBody(req);
  logger.debug('Create campaign', { name: data.campaignName });
  
  const campaign = await service.create(data);
  json(res, 201, campaign);
}

async function handleGetCampaign(req, res, service, campaignId) {
  logger.debug('Get campaign', { campaignId });
  const campaign = await service.getById(campaignId);
  json(res, 200, campaign);
}

async function handleUpdateCampaign(req, res, service, campaignId) {
  const data = await readJsonBody(req);
  logger.debug('Update campaign', { campaignId });
  
  const campaign = await service.update(campaignId, data);
  json(res, 200, campaign);
}

async function handleDeleteCampaign(req, res, service, campaignId) {
  logger.debug('Delete campaign', { campaignId });
  await service.delete(campaignId);
  json(res, 204, null);
}

module.exports = { handle };
```

**Tasks:**
- [ ] Implement all handlers
- [ ] Add input validation for each
- [ ] Add error handling
- [ ] Add JSDoc for each function
- [ ] Test each endpoint
- [ ] Add logging at key points

**Effort:** 4-5 hours | **Priority:** HIGH

---

#### 2.5 - Extract Admin Services (admin/src/services/)
**File:** `admin/src/services/campaign-service.js` (NEW)

```javascript
/**
 * Campaign business logic
 * 
 * Responsibilities:
 * - Validate campaign data
 * - Apply business rules
 * - Persist campaigns
 * - Emit events
 * 
 * @module admin/src/services/campaign-service
 */

const fs = require('fs');
const path = require('path');
const { createLogger } = require('../../../shared/utils/logger');
const storage = require('../storage');

const logger = createLogger('campaign-service');

class CampaignService {
  constructor(dataDir) {
    this.dataDir = dataDir || path.join(__dirname, '../../data');
  }

  /**
   * List all campaigns
   * @returns {Promise<Campaign[]>}
   */
  async listAll() {
    const state = storage.readState();
    
    return [
      ...state.idleCampaigns,
      ...state.visitorCampaigns,
      // Student campaigns...
    ];
  }

  /**
   * Get campaign by ID
   * @param {string} campaignId
   * @returns {Promise<Campaign>}
   * @throws {NotFoundError}
   */
  async getById(campaignId) {
    const state = storage.readState();
    const campaign = this.findCampaignById(state, campaignId);
    
    if (!campaign) {
      throw new NotFoundError('Campaign', campaignId);
    }

    return campaign;
  }

  /**
   * Create new campaign
   * @param {object} data
   * @returns {Promise<Campaign>}
   * @throws {ValidationError}
   */
  async create(data) {
    // Validate input
    this.validateCampaignData(data);

    // Create campaign object
    const campaign = {
      campaignId: `${data.kind}-${Date.now()}`,
      campaignName: data.campaignName,
      kind: data.kind,
      items: data.items || [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    logger.info('Campaign created', { campaignId: campaign.campaignId, name: campaign.campaignName });

    // Persist
    storage.addCampaign(campaign);

    return campaign;
  }

  /**
   * Update campaign
   * @param {string} campaignId
   * @param {object} patch
   * @returns {Promise<Campaign>}
   */
  async update(campaignId, patch) {
    const existing = await this.getById(campaignId);
    
    // Merge and validate
    const updated = { ...existing, ...patch, updatedAt: new Date().toISOString() };
    this.validateCampaignData(updated);

    logger.info('Campaign updated', { campaignId });
    
    storage.updateCampaign(campaignId, updated);
    return updated;
  }

  /**
   * Delete campaign
   * @param {string} campaignId
   * @returns {Promise<void>}
   */
  async delete(campaignId) {
    await this.getById(campaignId); // Verify exists
    
    logger.info('Campaign deleted', { campaignId });
    storage.deleteCampaign(campaignId);
  }

  /**
   * Validate campaign data
   * @private
   * @throws {ValidationError}
   */
  validateCampaignData(data) {
    const issues = [];

    if (!data.campaignName?.trim()) {
      issues.push({ field: 'campaignName', message: 'Campaign name is required' });
    }

    if (!['idle', 'visitor', 'student'].includes(data.kind)) {
      issues.push({ field: 'kind', message: 'Invalid campaign kind' });
    }

    if (!Array.isArray(data.items) || data.items.length === 0) {
      issues.push({ field: 'items', message: 'At least one item is required' });
    }

    if (issues.length > 0) {
      throw new ValidationError(issues);
    }
  }

  /**
   * Find campaign by ID across all types
   * @private
   */
  findCampaignById(state, campaignId) {
    return (
      state.idleCampaigns.find(c => c.campaignId === campaignId) ||
      state.visitorCampaigns.find(c => c.campaignId === campaignId) ||
      this.findStudentCampaignById(state, campaignId)
    );
  }
}

module.exports = CampaignService;
```

**Tasks:**
- [ ] Create all service classes
- [ ] Add JSDoc for all methods
- [ ] Implement validation methods
- [ ] Add error handling
- [ ] Add logging
- [ ] Test services in isolation

**Effort:** 5-6 hours | **Priority:** HIGH

---

### PHASE 3: Refactor Player Service (Week 3-4)
**Goal:** Split monolithic player server into logical modules.

#### 3.1 - Reorganize Player File Structure
```
player/src/
├── index.js
├── server.js               (HTTP server setup, 100 LOC)
├── config.js               (Player config)
├── middleware/
│   ├── error-handler.js
│   ├── logger.js
│   └── cors.js
├── handlers/
│   ├── ui.js              (GET /)
│   ├── current.js         (GET /current)
│   ├── events.js          (POST /events)
│   ├── health.js          (GET /health)
│   └── debug.js           (GET /debug)
├── services/
│   ├── state-machine.js   (PlayerStateMachine class, 200 LOC)
│   ├── config-service.js  (Config loading & validation)
│   ├── detector-service.js (Motion detection config)
│   ├── admin-sync-service.js (Sync with admin)
│   └── render-service.js   (All rendering functions, 800+ LOC)
├── utils/
│   ├── event-validators.js (Event validation)
│   └── state-utils.js      (State helper functions)
└── detector/
    ├── index.js            (Motion detection algorithm)
    └── config.js           (Detector config schema)
```

**Tasks:**
- [ ] Create new directory structure
- [ ] Plan module extraction
- [ ] Identify dependencies between modules
- [ ] Document extracted functions
- [ ] Plan extraction order

**Effort:** 2-3 hours | **Priority:** MEDIUM

---

#### 3.2 - Extract State Machine (player/src/services/state-machine.js)
**File:** `player/src/services/state-machine.js` (NEW)

Already has PlayerStateMachine class, but needs:
- Better JSDoc
- Clear method documentation
- State transition diagram
- Event handling documentation

```javascript
/**
 * Player state machine
 * 
 * State transitions:
 * IDLE -> MENU (on movement_detected)
 * MENU -> VISITOR_INFO (on visitor_selected)
 * MENU -> STUDENT_INFO (on nfc_tap with known UID)
 * MENU -> MENU (on nfc_tap with unknown UID)
 * VISITOR_INFO/STUDENT_INFO -> IDLE (on inactivity timeout)
 * Any -> IDLE (on reset)
 * 
 * @module player/src/services/state-machine
 */

const { createLogger } = require('../../../shared/utils/logger');

const logger = createLogger('state-machine');

const STATE = Object.freeze({
  IDLE: 'IDLE',
  MENU: 'MENU',
  VISITOR_INFO: 'VISITOR_INFO',
  STUDENT_INFO: 'STUDENT_INFO',
});

/**
 * Player state machine
 * 
 * Responsibilities:
 * - Track current state and campaign
 * - Handle events and state transitions
 * - Manage inactivity timeout
 * - Provide status information
 * 
 * @class PlayerStateMachine
 */
class PlayerStateMachine {
  /**
   * @constructor
   * @param {object} runtimeConfig - Runtime configuration
   * @throws {Error} If config is invalid
   */
  constructor(runtimeConfig) {
    // ... existing code ...
  }

  /**
   * Handle incoming event and transition state
   * 
   * @param {object} event - Event object
   * @param {string} event.type - Event type (movement_detected, visitor_selected, etc)
   * @param {*} event.* - Additional event-specific fields
   * 
   * @returns {object} Result with status and action taken
   */
  handleEvent(event) {
    // ... existing code ...
  }

  /**
   * Get current state
   * 
   * @returns {object} Current state, campaign, item, etc.
   */
  getStatus() {
    // ... existing code ...
  }
}

module.exports = { PlayerStateMachine, STATE };
```

**Tasks:**
- [ ] Add JSDoc to all methods
- [ ] Create state transition documentation
- [ ] Document event types
- [ ] Add error scenarios
- [ ] Test all transitions
- [ ] Add performance logging

**Effort:** 3-4 hours | **Priority:** HIGH

---

#### 3.3 - Extract Render Service (player/src/services/render-service.js)
**File:** `player/src/services/render-service.js` (NEW)

Move all rendering functions from server.js:

```javascript
/**
 * UI rendering service
 * 
 * Responsibilities:
 * - Render HTML UI
 * - Apply state-based styling
 * - Handle viewport rendering
 * - Generate debug panel
 * 
 * @module player/src/services/render-service
 */

const { createLogger } = require('../../../shared/utils/logger');

const logger = createLogger('render-service');

/**
 * Render complete UI
 * 
 * @param {PlayerStateMachine} sm - State machine instance
 * @param {object} options - Rendering options
 * @param {boolean} options.debug - Show debug panel
 * @returns {string} HTML to render
 */
function renderUI(sm, options = {}) {
  const status = sm.getStatus();
  const item = status.item;
  
  const head = renderHead(status);
  const menu = status.state === 'MENU' ? renderMenuSurface(status, []) : '';
  const viewport = renderViewport(status, item);
  const footer = renderFooter(status);
  const debug = options.debug ? renderDebugPanel(status) : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>${head}</head>
<body>
  <div class="app">
    ${menu}
    ${viewport}
    ${footer}
    ${debug}
  </div>
</body>
</html>`;
}

/**
 * Render page head section
 * @private
 */
function renderHead(status) {
  // ... move from server.js ...
}

/**
 * Render menu surface
 * @private
 */
function renderMenuSurface(status, lines) {
  // ... move from server.js ...
}

/**
 * Render viewport content
 * @private
 */
function renderViewport(status, item) {
  // ... move from server.js ...
}

/**
 * Render footer
 * @private
 */
function renderFooter(status) {
  // ... move from server.js ...
}

/**
 * Render debug panel (development only)
 * @private
 */
function renderDebugPanel(status) {
  // ... move from server.js ...
}

module.exports = {
  renderUI,
  renderHead,
  renderMenuSurface,
  renderViewport,
  renderFooter,
  renderDebugPanel,
};
```

**Tasks:**
- [ ] Extract all render functions
- [ ] Add JSDoc for each
- [ ] Group related functions
- [ ] Reduce JSDoc HTML
- [ ] Test rendering
- [ ] Add performance logging

**Effort:** 4-5 hours | **Priority:** HIGH

---

#### 3.4 - Create Player Router (player/src/handlers/)
Similar to admin router, create handlers for:
- GET / (render UI)
- GET /current (return status)
- POST /events (handle events)
- GET /health (health check)
- GET /debug (debug info)

**Tasks:**
- [ ] Create handler files
- [ ] Add JSDoc
- [ ] Implement routing
- [ ] Add logging
- [ ] Test routes

**Effort:** 3-4 hours | **Priority:** MEDIUM

---

### PHASE 4: Refactor Admin UI (Week 4-5)
**Goal:** Modularize admin-ui.js into components.

#### 4.1 - Extract Static Assets
```
admin/public/
├── index.html        (HTML structure, 50 LOC)
├── styles.css        (All CSS from server render)
├── app.js            (Main app logic, control flow)
├── components/
│   ├── campaign-editor.js     (Campaign form)
│   ├── block-builder.js       (Block list + editor)
│   ├── media-uploader.js      (File upload)
│   ├── student-manager.js     (Student list)
│   ├── settings-panel.js      (Settings)
│   └── overview-grid.js       (Campaign grid)
├── services/
│   ├── api-client.js          (HTTP client)
│   ├── state-manager.js       (UI state)
│   └── ui-helpers.js          (DOM utilities)
└── utils/
    ├── ui-utils.js            (DOM helpers)
    └── validators.js          (Client validation)
```

#### 4.2 - Create index.html
```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Digital Signage Campaign Builder</title>
  <link rel="stylesheet" href="styles.css">
</head>
<body>
  <div id="app"></div>
  <script src="services/api-client.js"></script>
  <script src="services/state-manager.js"></script>
  <script src="services/ui-helpers.js"></script>
  <script src="components/campaign-editor.js"></script>
  <script src="components/block-builder.js"></script>
  <script src="components/media-uploader.js"></script>
  <script src="components/student-manager.js"></script>
  <script src="components/settings-panel.js"></script>
  <script src="components/overview-grid.js"></script>
  <script src="app.js"></script>
</body>
</html>
```

#### 4.3 - Create Component Structure
```javascript
/**
 * Campaign Editor Component
 * 
 * @module admin/public/components/campaign-editor
 */

const CampaignEditor = {
  /**
   * Initialize component
   * @param {object} options - { container, state }
   */
  init(options) {
    this.container = options.container;
    this.state = options.state;
    this.render();
  },

  /**
   * Render editor UI
   */
  render() {
    // Build HTML
    // Attach event listeners
  },

  /**
   * Handle form submission
   */
  onSubmit(data) {
    // Validate
    // Call API
    // Update state
  },

  /**
   * Cleanup listeners
   */
  destroy() {
    // Remove listeners
  }
};
```

**Tasks:**
- [ ] Create index.html
- [ ] Extract styles.css
- [ ] Create each component file
- [ ] Add JSDoc for each
- [ ] Implement components
- [ ] Test components
- [ ] Add component state management

**Effort:** 6-8 hours | **Priority:** HIGH

---

### PHASE 5: Documentation & Best Practices (Week 5)
**Goal:** Establish coding standards and documentation.

#### 5.1 - Create Coding Standards Document
**File:** `CODING_STANDARDS.md` (NEW)

```markdown
# IDS Coding Standards

## Naming Conventions

### Files
- Use kebab-case for file names: `campaign-service.js`
- Directories use kebab-case: `admin/src/handlers/`
- Main class files match class name: `PlayerStateMachine` → `player-state-machine.js`

### Variables & Functions
- Use camelCase: `getCampaignById`, `isValidCampaign`
- Constants use UPPER_SNAKE_CASE: `DEFAULT_TIMEOUT_MS`, `MAX_UPLOAD_SIZE`
- Private methods/functions start with underscore: `_validateInput()`

### Classes
- Use PascalCase: `PlayerStateMachine`, `CampaignService`
- One class per file
- Methods describe actions: `create()`, `update()`, `delete()`

## JSDoc Documentation

Every function must have JSDoc:

```javascript
/**
 * Brief description
 * 
 * Longer description if needed,
 * can span multiple lines.
 * 
 * @param {type} paramName - Description
 * @param {object} options - Options object
 * @param {string} options.name - Option description
 * @returns {type} Return description
 * @throws {ErrorType} When this error occurs
 * 
 * @example
 * const result = myFunction('value', { name: 'test' });
 */
function myFunction(paramName, options = {}) { }
```

## Error Handling

Use custom error classes:

```javascript
try {
  const result = await service.create(data);
} catch (error) {
  if (error instanceof ValidationError) {
    // Handle validation error
  } else if (error instanceof NotFoundError) {
    // Handle not found
  } else {
    // Handle other errors
  }
}
```

## Logging

Use logger for all significant operations:

```javascript
logger.info('Campaign created', { campaignId, name });
logger.error('Failed to upload file', error, { fileName });
```

## File Organization

```
src/
├── index.js          # Entry point, minimal code
├── server.js         # HTTP server setup only
├── config.js         # Configuration
├── middleware/       # HTTP middleware
├── handlers/         # Request handlers
├── services/         # Business logic
├── utils/            # Helper utilities
└── errors/           # Custom errors
```

## Testing

Every module tested in isolation:

```
test/
├── unit/             # Individual module tests
├── integration/      # Cross-module tests
└── e2e/              # Full flow tests
```

## Comments

Prefer self-documenting code:

```javascript
// ❌ Don't
const x = 60000; // timeout

// ✅ Do
const INACTIVITY_TIMEOUT_MS = 60000;
```

Use comments to explain WHY, not WHAT:

```javascript
// ✅ Good
// User timeout is longer during menu to prevent accidental exits
const MENU_INACTIVITY_TIMEOUT_MS = 120000;

// ❌ Bad
// Set timeout to 120000
const timeout = 120000;
```

## Performance

- Avoid synchronous I/O in handlers
- Use request correlation IDs
- Log performance metrics
- Document complexity expectations

## Security

- Validate all input at boundaries
- Sanitize filenames and content
- Set size limits on uploads
- Use HTTPS in production
```

**Tasks:**
- [ ] Document naming conventions
- [ ] Create JSDoc templates
- [ ] Document error handling patterns
- [ ] Create file organization guidelines
- [ ] Document testing patterns
- [ ] Share with team

**Effort:** 2-3 hours | **Priority:** MEDIUM

---

#### 5.2 - Create Architecture Decision Records (ADRs)
**Directory:** `docs/adr/` (NEW)

Create ADR files for each major decision:

**File:** `docs/adr/001-modular-server-architecture.md`
```markdown
# ADR-001: Modular Server Architecture

## Context
Original server file was 1600+ LOC mixing HTTP routing, business logic, and rendering.

## Decision
Refactor into layers: router → middleware → handler → service → data.

## Consequences
- **Benefits:**
  - Single responsibility principle
  - Easier to test
  - Clearer data flow
  - Easier to find code
  - Parallel development possible

- **Drawbacks:**
  - More files to navigate
  - Initial refactoring effort
  - Slight performance overhead (negligible)

## Related
- ADR-002: Modular Admin UI
- ADR-003: Error Handling Framework
```

**File:** `docs/adr/002-jsdoc-over-typescript.md`
```markdown
# ADR-002: JSDoc Over TypeScript

## Context
Need type safety and IDE support without build complexity.

## Decision
Use JSDoc annotations for type hints; no TypeScript compilation.

## Consequences
- **Benefits:**
  - No build step
  - IDE autocomplete works
  - Faster iteration
  - Lower barrier to entry
  - Can migrate to TS later

- **Drawbacks:**
  - Runtime checks still needed
  - IDE support not 100%
  - Manual type validation

## Examples
```javascript
/**
 * @param {object} config
 * @param {string} config.name
 * @returns {Promise<Campaign>}
 */
```

## Future
- Consider TypeScript migration for v2
- Automated type checking with Ajv
```

**Tasks:**
- [ ] Create ADR directory
- [ ] Document architectural decisions
- [ ] Document technology choices
- [ ] Document past decisions
- [ ] Link ADRs in README

**Effort:** 2-3 hours | **Priority:** LOW-MEDIUM

---

## Code Organization Structure

### Directory Layout (Final)
```
ids/
├── README.md                          # Project overview
├── CODING_STANDARDS.md                # Code standards
├── REFACTORING_PLAN.md               # This document
├── Makefile                           # Build commands
│
├── docs/
│   ├── adr/                           # Architecture decisions
│   ├── api/                           # API documentation
│   └── development/                   # Development guides
│
├── shared/
│   ├── utils/
│   │   ├── logger.js                  # Logging
│   │   ├── http-helpers.js            # HTTP utilities
│   │   └── validators.js              # Validation helpers
│   ├── errors/
│   │   └── index.js                   # Error classes
│   ├── middleware/
│   │   ├── error-handler.js
│   │   ├── request-logger.js
│   │   └── cors.js
│   ├── config/
│   │   └── index.js                   # Config management
│   └── contract/
│       └── schema/                    # JSON schemas
│
├── admin/
│   ├── src/
│   │   ├── index.js                   # Entry point
│   │   ├── server.js                  # HTTP server setup
│   │   ├── config.js                  # Admin config
│   │   ├── storage.js                 # State management
│   │   ├── middleware/                # Admin middleware
│   │   ├── handlers/                  # Request handlers
│   │   ├── services/                  # Business logic
│   │   ├── utils/                     # Helpers
│   │   └── router.js                  # Route dispatcher
│   ├── public/
│   │   ├── index.html                 # HTML structure
│   │   ├── styles.css                 # All CSS
│   │   ├── app.js                     # Main app logic
│   │   ├── components/                # UI components
│   │   ├── services/                  # API client, state
│   │   └── utils/                     # DOM helpers
│   ├── data/                          # Runtime data
│   └── test/
│
├── player/
│   ├── src/
│   │   ├── index.js
│   │   ├── server.js
│   │   ├── config.js
│   │   ├── middleware/
│   │   ├── handlers/
│   │   ├── services/
│   │   ├── utils/
│   │   ├── detector/                  # Motion detection
│   │   └── router.js
│   ├── public/                        # Static UI (minimal)
│   └── test/
│
└── deploy/
    └── pi/
        ├── env/
        └── systemd/
```

---

## Coding Standards & Guidelines

### 1. Function Sizing
- **Max 40 lines** per function
- If longer, break into smaller functions
- Each function has single responsibility

### 2. JSDoc Requirements
- Every exported function needs JSDoc
- Every class needs JSDoc
- Every module needs header JSDoc
- JSDoc before implementation

### 3. Error Handling
- Use custom error classes (ValidationError, NotFoundError, etc.)
- Always provide context: `error.details`
- Log errors with context
- Never swallow errors silently

### 4. Async/Await
- Prefer async/await over promises
- Add try/catch blocks
- Log errors in catch

### 5. Naming Clarity
- Variable names should be self-documenting
- Avoid abbreviations (use `configPath` not `cfgPth`)
- Use action verbs for functions: `create`, `update`, `delete`, `get`

### 6. Constants
```javascript
// Good
const MAX_UPLOAD_SIZE_MB = 20;
const DEFAULT_INACTIVITY_TIMEOUT_MS = 60000;

// Bad
const MAX = 20;
const TIMEOUT = 60000;
```

### 7. Comments
- Comment WHY not WHAT
- Keep comments updated with code
- Use comment for business rule explanations

### 8. Testing
- Unit tests for services
- Integration tests for handlers
- E2E tests for critical flows
- Test file co-located with source

### 9. Logging
- Log at key decision points
- Include relevant context
- Use appropriate log levels
- Structure log messages

### 10. Configuration
- Use environment variables for deployment config
- Use config files for application logic config
- Centralize config reading
- Validate config on startup

---

## Testing Strategy

### Unit Tests
**Location:** `admin/test/unit/`, `player/test/unit/`

```javascript
// admin/test/unit/services/campaign-service.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const CampaignService = require('../../../src/services/campaign-service');

test('CampaignService', async (t) => {
  await t.test('create() validates required fields', () => {
    const service = new CampaignService();
    
    assert.throws(
      () => service.create({ campaignName: '' }),
      ValidationError
    );
  });

  await t.test('create() returns campaign with ID', () => {
    const service = new CampaignService();
    const result = service.create({ 
      campaignName: 'Test',
      kind: 'idle',
      items: [{ type: 'TEXT', data: 'hello' }]
    });

    assert.ok(result.campaignId);
    assert.equal(result.campaignName, 'Test');
  });
});
```

### Integration Tests
**Location:** `test/integration/`

```javascript
// test/integration/admin-api.test.js
test('Admin API', async (t) => {
  const server = createAdminServer();

  await t.test('POST /api/campaigns creates campaign', async () => {
    const response = await fetch('http://localhost:8081/api/campaigns', {
      method: 'POST',
      body: JSON.stringify({
        campaignName: 'Test',
        kind: 'idle',
        items: []
      })
    });

    assert.equal(response.status, 201);
    const data = await response.json();
    assert.ok(data.campaignId);
  });
});
```

### E2E Tests
**Location:** `test/e2e/`

```javascript
// test/e2e/admin-to-player.test.js
test('Admin to Player Flow', async (t) => {
  // 1. Start admin server
  // 2. Create campaign via API
  // 3. Start player with config
  // 4. Verify campaign loads
  // 5. Send events
  // 6. Verify state changes
  // 7. Cleanup
});
```

---

## Documentation Strategy

### README.md Structure
```markdown
# IDS - Interactive Digital Signage

## Quick Start
## Installation
## Architecture Overview
## API Documentation
## Development Guide
## Deployment
## Troubleshooting
## Contributing
```

### API Documentation (docs/api/README.md)
```markdown
# API Documentation

## Admin API
### GET /api/campaigns
### POST /api/campaigns
### PATCH /api/campaigns/:id
### DELETE /api/campaigns/:id

## Player API
### GET /current
### POST /events
### GET /health
```

### Development Guide (docs/development/README.md)
```markdown
# Development Guide

## Setting Up Dev Environment
## Project Structure
## Common Tasks
- Creating a new handler
- Adding a service
- Writing tests
- Debugging

## Performance Tips
## Security Considerations
```

---

## Implementation Checklist

### PHASE 1: Foundation (Week 1-2)
- [ ] Create enhanced logger
- [ ] Create centralized config
- [ ] Create error handling framework
- [ ] Create input validation framework
- [ ] Create CODING_STANDARDS.md
- [ ] Update README with new structure
- [ ] Add middleware chain to servers

### PHASE 2: Admin Refactor (Week 2-3)
- [ ] Create admin directory structure
- [ ] Refactor admin/src/server.js
- [ ] Create admin router
- [ ] Create campaign handler
- [ ] Create media handler
- [ ] Create settings handler
- [ ] Create student handler
- [ ] Create admin services (CampaignService, etc.)
- [ ] Write admin unit tests
- [ ] Write admin integration tests

### PHASE 3: Player Refactor (Week 3-4)
- [ ] Create player directory structure
- [ ] Refactor player/src/server.js
- [ ] Extract state machine to separate file
- [ ] Extract render service
- [ ] Create player router
- [ ] Create event handlers
- [ ] Create player services
- [ ] Write player unit tests
- [ ] Write player integration tests

### PHASE 4: Admin UI (Week 4-5)
- [ ] Create index.html
- [ ] Extract styles.css
- [ ] Create component files
- [ ] Implement campaign editor component
- [ ] Implement block builder component
- [ ] Implement media uploader component
- [ ] Implement student manager component
- [ ] Create API client service
- [ ] Create state manager service
- [ ] Test all components

### PHASE 5: Documentation (Week 5)
- [ ] Create architecture diagrams (ADRs)
- [ ] Create API documentation
- [ ] Create development guide
- [ ] Create deployment guide
- [ ] Create troubleshooting guide
- [ ] Add inline code comments
- [ ] Add examples to README
- [ ] Create contributing guide

### Ongoing
- [ ] Code review process
- [ ] Continuous testing
- [ ] Performance monitoring
- [ ] Security audits
- [ ] Documentation maintenance

---

## Git Workflow During Refactoring

### Branch Strategy
```bash
# Create feature branch for each phase
git checkout -b refactor/phase-1-foundation
git checkout -b refactor/phase-2-admin
git checkout -b refactor/phase-3-player
git checkout -b refactor/phase-4-admin-ui
git checkout -b refactor/phase-5-docs
```

### Commit Messages
```
Refactor: Phase 1 - Create logger service

- Add structured logging with levels
- Add performance metric tracking
- Add request correlation IDs
- Update all services to use logger
- Add tests for logger

Fixes: #123
```

### PR Template
```markdown
## Refactoring Phase: [Phase Name]

### What Changed
- List key changes

### Why
- Explain reasoning

### Testing
- Describe tests added

### Checklist
- [ ] All tests pass
- [ ] JSDoc complete
- [ ] No console.logs
- [ ] Error handling added
- [ ] Logging added
```

---

## Success Criteria

### Code Quality
✅ All functions have JSDoc  
✅ All modules have clear single responsibility  
✅ No function exceeds 40 LOC  
✅ All error cases handled  
✅ All external input validated  

### Testing
✅ Unit test coverage > 70%  
✅ Integration tests for all API endpoints  
✅ E2E tests for critical flows  
✅ All tests pass locally  

### Documentation
✅ README explains architecture  
✅ API documentation complete  
✅ Development guide complete  
✅ ADRs document major decisions  

### Performance
✅ Startup time < 2s  
✅ Request latency < 100ms  
✅ Memory stable over time  
✅ No memory leaks  

### Maintainability
✅ New developer can contribute in 1 week  
✅ Code is self-documenting  
✅ Clear place for each type of code  
✅ Easy to add new features  

---

## Risk Mitigation

### Risk: Breaking Changes During Refactor
**Mitigation:**
- Keep feature branch
- Use feature flags
- Comprehensive test coverage
- Parallel test on main branch

### Risk: Lost Functionality
**Mitigation:**
- Document current behavior
- Write tests before refactoring
- Keep git history
- Code review each phase

### Risk: Performance Regression
**Mitigation:**
- Profile before/after
- Load testing
- Monitor metrics
- Keep performance budget

### Risk: Team Productivity Loss
**Mitigation:**
- Clear documentation
- Gradual rollout
- Training sessions
- Pair programming

---

## Tools & Technologies

### Linting
```json
// .eslintrc.json
{
  "env": { "node": true },
  "extends": "eslint:recommended",
  "rules": {
    "no-unused-vars": "error",
    "no-console": "warn",
    "quotes": ["error", "double"]
  }
}
```

### Testing Framework
- Built-in: `node:test` (Node 18+)
- Assertions: `node:assert/strict`

### Documentation
- JSDoc for inline docs
- Markdown for guides
- Architecture Decision Records

---

## Timeline

```
Week 1-2:   Foundation (Logger, Config, Errors)      ████░░░░░░
Week 2-3:   Admin Refactor                           ░████░░░░░
Week 3-4:   Player Refactor                          ░░████░░░░
Week 4-5:   Admin UI & Testing                       ░░░████░░░
Week 5-6:   Documentation & Polish                   ░░░░████░░
Week 6:     QA & Fixes                               ░░░░░████░
```

**Total Effort:** ~40 development hours  
**Team Size:** 1-2 developers  
**Parallel Work:** Limited (mostly sequential)  

---

## Next Steps

1. **Approve Plan** - Get stakeholder buy-in
2. **Assign Owner** - Designate refactoring lead
3. **Create Branches** - Set up feature branches
4. **Start Phase 1** - Begin with foundation
5. **Weekly Reviews** - Check progress
6. **Adjust as Needed** - Adapt based on learnings

---

## Document Revisions

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-03-03 | Team | Initial plan |

---

## References

- [Clean Code by Robert C. Martin](https://www.oreilly.com/library/view/clean-code-a/9780136083238/)
- [SOLID Principles](https://en.wikipedia.org/wiki/SOLID)
- [12 Factor App](https://12factor.net/)
- [Node.js Best Practices](https://github.com/goldbergyoni/nodebestpractices)
- [Google JavaScript Style Guide](https://google.github.io/styleguide/tsguide.html)


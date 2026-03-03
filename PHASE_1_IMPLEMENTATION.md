# Phase 1 Implementation Guide - Foundation

**Goal:** Establish infrastructure for clean code practices  
**Duration:** Week 1-2  
**Effort:** ~16 development hours  
**Status:** 🟢 Ready to Start

---

## Overview

Phase 1 creates the foundational infrastructure that all refactoring phases will depend on:

```
Phase 1 Foundation
├── Logger Service (Structured logging)
├── Config Management (Centralized env vars)
├── Error Handling (Custom error classes)
├── Input Validation (Reusable validators)
└── Best Practices Documentation (Standards & patterns)
```

Once Phase 1 is complete, Phases 2-5 can proceed in parallel by different team members.

---

## Step 1: Create Enhanced Logger Service

**File:** `shared/utils/logger.js`  
**Current Status:** EXISTS, but needs enhancement  
**Effort:** 2 hours

### What to Add to Existing Logger

```javascript
/**
 * Logger service with structured output and performance tracking
 * 
 * Features:
 * - Multiple log levels (debug, info, warn, error)
 * - Contextual data attachment
 * - Performance metrics
 * - Request correlation IDs
 * - Graceful production mode (no debug logs)
 * 
 * @module shared/utils/logger
 * @example
 * const logger = createLogger('my-service');
 * logger.info('User logged in', { userId: '123' });
 * logger.metric('request_duration', 145);
 */

const { createWriteStream } = require('fs');
const { join } = require('path');

// Log level hierarchy
const LOG_LEVELS = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

// Current log level (debug in dev, info in prod)
const CURRENT_LEVEL = process.env.NODE_ENV === 'development' ? 0 : 1;

class Logger {
  /**
   * Create logger instance
   * 
   * @param {string} service - Service/module name
   * @param {object} options - Logger options
   * @param {string} options.logDir - Directory for log files (optional)
   */
  constructor(service, options = {}) {
    this.service = service;
    this.startTime = Date.now();
    this.logStream = null;

    // Create log file stream if logDir specified
    if (options.logDir) {
      const timestamp = new Date().toISOString().split('T')[0];
      const logFile = join(options.logDir, `${service}-${timestamp}.log`);
      this.logStream = createWriteStream(logFile, { flags: 'a' });
    }
  }

  /**
   * Format log message with timestamp and level
   * @private
   */
  _format(level, message, data) {
    const timestamp = new Date().toISOString();
    const uptime = Date.now() - this.startTime;
    
    return {
      timestamp,
      level,
      service: this.service,
      uptime,
      message,
      ...(data && typeof data === 'object' ? data : {})
    };
  }

  /**
   * Write formatted log
   * @private
   */
  _write(level, message, data) {
    if (LOG_LEVELS[level] < CURRENT_LEVEL) return;

    const formatted = this._format(level, message, data);
    const line = JSON.stringify(formatted);

    // Console output
    const color = this._getColorCode(level);
    console.log(`${color}[${formatted.timestamp}] ${level.toUpperCase()}: ${message}${'\x1b[0m'}`);
    if (data) console.log(JSON.stringify(data, null, 2));

    // File output (if enabled)
    if (this.logStream) {
      this.logStream.write(line + '\n');
    }
  }

  /**
   * Get ANSI color code for log level
   * @private
   */
  _getColorCode(level) {
    const colors = {
      debug: '\x1b[36m',  // Cyan
      info: '\x1b[32m',   // Green
      warn: '\x1b[33m',   // Yellow
      error: '\x1b[31m'   // Red
    };
    return colors[level] || '';
  }

  /**
   * Log debug-level message
   * Only output in development mode
   * 
   * @param {string} message - Message text
   * @param {object} data - Context data
   * 
   * @example
   * logger.debug('Processing event', { eventType: 'click', x: 100 });
   */
  debug(message, data) {
    this._write('debug', message, data);
  }

  /**
   * Log info-level message
   * Important business events
   * 
   * @param {string} message - Message text
   * @param {object} data - Context data
   * 
   * @example
   * logger.info('Campaign created', { campaignId: 'idle-123', name: 'Welcome' });
   */
  info(message, data) {
    this._write('info', message, data);
  }

  /**
   * Log warning
   * Unusual but handled situations
   * 
   * @param {string} message - Message text
   * @param {object} data - Context data
   * 
   * @example
   * logger.warn('Campaign already exists', { campaignId: 'idle-123' });
   */
  warn(message, data) {
    this._write('warn', message, data);
  }

  /**
   * Log error with stack trace
   * Something went wrong
   * 
   * @param {string} message - Message text
   * @param {Error} error - Error object
   * @param {object} data - Additional context
   * 
   * @example
   * logger.error('Upload failed', err, { fileName: 'test.mp4', size: 20000 });
   */
  error(message, error, data) {
    const errorData = {
      ...data,
      errorMessage: error?.message,
      errorStack: error?.stack?.split('\n').slice(0, 3) // First 3 lines only
    };
    this._write('error', message, errorData);
  }

  /**
   * Log performance metric
   * 
   * @param {string} operation - Operation name
   * @param {number} durationMs - Duration in milliseconds
   * @param {object} data - Optional context
   * 
   * @example
   * const start = Date.now();
   * await doWork();
   * logger.metric('database_query', Date.now() - start);
   */
  metric(operation, durationMs, data = {}) {
    const message = `[METRIC] ${operation}: ${durationMs}ms`;
    const metricData = {
      operation,
      duration_ms: durationMs,
      ...data
    };
    this._write('info', message, metricData);
  }

  /**
   * Close logger (cleanup file handles)
   */
  close() {
    if (this.logStream) {
      this.logStream.end();
    }
  }
}

/**
 * Factory function to create logger
 * 
 * @param {string} service - Service name
 * @param {object} options - Options
 * @returns {Logger}
 * 
 * @example
 * const logger = createLogger('admin-server');
 */
function createLogger(service, options = {}) {
  return new Logger(service, options);
}

module.exports = { createLogger, Logger };
```

### Tasks
- [ ] Copy existing logger.js backup
- [ ] Add Logger class with all methods
- [ ] Add color codes for console output
- [ ] Add optional file logging
- [ ] Add metric tracking method
- [ ] Test logger with all levels
- [ ] Update all requires to use new logger
- [ ] Add logger usage examples to README

**Verification:**
```bash
node -e "
const { createLogger } = require('./shared/utils/logger');
const logger = createLogger('test');
logger.info('Test info', { test: true });
logger.warn('Test warn');
logger.error('Test error', new Error('Test'), { context: 'data' });
logger.metric('test_op', 125);
"
```

---

## Step 2: Create Centralized Configuration

**File:** `shared/config/index.js` (NEW)  
**Effort:** 3 hours

### Implementation

```javascript
/**
 * Centralized configuration management
 * 
 * Responsibilities:
 * - Define all environment variables
 * - Validate on startup
 * - Provide typed access
 * - Generate documentation
 * 
 * @module shared/config
 * @example
 * const config = require('shared/config');
 * const port = config.get('ADMIN_PORT');
 * const adminUrl = config.getAdmin('publicUrl');
 */

const { createLogger } = require('../utils/logger');

const logger = createLogger('config');

/**
 * Environment variable schema
 * 
 * Each entry defines:
 * - type: 'string' | 'number' | 'boolean'
 * - default: default value if not set
 * - required: true/false (if required, must have default or env var)
 * - validate: optional validation function
 * - description: what this setting does
 */
const ENV_SCHEMA = {
  // ===== NODE.js ENVIRONMENT =====
  NODE_ENV: {
    type: 'string',
    enum: ['development', 'production', 'test'],
    default: 'production',
    description: 'Node environment'
  },

  // ===== ADMIN SERVICE CONFIG =====
  ADMIN_PORT: {
    type: 'number',
    default: 8081,
    min: 1,
    max: 65535,
    description: 'Admin HTTP server port'
  },

  IDS_ADMIN_DATA_DIR: {
    type: 'string',
    default: null,
    description: 'Admin data directory (defaults to admin/data)'
  },

  IDS_PUBLIC_ADMIN_URL: {
    type: 'string',
    default: null,
    description: 'Public URL for admin (for absolute URLs)'
  },

  // ===== PLAYER SERVICE CONFIG =====
  PLAYER_PORT: {
    type: 'number',
    default: 7070,
    min: 1,
    max: 65535,
    description: 'Player HTTP server port'
  },

  IDS_CONFIG: {
    type: 'string',
    default: 'shared/contract/examples/config.welcome.json',
    description: 'Path to player config file'
  },

  IDS_ADMIN_URL: {
    type: 'string',
    default: 'http://127.0.0.1:8081',
    description: 'URL of admin service (for sync)'
  },

  PLAYER_SYNC_INTERVAL_MS: {
    type: 'number',
    default: 4000,
    min: 1000,
    max: 60000,
    description: 'Interval for syncing config with admin'
  },

  // ===== SHARED CONFIG =====
  LOG_LEVEL: {
    type: 'string',
    enum: ['debug', 'info', 'warn', 'error'],
    default: 'info',
    description: 'Logging level'
  },

  LOG_DIR: {
    type: 'string',
    default: null,
    description: 'Directory for log files (optional)'
  }
};

/**
 * Configuration manager
 */
class Config {
  constructor() {
    this.schema = ENV_SCHEMA;
    this.values = {};
    this.errors = [];
    
    this.load();
    this.validate();
    
    if (this.errors.length > 0) {
      logger.error('Configuration validation failed', new Error('Invalid config'), {
        errors: this.errors
      });
      process.exit(1);
    }
  }

  /**
   * Load all config from environment
   * @private
   */
  load() {
    for (const [key, schema] of Object.entries(this.schema)) {
      const envValue = process.env[key];
      const value = envValue !== undefined ? this._coerce(envValue, schema.type) : schema.default;
      this.values[key] = value;
    }
  }

  /**
   * Validate all config values
   * @private
   */
  validate() {
    for (const [key, schema] of Object.entries(this.schema)) {
      const value = this.values[key];

      // Check required
      if (value === null || value === undefined) {
        if (schema.default === undefined) {
          this.errors.push(`${key}: required but not set`);
          continue;
        }
      }

      // Validate type
      if (value !== null && value !== undefined) {
        if (schema.enum && !schema.enum.includes(value)) {
          this.errors.push(`${key}: must be one of ${schema.enum.join(', ')}, got ${value}`);
        }

        if (schema.min !== undefined && value < schema.min) {
          this.errors.push(`${key}: minimum value is ${schema.min}, got ${value}`);
        }

        if (schema.max !== undefined && value > schema.max) {
          this.errors.push(`${key}: maximum value is ${schema.max}, got ${value}`);
        }
      }
    }
  }

  /**
   * Coerce string to type
   * @private
   */
  _coerce(value, type) {
    if (type === 'number') {
      const n = Number(value);
      return Number.isFinite(n) ? n : NaN;
    }
    if (type === 'boolean') {
      return value === 'true' || value === '1' || value === 'yes';
    }
    return String(value);
  }

  /**
   * Get config value
   * 
   * @param {string} key - Config key
   * @returns {*} Config value
   * 
   * @example
   * const port = config.get('ADMIN_PORT');
   */
  get(key) {
    if (!(key in this.values)) {
      logger.warn(`Config key not found: ${key}`);
      return undefined;
    }
    return this.values[key];
  }

  /**
   * Get all admin-specific config
   * @returns {object}
   */
  getAdmin() {
    return {
      port: this.get('ADMIN_PORT'),
      dataDir: this.get('IDS_ADMIN_DATA_DIR'),
      publicUrl: this.get('IDS_PUBLIC_ADMIN_URL'),
      logDir: this.get('LOG_DIR')
    };
  }

  /**
   * Get all player-specific config
   * @returns {object}
   */
  getPlayer() {
    return {
      port: this.get('PLAYER_PORT'),
      configFile: this.get('IDS_CONFIG'),
      adminUrl: this.get('IDS_ADMIN_URL'),
      syncIntervalMs: this.get('PLAYER_SYNC_INTERVAL_MS'),
      logDir: this.get('LOG_DIR')
    };
  }

  /**
   * Dump config for debugging (hides sensitive values)
   * @returns {string}
   */
  dump() {
    const dump = {};
    for (const [key, value] of Object.entries(this.values)) {
      if (key.includes('PASSWORD') || key.includes('TOKEN') || key.includes('SECRET')) {
        dump[key] = '***REDACTED***';
      } else {
        dump[key] = value;
      }
    }
    return JSON.stringify(dump, null, 2);
  }
}

// Singleton instance
let instance = null;

/**
 * Get or create config instance
 * @returns {Config}
 */
function getConfig() {
  if (!instance) {
    instance = new Config();
    logger.info('Configuration loaded', {
      env: instance.get('NODE_ENV'),
      adminPort: instance.get('ADMIN_PORT'),
      playerPort: instance.get('PLAYER_PORT')
    });
  }
  return instance;
}

module.exports = {
  getConfig,
  Config,
  ENV_SCHEMA
};
```

### Tasks
- [ ] Create shared/config/index.js
- [ ] Add all environment variables to schema
- [ ] Add validation logic
- [ ] Add type coercion
- [ ] Add dump() method for debugging
- [ ] Update admin/src/index.js to use config
- [ ] Update player/src/index.js to use config
- [ ] Test config with valid/invalid values
- [ ] Create .env.example with all variables documented

**Verification:**
```bash
# Should load default config
node -e "const { getConfig } = require('./shared/config'); console.log(getConfig().dump());"

# Should fail with bad port
ADMIN_PORT=99999 node admin/src/index.js  # Should error

# Should work with good port
ADMIN_PORT=9000 node admin/src/index.js  # Should start
```

---

## Step 3: Create Error Handling Framework

**File:** `shared/errors/index.js` (NEW)  
**Effort:** 2 hours

### Implementation

```javascript
/**
 * Custom error classes for type-safe error handling
 * 
 * Provides:
 * - Error type hierarchy
 * - Standardized error fields
 * - HTTP status mapping
 * - Error-to-response conversion
 * 
 * @module shared/errors
 * @example
 * throw new ValidationError([
 *   { field: 'email', message: 'Invalid email' }
 * ]);
 */

/**
 * Base application error
 * 
 * All application errors extend this class to provide:
 * - error code (machine-readable)
 * - issues (array of field-level errors)
 * - timestamp (when error occurred)
 * 
 * @class AppError
 */
class AppError extends Error {
  /**
   * @param {string} code - Machine-readable error code
   * @param {string} message - Human-readable message
   * @param {object} details - Additional error context
   */
  constructor(code, message, details = {}) {
    super(message);
    this.code = code;
    this.details = details;
    this.timestamp = new Date().toISOString();
    this.name = this.constructor.name;
  }

  /**
   * Convert error to JSON response
   * @returns {object}
   */
  toJSON() {
    return {
      error: this.code,
      message: this.message,
      timestamp: this.timestamp,
      ...(Object.keys(this.details).length > 0 && { details: this.details })
    };
  }
}

/**
 * Validation error - 400 Bad Request
 * 
 * Used when input validation fails
 * 
 * @class ValidationError
 * @example
 * throw new ValidationError([
 *   { field: 'name', message: 'Name is required' },
 *   { field: 'email', message: 'Invalid email format' }
 * ]);
 */
class ValidationError extends AppError {
  /**
   * @param {Array<{field: string, message: string}>} issues
   */
  constructor(issues = []) {
    super('VALIDATION_ERROR', 'Validation failed', { issues });
    this.issues = issues;
    this.statusCode = 400;
  }
}

/**
 * Not found error - 404 Not Found
 * 
 * Used when resource doesn't exist
 * 
 * @class NotFoundError
 * @example
 * throw new NotFoundError('Campaign', 'idle-123');
 */
class NotFoundError extends AppError {
  /**
   * @param {string} resource - Resource type
   * @param {string} id - Resource ID
   */
  constructor(resource, id) {
    super('NOT_FOUND', `${resource} not found: ${id}`, { resource, id });
    this.statusCode = 404;
  }
}

/**
 * Conflict error - 409 Conflict
 * 
 * Used when resource already exists or state conflict
 * 
 * @class ConflictError
 * @example
 * throw new ConflictError('Campaign', 'idle-123', 'already exists');
 */
class ConflictError extends AppError {
  /**
   * @param {string} resource - Resource type
   * @param {string} id - Resource ID
   * @param {string} reason - Reason for conflict
   */
  constructor(resource, id, reason) {
    super('CONFLICT', `${resource} conflict: ${reason}`, { resource, id, reason });
    this.statusCode = 409;
  }
}

/**
 * Internal server error - 500
 * 
 * Used for unexpected errors
 * 
 * @class InternalError
 * @example
 * throw new InternalError('Database connection failed', { connectionString: '...' });
 */
class InternalError extends AppError {
  /**
   * @param {string} message - Error message
   * @param {object} details - Error context (safe to log)
   */
  constructor(message, details = {}) {
    super('INTERNAL_ERROR', message, details);
    this.statusCode = 500;
  }
}

/**
 * Convert any error to HTTP response
 * 
 * Maps error types to HTTP status codes
 * Hides sensitive information from client
 * 
 * @param {Error} error - Error to convert
 * @returns {object} { statusCode, body }
 * 
 * @example
 * const { statusCode, body } = errorToResponse(error);
 * res.writeHead(statusCode);
 * res.end(JSON.stringify(body));
 */
function errorToResponse(error) {
  // Known error types - expose details
  if (error instanceof ValidationError) {
    return {
      statusCode: 400,
      body: {
        error: error.code,
        message: error.message,
        issues: error.issues
      }
    };
  }

  if (error instanceof NotFoundError) {
    return {
      statusCode: 404,
      body: {
        error: error.code,
        message: error.message
      }
    };
  }

  if (error instanceof ConflictError) {
    return {
      statusCode: 409,
      body: {
        error: error.code,
        message: error.message
      }
    };
  }

  if (error instanceof InternalError) {
    return {
      statusCode: 500,
      body: {
        error: error.code,
        message: error.message
      }
    };
  }

  // Unknown error - generic response
  return {
    statusCode: 500,
    body: {
      error: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred'
    }
  };
}

module.exports = {
  AppError,
  ValidationError,
  NotFoundError,
  ConflictError,
  InternalError,
  errorToResponse
};
```

### Tasks
- [ ] Create shared/errors/index.js with all error classes
- [ ] Add toJSON() method for logging
- [ ] Add statusCode property to each error
- [ ] Add errorToResponse() utility function
- [ ] Update all error throws to use new classes
- [ ] Test error-to-response conversion
- [ ] Test HTTP responses for each error type
- [ ] Document error types in README

**Verification:**
```bash
node -e "
const { ValidationError, errorToResponse } = require('./shared/errors');
const err = new ValidationError([{ field: 'name', message: 'Required' }]);
console.log(JSON.stringify(errorToResponse(err), null, 2));
"
```

---

## Step 4: Create Input Validation Framework

**File:** `shared/validation/index.js` (NEW)  
**Effort:** 2 hours

### Implementation

```javascript
/**
 * Input validation utilities
 * 
 * Provides reusable validators for common scenarios:
 * - Campaign validation
 * - Event validation
 * - Media file validation
 * - Field-level validation
 * 
 * @module shared/validation
 * @example
 * const { ValidationError } = require('shared/errors');
 * const { validateCampaign } = require('shared/validation');
 * 
 * try {
 *   const validated = validateCampaign(data);
 * } catch (err) {
 *   if (err instanceof ValidationError) {
 *     console.log(err.issues);
 *   }
 * }
 */

const { ValidationError } = require('../errors');

/**
 * Field-level validation rule
 * @typedef {object} ValidationRule
 * @property {string} type - 'string' | 'number' | 'array' | 'object'
 * @property {boolean} required - Field is required
 * @property {*} default - Default value if not provided
 * @property {number} minLength - Min string length
 * @property {number} maxLength - Max string length
 * @property {number} min - Min number value
 * @property {number} max - Max number value
 * @property {Array} enum - Allowed values
 * @property {Function} custom - Custom validation function
 */

/**
 * Validate a single field against rules
 * 
 * @param {string} fieldName - Field name
 * @param {*} value - Field value
 * @param {ValidationRule} rules - Validation rules
 * @returns {object} { valid: boolean, error?: string, value: * }
 * 
 * @example
 * const { valid, error, value } = validateField('email', 'test@example.com', {
 *   type: 'string',
 *   required: true,
 *   minLength: 5
 * });
 */
function validateField(fieldName, value, rules = {}) {
  const { type = 'string', required = false, default: defaultValue } = rules;

  // Apply default if not provided
  if (value === undefined || value === null) {
    if (required && defaultValue === undefined) {
      return {
        valid: false,
        error: 'required',
        value: undefined
      };
    }
    value = defaultValue;
  }

  // Type checking
  if (value !== null && value !== undefined) {
    const actualType = Array.isArray(value) ? 'array' : typeof value;
    if (actualType !== type) {
      return {
        valid: false,
        error: `invalid_type (expected ${type}, got ${actualType})`,
        value
      };
    }

    // String validation
    if (type === 'string') {
      if (rules.minLength && value.length < rules.minLength) {
        return {
          valid: false,
          error: `min_length (minimum ${rules.minLength} characters)`,
          value
        };
      }
      if (rules.maxLength && value.length > rules.maxLength) {
        return {
          valid: false,
          error: `max_length (maximum ${rules.maxLength} characters)`,
          value
        };
      }
      if (rules.enum && !rules.enum.includes(value)) {
        return {
          valid: false,
          error: `invalid_value (must be one of: ${rules.enum.join(', ')})`,
          value
        };
      }
    }

    // Number validation
    if (type === 'number') {
      if (rules.min !== undefined && value < rules.min) {
        return {
          valid: false,
          error: `min_value (minimum ${rules.min})`,
          value
        };
      }
      if (rules.max !== undefined && value > rules.max) {
        return {
          valid: false,
          error: `max_value (maximum ${rules.max})`,
          value
        };
      }
    }

    // Custom validation
    if (rules.custom) {
      const customError = rules.custom(value);
      if (customError) {
        return {
          valid: false,
          error: customError,
          value
        };
      }
    }
  }

  return { valid: true, value };
}

/**
 * Validate object against schema
 * 
 * @param {object} data - Data to validate
 * @param {object} schema - Validation schema (field -> rules)
 * @returns {object} { valid: boolean, errors: [], value: object }
 * 
 * @example
 * const { valid, errors, value } = validateObject(
 *   { name: 'Test', age: 25 },
 *   {
 *     name: { type: 'string', required: true, minLength: 1 },
 *     age: { type: 'number', min: 0, max: 150 }
 *   }
 * );
 */
function validateObject(data, schema) {
  const errors = [];
  const validated = {};

  for (const [field, rules] of Object.entries(schema)) {
    const result = validateField(field, data?.[field], rules);
    
    if (!result.valid) {
      errors.push({
        field,
        message: result.error
      });
    } else {
      validated[field] = result.value;
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    value: validated
  };
}

/**
 * Validate campaign data
 * 
 * @param {object} data - Campaign data
 * @returns {object} Validated campaign
 * @throws {ValidationError}
 * 
 * @example
 * const campaign = validateCampaign({
 *   campaignName: 'Welcome',
 *   kind: 'idle',
 *   items: []
 * });
 */
function validateCampaign(data) {
  const schema = {
    campaignName: {
      type: 'string',
      required: true,
      minLength: 1,
      maxLength: 200
    },
    kind: {
      type: 'string',
      required: true,
      enum: ['idle', 'visitor', 'student']
    },
    items: {
      type: 'array',
      required: true,
      custom: (items) => {
        if (items.length === 0) return 'At least one item required';
        if (!Array.isArray(items)) return 'Items must be array';
      }
    }
  };

  const result = validateObject(data, schema);

  if (!result.valid) {
    throw new ValidationError(result.errors);
  }

  return result.value;
}

/**
 * Validate event data
 * 
 * @param {object} event - Event data
 * @returns {object} Validated event
 * @throws {ValidationError}
 * 
 * @example
 * const event = validateEvent({
 *   type: 'movement_detected',
 *   timestamp: Date.now()
 * });
 */
function validateEvent(event) {
  const schema = {
    type: {
      type: 'string',
      required: true,
      enum: ['movement_detected', 'visitor_selected', 'nfc_tap', 'scroll_next', 'scroll_prev']
    }
  };

  const result = validateObject(event, schema);

  if (!result.valid) {
    throw new ValidationError(result.errors);
  }

  return result.value;
}

/**
 * Validate media file upload
 * 
 * @param {object} file - File object { buffer, mimeType, size }
 * @throws {ValidationError}
 * 
 * @example
 * validateMediaUpload({
 *   buffer: Buffer.from(...),
 *   mimeType: 'image/png',
 *   size: 1024000
 * });
 */
function validateMediaUpload(file) {
  const errors = [];

  // Check mime type
  const allowedMimes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 
                        'video/mp4', 'video/webm', 'video/quicktime'];
  if (!allowedMimes.includes(file.mimeType)) {
    errors.push({
      field: 'mimeType',
      message: `Unsupported file type: ${file.mimeType}`
    });
  }

  // Check size (max 20MB)
  const MAX_SIZE = 20 * 1024 * 1024;
  if (file.size > MAX_SIZE) {
    errors.push({
      field: 'size',
      message: `File too large (max 20MB, got ${Math.round(file.size / 1024 / 1024)}MB)`
    });
  }

  // Check buffer exists
  if (!file.buffer || file.buffer.length === 0) {
    errors.push({
      field: 'buffer',
      message: 'File is empty'
    });
  }

  if (errors.length > 0) {
    throw new ValidationError(errors);
  }
}

module.exports = {
  validateField,
  validateObject,
  validateCampaign,
  validateEvent,
  validateMediaUpload
};
```

### Tasks
- [ ] Create shared/validation/index.js
- [ ] Implement validateField() for reusable rules
- [ ] Implement validateObject() for schemas
- [ ] Add campaign validation
- [ ] Add event validation
- [ ] Add media file validation
- [ ] Test validation with valid/invalid data
- [ ] Test error messages are clear
- [ ] Document validation schema format

**Verification:**
```bash
node -e "
const { validateCampaign } = require('./shared/validation');
try {
  validateCampaign({ campaignName: '', kind: 'idle', items: [] });
} catch (err) {
  console.log(JSON.stringify(err.issues, null, 2));
}
"
```

---

## Step 5: Create Coding Standards Document

**File:** `CODING_STANDARDS.md` (NEW)  
**Effort:** 1 hour

This goes in the root of the project and establishes patterns for:
- Naming conventions
- Function/class structure
- JSDoc requirements
- Error handling
- Logging patterns
- Testing patterns

See: `REFACTORING_QUICK_GUIDE.md` > "Common Patterns" section for templates to use.

### Tasks
- [ ] Create CODING_STANDARDS.md in root
- [ ] Add naming convention section
- [ ] Add JSDoc templates
- [ ] Add error handling patterns
- [ ] Add logging patterns
- [ ] Add file organization
- [ ] Add testing patterns
- [ ] Share with team

---

## Step 6: Update All Imports and Services

**Effort:** 2 hours

Update all services to use new infrastructure:

### In admin/src/index.js
```javascript
const { createLogger } = require('../../shared/utils/logger');
const { getConfig } = require('../../shared/config');
const { createServer } = require('./server');

const logger = createLogger('ids-admin');
const config = getConfig();

const adminConfig = config.getAdmin();
createServer({
  port: adminConfig.port,
  dataDir: adminConfig.dataDir,
  publicUrl: adminConfig.publicUrl
});

logger.info('Admin service started', { port: adminConfig.port });
```

### In player/src/index.js
```javascript
const { createLogger } = require('../../shared/utils/logger');
const { getConfig } = require('../../shared/config');
const { createServer } = require('./server');

const logger = createLogger('ids-player');
const config = getConfig();

const playerConfig = config.getPlayer();
createServer({
  port: playerConfig.port,
  configFile: playerConfig.configFile,
  adminUrl: playerConfig.adminUrl,
  syncIntervalMs: playerConfig.syncIntervalMs
});

logger.info('Player service started', { port: playerConfig.port });
```

### Tasks
- [ ] Update admin/src/index.js
- [ ] Update player/src/index.js
- [ ] Update admin/src/server.js to use logger
- [ ] Update player/src/server.js to use logger
- [ ] Update admin/src/storage.js to use logger
- [ ] Update all storage error throws to use ValidationError
- [ ] Remove old console.log statements
- [ ] Test both services start without errors

---

## Step 7: Create Unit Tests for Phase 1

**Directory:** `test/unit/phase1/`

```javascript
// test/unit/phase1/logger.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const { createLogger } = require('../../../shared/utils/logger');

test('Logger', async (t) => {
  const logger = createLogger('test-service');

  await t.test('info logs message', () => {
    logger.info('Test message', { data: 'value' });
    // Output should contain message
  });

  await t.test('error logs with stack', () => {
    logger.error('Error message', new Error('Test'), { context: 'data' });
    // Output should contain error details
  });

  await t.test('metric logs timing', () => {
    logger.metric('test_op', 125);
    // Output should contain duration
  });
});

// test/unit/phase1/config.test.js
test('Config', async (t) => {
  await t.test('getConfig returns singleton', () => {
    const c1 = require('../../../shared/config').getConfig();
    const c2 = require('../../../shared/config').getConfig();
    assert.equal(c1, c2);
  });

  await t.test('get returns correct values', () => {
    const config = require('../../../shared/config').getConfig();
    const port = config.get('ADMIN_PORT');
    assert.equal(typeof port, 'number');
  });
});

// test/unit/phase1/errors.test.js
test('Errors', async (t) => {
  const { ValidationError, errorToResponse } = require('../../../shared/errors');

  await t.test('ValidationError contains issues', () => {
    const err = new ValidationError([{ field: 'name', message: 'Required' }]);
    assert.equal(err.issues.length, 1);
    assert.equal(err.statusCode, 400);
  });

  await t.test('errorToResponse maps status codes', () => {
    const err = new ValidationError([]);
    const { statusCode, body } = errorToResponse(err);
    assert.equal(statusCode, 400);
    assert.equal(body.error, 'VALIDATION_ERROR');
  });
});

// test/unit/phase1/validation.test.js
test('Validation', async (t) => {
  const { validateField, validateCampaign } = require('../../../shared/validation');

  await t.test('validateField checks required', () => {
    const { valid, error } = validateField('name', undefined, { required: true });
    assert.equal(valid, false);
    assert.equal(error, 'required');
  });

  await t.test('validateCampaign rejects invalid data', () => {
    const { ValidationError } = require('../../../shared/errors');
    assert.throws(
      () => validateCampaign({ campaignName: '', kind: 'idle', items: [] }),
      ValidationError
    );
  });
});
```

### Tasks
- [ ] Create test/unit/phase1/ directory
- [ ] Create logger.test.js
- [ ] Create config.test.js
- [ ] Create errors.test.js
- [ ] Create validation.test.js
- [ ] Run tests: `npm test`
- [ ] All tests should pass
- [ ] Update package.json test script if needed

**Verification:**
```bash
npm test
# All phase 1 tests should pass ✓
```

---

## Completion Checklist

### Foundation Infrastructure
- [ ] Logger service complete and in use
- [ ] Configuration management working
- [ ] Error hierarchy implemented
- [ ] Input validation framework ready
- [ ] CODING_STANDARDS.md written

### Code Updates
- [ ] All services use new logger
- [ ] All services use new config
- [ ] All error throws use new error classes
- [ ] All validation uses new validators
- [ ] Removed all console.log statements

### Testing
- [ ] Unit tests for logger
- [ ] Unit tests for config
- [ ] Unit tests for errors
- [ ] Unit tests for validation
- [ ] All tests passing

### Documentation
- [ ] CODING_STANDARDS.md complete
- [ ] README updated with new patterns
- [ ] JSDoc examples added
- [ ] Configuration variables documented

### Quality
- [ ] Code review completed
- [ ] No console.log statements
- [ ] Proper error handling
- [ ] Logging at key points
- [ ] Performance acceptable

---

## Next Steps After Phase 1

Once Phase 1 is complete:

1. **Merge to main** - Create PR, get review, merge
2. **Tag version** - `git tag v0.1-foundation`
3. **Start Phase 2** - Admin refactor can now proceed
4. **Start Phase 3** - Player refactor can now proceed
5. **Parallel work** - Phases 2 & 3 can progress in parallel

---

## Troubleshooting

### Logger not producing output
**Check:** NODE_ENV value, LOG_LEVEL setting

### Config validation failing
**Check:** Environment variables set correctly, see .env.example

### Import errors after changes
**Check:** Relative paths match new file structure

### Tests failing
**Check:** Dependencies installed, Node version >= 18

---

## Summary

**Phase 1 provides:**
✅ Structured logging for troubleshooting  
✅ Centralized configuration management  
✅ Custom error handling framework  
✅ Reusable input validation  
✅ Coding standards and patterns  

**Time estimate:** 16 hours  
**Complexity:** Low-Medium  
**Risk:** Low (foundation layer, not changing existing logic)  

**Proceed to Phase 2 only after:**
- [ ] All tests passing
- [ ] Code reviewed
- [ ] Merged to main branch
- [ ] Team trained on new patterns


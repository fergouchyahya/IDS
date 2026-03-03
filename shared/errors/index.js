/**
 * Shared application error hierarchy.
 *
 * Responsibilities:
 * - Provide typed error classes with status codes.
 * - Normalize thrown errors to HTTP response payloads.
 */

/**
 * Base application error.
 */
class AppError extends Error {
  /**
   * Creates an app error.
   *
   * @param {string} code - Machine-readable error code.
   * @param {string} message - Human-readable message.
   * @param {number} statusCode - HTTP status code.
   * @param {object} [details={}] - Additional error details.
   */
  constructor(code, message, statusCode, details = {}) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
    this.timestamp = new Date().toISOString();
  }

  /**
   * Converts error to serializable payload.
   *
   * @returns {object} Error JSON payload.
   */
  toJSON() {
    return {
      error: this.code,
      message: this.message,
      ...(Object.keys(this.details).length > 0 ? { details: this.details } : {}),
      timestamp: this.timestamp,
    };
  }
}

/**
 * Validation error.
 */
class ValidationError extends AppError {
  /**
   * Creates validation error.
   *
   * @param {Array<object>} issues - Validation issues.
   */
  constructor(issues = []) {
    super("validation_failed", "Validation failed", 400, { issues });
    this.issues = issues;
  }
}

/**
 * Not found error.
 */
class NotFoundError extends AppError {
  /**
   * Creates not-found error.
   *
   * @param {string} resource - Resource name.
   * @param {string} id - Resource id.
   */
  constructor(resource, id) {
    super("not_found", `${resource} not found: ${id}`, 404, { resource, id });
  }
}

/**
 * Conflict error.
 */
class ConflictError extends AppError {
  /**
   * Creates conflict error.
   *
   * @param {string} message - Conflict message.
   * @param {object} [details={}] - Conflict details.
   */
  constructor(message, details = {}) {
    super("conflict", message, 409, details);
  }
}

/**
 * Internal error.
 */
class InternalError extends AppError {
  /**
   * Creates internal error.
   *
   * @param {string} [message='Internal server error'] - Error message.
   * @param {object} [details={}] - Error details.
   */
  constructor(message = "Internal server error", details = {}) {
    super("internal_error", message, 500, details);
  }
}

/**
 * Normalizes any error into HTTP status/body.
 *
 * @param {Error} error - Any thrown error.
 * @returns {{statusCode:number, body:object}} HTTP response payload.
 */
function errorToResponse(error) {
  if (error instanceof AppError) {
    return {
      statusCode: error.statusCode,
      body: error.toJSON(),
    };
  }

  return {
    statusCode: 500,
    body: new InternalError().toJSON(),
  };
}

module.exports = {
  AppError,
  ValidationError,
  NotFoundError,
  ConflictError,
  InternalError,
  errorToResponse,
};

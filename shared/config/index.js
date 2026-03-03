/**
 * Shared configuration manager.
 *
 * Responsibilities:
 * - Parse and validate environment variables.
 * - Provide typed configuration getters per service.
 */

const { ValidationError } = require("../errors");

/**
 * Environment variable schema.
 */
const ENV_SCHEMA = {
  NODE_ENV: { type: "string", default: "production", enum: ["development", "production", "test"] },
  ADMIN_PORT: { type: "number", default: 8081, min: 1, max: 65535 },
  PLAYER_PORT: { type: "number", default: 7070, min: 1, max: 65535 },
  IDS_CONFIG: { type: "string", default: "shared/contract/examples/config.welcome.json" },
  IDS_ADMIN_URL: { type: "string", default: "" },
  IDS_ADMIN_DATA_DIR: { type: "string", default: null },
  IDS_PUBLIC_ADMIN_URL: { type: "string", default: null },
  IDS_DETECTOR_CONFIG: { type: "string", default: "" },
  LOG_LEVEL: { type: "string", default: "info", enum: ["debug", "info", "warn", "error"] },
};

/**
 * Coerces raw env value to typed value.
 *
 * @param {string|undefined} value - Raw value.
 * @param {object} spec - Field spec.
 * @returns {*} Coerced value.
 */
function coerce(value, spec) {
  if (value === undefined || value === null || value === "") {
    return spec.default;
  }

  if (spec.type === "number") {
    const n = Number(value);
    return Number.isFinite(n) ? n : NaN;
  }

  if (spec.type === "boolean") {
    return value === "1" || value === "true" || value === "yes";
  }

  return String(value);
}

/**
 * Validates one key value against schema spec.
 *
 * @param {string} key - Config key.
 * @param {*} value - Coerced value.
 * @param {object} spec - Field spec.
 * @returns {Array<object>} Validation issues.
 */
function validateValue(key, value, spec) {
  const issues = [];

  if (value === null || value === undefined) {
    return issues;
  }

  if (spec.type === "number" && !Number.isFinite(value)) {
    issues.push({ path: key, message: `${key} must be a number`, code: "invalid_number" });
    return issues;
  }

  if (Array.isArray(spec.enum) && !spec.enum.includes(value)) {
    issues.push({ path: key, message: `${key} must be one of ${spec.enum.join(", ")}`, code: "invalid_enum" });
  }

  if (typeof spec.min === "number" && value < spec.min) {
    issues.push({ path: key, message: `${key} must be >= ${spec.min}`, code: "min" });
  }

  if (typeof spec.max === "number" && value > spec.max) {
    issues.push({ path: key, message: `${key} must be <= ${spec.max}`, code: "max" });
  }

  return issues;
}

/**
 * Config manager class.
 */
class Config {
  /**
   * Creates config instance and validates values.
   */
  constructor() {
    this.values = {};
    const issues = [];

    for (const [key, spec] of Object.entries(ENV_SCHEMA)) {
      const value = coerce(process.env[key], spec);
      this.values[key] = value;
      issues.push(...validateValue(key, value, spec));
    }

    if (issues.length > 0) {
      throw new ValidationError(issues);
    }
  }

  /**
   * Gets one config key.
   *
   * @param {string} key - Config key.
   * @returns {*} Config value.
   */
  get(key) {
    return this.values[key];
  }

  /**
   * Gets admin runtime config.
   *
   * @returns {object} Admin config.
   */
  getAdmin() {
    return {
      port: this.values.ADMIN_PORT,
      dataDir: this.values.IDS_ADMIN_DATA_DIR,
      publicUrl: this.values.IDS_PUBLIC_ADMIN_URL,
      nodeEnv: this.values.NODE_ENV,
      logLevel: this.values.LOG_LEVEL,
    };
  }

  /**
   * Gets player runtime config.
   *
   * @returns {object} Player config.
   */
  getPlayer() {
    return {
      port: this.values.PLAYER_PORT,
      configPath: this.values.IDS_CONFIG,
      adminUrl: this.values.IDS_ADMIN_URL,
      detectorConfigJson: this.values.IDS_DETECTOR_CONFIG,
      nodeEnv: this.values.NODE_ENV,
      logLevel: this.values.LOG_LEVEL,
    };
  }

  /**
   * Dumps safe config values.
   *
   * @returns {object} Config map.
   */
  dump() {
    return { ...this.values };
  }
}

let singleton = null;

/**
 * Returns singleton config instance.
 *
 * @returns {Config} Config instance.
 */
function getConfig() {
  if (!singleton) {
    singleton = new Config();
  }
  return singleton;
}

module.exports = {
  ENV_SCHEMA,
  Config,
  getConfig,
};

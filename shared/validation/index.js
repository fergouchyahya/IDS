/**
 * Shared validation helpers.
 *
 * Responsibilities:
 * - Provide field-level and object-level reusable validators.
 */

const { ValidationError } = require("../errors");

/**
 * Validates a single field against provided rules.
 *
 * @param {string} fieldName - Field name.
 * @param {*} value - Field value.
 * @param {object} [rules={}] - Validation rules.
 * @returns {{valid:boolean, value:*, error?:string}} Validation result.
 */
function validateField(fieldName, value, rules = {}) {
  const {
    type = "string",
    required = false,
    minLength,
    maxLength,
    min,
    max,
    enum: enumValues,
    custom,
    default: defaultValue,
  } = rules;

  let nextValue = value;

  if (nextValue === undefined || nextValue === null) {
    if (defaultValue !== undefined) nextValue = defaultValue;
    else if (required) return { valid: false, error: `${fieldName}: required`, value: nextValue };
    else return { valid: true, value: nextValue };
  }

  const actualType = Array.isArray(nextValue) ? "array" : typeof nextValue;
  if (actualType !== type) {
    return { valid: false, error: `${fieldName}: expected ${type} got ${actualType}`, value: nextValue };
  }

  if (type === "string") {
    const len = String(nextValue).length;
    if (Number.isInteger(minLength) && len < minLength) {
      return { valid: false, error: `${fieldName}: minLength ${minLength}`, value: nextValue };
    }
    if (Number.isInteger(maxLength) && len > maxLength) {
      return { valid: false, error: `${fieldName}: maxLength ${maxLength}`, value: nextValue };
    }
  }

  if (type === "number") {
    if (typeof min === "number" && nextValue < min) {
      return { valid: false, error: `${fieldName}: min ${min}`, value: nextValue };
    }
    if (typeof max === "number" && nextValue > max) {
      return { valid: false, error: `${fieldName}: max ${max}`, value: nextValue };
    }
  }

  if (Array.isArray(enumValues) && !enumValues.includes(nextValue)) {
    return { valid: false, error: `${fieldName}: invalid enum`, value: nextValue };
  }

  if (typeof custom === "function") {
    const customError = custom(nextValue);
    if (customError) {
      return { valid: false, error: `${fieldName}: ${customError}`, value: nextValue };
    }
  }

  return { valid: true, value: nextValue };
}

/**
 * Validates an object against a schema.
 *
 * @param {object} data - Object to validate.
 * @param {object} schema - Validation schema.
 * @returns {{valid:boolean, errors:Array<object>, value:object}} Validation result.
 */
function validateObject(data, schema) {
  const errors = [];
  const value = {};

  for (const [field, rules] of Object.entries(schema || {})) {
    const result = validateField(field, data?.[field], rules);
    if (!result.valid) {
      errors.push({ field, message: result.error });
    } else if (result.value !== undefined) {
      value[field] = result.value;
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    value,
  };
}

/**
 * Throws ValidationError when result is invalid.
 *
 * @param {{valid:boolean, errors:Array<object>, value:object}} result - Validation result.
 * @returns {object} Validated value.
 */
function assertValid(result) {
  if (!result.valid) {
    throw new ValidationError(result.errors.map((e) => ({ path: e.field, message: e.message, code: "invalid" })));
  }
  return result.value;
}

module.exports = {
  validateField,
  validateObject,
  assertValid,
};

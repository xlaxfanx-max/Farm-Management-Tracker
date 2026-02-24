/**
 * Shared form helpers used across modal and form components.
 * Centralizes repeated validation, type-coercion, and error-extraction logic.
 */

/**
 * Extract a human-readable error message from an Axios error response.
 * Handles DRF's various error formats (string, {detail}, {error}, field-level).
 */
export function extractErrorMessage(err, fallback = 'An error occurred') {
  const data = err.response?.data;
  if (!data) return err.message || fallback;
  if (typeof data === 'string') return data;
  if (data.detail) return data.detail;
  if (data.error) return data.error;
  const fieldErrors = Object.entries(data)
    .map(([field, errors]) => `${field}: ${Array.isArray(errors) ? errors.join(', ') : errors}`)
    .join('\n');
  return fieldErrors || fallback;
}

/**
 * Parse a value to float, returning defaultValue if empty/NaN.
 */
export function toFloat(value, defaultValue = null) {
  if (value === null || value === undefined || value === '') return defaultValue;
  const parsed = parseFloat(value);
  return isNaN(parsed) ? defaultValue : parsed;
}

/**
 * Parse a value to int, returning defaultValue if empty/NaN.
 */
export function toInt(value, defaultValue = null) {
  if (value === null || value === undefined || value === '') return defaultValue;
  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? defaultValue : parsed;
}

/**
 * Check that required fields are present.
 * Returns array of missing field names (empty = all valid).
 */
export function checkRequired(data, requiredFields) {
  return requiredFields.filter(field => {
    const val = data[field];
    return val === null || val === undefined || (typeof val === 'string' && !val.trim());
  });
}

/**
 * Phone number validation utilities for Indian mobile numbers
 */

/**
 * Validates and formats Indian phone numbers
 * Accepts: +919876543210, 9876543210, +91 98765 43210
 * Returns: +919876543210 (E.164 format)
 */
export function validateAndFormatIndianPhone(phone: string): string | null {
  // Remove all spaces, dashes, and parentheses
  let cleaned = phone.replace(/[\s\-\(\)]/g, '');
  
  // Handle different input formats
  if (cleaned.startsWith('+91')) {
    cleaned = cleaned.substring(3);
  } else if (cleaned.startsWith('91') && cleaned.length === 12) {
    cleaned = cleaned.substring(2);
  } else if (cleaned.startsWith('0')) {
    cleaned = cleaned.substring(1);
  }
  
  // Should have exactly 10 digits now
  if (!/^\d{10}$/.test(cleaned)) {
    return null;
  }
  
  // Validate Indian mobile number ranges (6-9 as first digit)
  const firstDigit = cleaned[0];
  if (!['6', '7', '8', '9'].includes(firstDigit)) {
    return null;
  }
  
  // Return in E.164 format
  return `+91${cleaned}`;
}

/**
 * Check if phone number is valid Indian mobile
 */
export function isValidIndianPhone(phone: string): boolean {
  return validateAndFormatIndianPhone(phone) !== null;
}

/**
 * Format phone for display: +91 98765 43210
 */
export function formatPhoneForDisplay(phone: string): string {
  const formatted = validateAndFormatIndianPhone(phone);
  if (!formatted) return phone;
  
  const digits = formatted.substring(3); // Remove +91
  return `+91 ${digits.substring(0, 5)} ${digits.substring(5)}`;
}

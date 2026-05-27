export const EMAIL_ERROR = 'Enter a valid email address';
export const PASSWORD_REQUIRED_ERROR = 'Password is required';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Returns an error message, or null when the email is well-formed. */
export const validateEmail = (email: string): string | null =>
  EMAIL_REGEX.test(email.trim()) ? null : EMAIL_ERROR;

/** Generic "required" check; returns `message` when the value is empty/whitespace. */
export const validateRequired = (value: string, message: string): string | null =>
  value.trim().length > 0 ? null : message;

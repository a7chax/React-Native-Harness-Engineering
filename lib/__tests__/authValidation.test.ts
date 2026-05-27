import {
  EMAIL_ERROR,
  validateEmail,
  validateRequired,
} from '../authValidation';

describe('validateEmail', () => {
  it('rejects empty and malformed emails', () => {
    expect(validateEmail('')).toBe(EMAIL_ERROR);
    expect(validateEmail('foo')).toBe(EMAIL_ERROR);
    expect(validateEmail('foo@bar')).toBe(EMAIL_ERROR);
    expect(validateEmail('foo @bar.com')).toBe(EMAIL_ERROR);
  });

  it('accepts well-formed emails and trims surrounding spaces', () => {
    expect(validateEmail('a@b.co')).toBeNull();
    expect(validateEmail('  john@example.com  ')).toBeNull();
  });
});

describe('validateRequired', () => {
  it('rejects empty / whitespace-only values with the given message', () => {
    expect(validateRequired('', 'Password is required')).toBe('Password is required');
    expect(validateRequired('   ', 'Password is required')).toBe('Password is required');
  });

  it('accepts any non-empty value', () => {
    expect(validateRequired('x', 'msg')).toBeNull();
    expect(validateRequired('hunter2', 'msg')).toBeNull();
  });
});

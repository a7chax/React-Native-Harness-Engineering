import {
  CONFIRM_PASSWORD_ERROR,
  EMAIL_ERROR,
  NAME_ERROR,
  PASSWORD_ERROR,
  isRegisterFormValid,
  validateConfirmPassword,
  validateEmail,
  validateName,
  validatePassword,
  validateRegisterForm,
} from '../validation';

describe('validateName', () => {
  it('rejects empty / whitespace-only names', () => {
    expect(validateName('')).toBe(NAME_ERROR);
    expect(validateName('   ')).toBe(NAME_ERROR);
  });

  it('rejects names shorter than 2 non-space characters', () => {
    expect(validateName('A')).toBe(NAME_ERROR);
    expect(validateName(' B ')).toBe(NAME_ERROR);
  });

  it('accepts names with at least 2 characters after trimming', () => {
    expect(validateName('Jo')).toBeNull();
    expect(validateName('  John Doe  ')).toBeNull();
  });
});

describe('validateEmail', () => {
  it('rejects empty and malformed emails', () => {
    expect(validateEmail('')).toBe(EMAIL_ERROR);
    expect(validateEmail('invalidemail')).toBe(EMAIL_ERROR);
    expect(validateEmail('foo@bar')).toBe(EMAIL_ERROR);
    expect(validateEmail('foo @bar.com')).toBe(EMAIL_ERROR);
  });

  it('accepts well-formed emails', () => {
    expect(validateEmail('john@example.com')).toBeNull();
    expect(validateEmail('a.b+c@sub.domain.co')).toBeNull();
  });
});

describe('validatePassword', () => {
  it('rejects passwords shorter than 8 characters', () => {
    expect(validatePassword('ab12')).toBe(PASSWORD_ERROR);
  });

  it('rejects passwords missing a letter or a number', () => {
    expect(validatePassword('12345678')).toBe(PASSWORD_ERROR);
    expect(validatePassword('abcdefgh')).toBe(PASSWORD_ERROR);
  });

  it('accepts passwords with >=8 chars including a letter and a number', () => {
    expect(validatePassword('password1')).toBeNull();
    expect(validatePassword('aB3xxxxx')).toBeNull();
  });
});

describe('validateConfirmPassword', () => {
  it('rejects when confirmation does not match the password', () => {
    expect(validateConfirmPassword('password1', 'password2')).toBe(CONFIRM_PASSWORD_ERROR);
  });

  it('accepts when confirmation matches the password', () => {
    expect(validateConfirmPassword('password1', 'password1')).toBeNull();
  });
});

describe('validateRegisterForm', () => {
  it('returns an error for every invalid field', () => {
    const errors = validateRegisterForm({
      name: 'A',
      email: 'bad',
      password: 'short',
      confirmPassword: 'nope',
    });

    expect(errors.name).toBe(NAME_ERROR);
    expect(errors.email).toBe(EMAIL_ERROR);
    expect(errors.password).toBe(PASSWORD_ERROR);
    expect(errors.confirmPassword).toBe(CONFIRM_PASSWORD_ERROR);
    expect(isRegisterFormValid(errors)).toBe(false);
  });

  it('returns no errors for a fully valid form', () => {
    const errors = validateRegisterForm({
      name: 'John Doe',
      email: 'john@example.com',
      password: 'password1',
      confirmPassword: 'password1',
    });

    expect(errors).toEqual({
      name: null,
      email: null,
      password: null,
      confirmPassword: null,
    });
    expect(isRegisterFormValid(errors)).toBe(true);
  });
});

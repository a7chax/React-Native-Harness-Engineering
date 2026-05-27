export const NAME_ERROR = 'Name must be at least 2 characters';
export const EMAIL_ERROR = 'Invalid email format';
export const PASSWORD_ERROR =
  'Password must be at least 8 characters and include a letter and a number';
export const CONFIRM_PASSWORD_ERROR = 'Passwords do not match';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface RegisterFormValues {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
}

export interface RegisterFormErrors {
  name: string | null;
  email: string | null;
  password: string | null;
  confirmPassword: string | null;
}

export const validateName = (name: string): string | null =>
  name.trim().length >= 2 ? null : NAME_ERROR;

export const validateEmail = (email: string): string | null =>
  EMAIL_REGEX.test(email) ? null : EMAIL_ERROR;

export const validatePassword = (password: string): string | null => {
  const longEnough = password.length >= 8;
  const hasLetter = /[A-Za-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  return longEnough && hasLetter && hasNumber ? null : PASSWORD_ERROR;
};

export const validateConfirmPassword = (
  password: string,
  confirmPassword: string
): string | null => (password === confirmPassword ? null : CONFIRM_PASSWORD_ERROR);

export const validateRegisterForm = (values: RegisterFormValues): RegisterFormErrors => ({
  name: validateName(values.name),
  email: validateEmail(values.email),
  password: validatePassword(values.password),
  confirmPassword: validateConfirmPassword(values.password, values.confirmPassword),
});

export const isRegisterFormValid = (errors: RegisterFormErrors): boolean =>
  Object.values(errors).every((error) => error === null);

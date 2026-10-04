export const APP = {
  packageName: "com.anonymous.reactnativeuitest",
  bundleId: "com.anonymous.reactnativeuitest",
};

export const VALID_LOGIN = {
  email: "john@example.com",
  password: "secret123",
};

export const VALID_REGISTRATION = {
  name: "John Doe",
  email: "john@example.com",
  password: "password1",
  confirmPassword: "password1",
};

/** Values the Home screen seeds into MMKV (see lib/storage/demoData.ts). */
export const STORED = {
  encrypted: { count: 10, userId: "usr_10293847", cardLast4: "4242" },
  plain: { count: 10, theme: "dark", currency: "IDR", appVersion: "1.0.0" },
};

export const TITLES = {
  login: "Welcome back",
  forgot: "Reset password",
  register: "Create account",
  home: "Home",
};

export const MESSAGES = {
  login: {
    invalidEmail: "Enter a valid email address",
    passwordRequired: "Password is required",
  },
  forgot: {
    invalidEmail: "Enter a valid email address",
    success: "If that email exists, a reset link has been sent.",
  },
  register: {
    name: "Name must be at least 2 characters",
    email: "Invalid email format",
    password:
      "Password must be at least 8 characters and include a letter and a number",
    confirmPassword: "Passwords do not match",
  },
  home: {
    welcome: "You're logged in 🎉",
  },
};

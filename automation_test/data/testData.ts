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

/**
 * The Now Playing screen's bundled tracks and the dcye lyric lines its spec
 * refers to (see lib/music/catalog.ts and lib/music/lyrics/dcye.ts).
 */
export const PLAYER = {
  dcye: {
    id: "dcye",
    title: "Don't Close Your Eyes",
    artist: "Josh Woodward",
    credit: 'Music: "Don\'t Close Your Eyes" by Josh Woodward, CC BY 4.0, transcoded to AAC',
    licenseUrl: "https://creativecommons.org/licenses/by/4.0/",
    pageUrl: "https://www.joshwoodward.com/song/DontCloseYourEyes",
    lastLine: 38,
    lines: {
      2: "Weak knees, and fresh scars",
      5: "They can only buy you time",
      6: "Light a candle, or curse the dark",
      7: "It's all the same to me",
      9: "And shake away the heat",
    },
  },
  lettingGo: { id: "letting-go", title: "I'm Letting Go" },
  tone: { id: "tone", noLyrics: "No lyrics for this track" },
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

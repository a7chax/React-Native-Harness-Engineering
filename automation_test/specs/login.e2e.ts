import { loginScreen, homeScreen, forgotPasswordScreen, registerScreen } from "../screens";
import { launchAppFresh } from "../helpers/app";
import { MESSAGES, VALID_LOGIN } from "../data/testData";

describe("Login", () => {
  beforeEach(async () => {
    await launchAppFresh();
    await loginScreen.waitUntilLoaded();
  });

  // Positive cases

  it("navigates to Home with valid credentials", async () => {
    await loginScreen.login(VALID_LOGIN.email, VALID_LOGIN.password);

    await homeScreen.waitUntilLoaded();
    await expect(homeScreen.root).toBeDisplayed();
  });

  it("accepts an email with surrounding spaces", async () => {
    await loginScreen.login(`  ${VALID_LOGIN.email}  `, VALID_LOGIN.password);

    await homeScreen.waitUntilLoaded();
    await expect(homeScreen.root).toBeDisplayed();
  });

  it("opens Forgot password from the link", async () => {
    await loginScreen.goToForgotPassword();

    await forgotPasswordScreen.waitUntilLoaded();
    await expect(forgotPasswordScreen.root).toBeDisplayed();
  });

  it("opens Register from the link", async () => {
    await loginScreen.goToRegister();

    await registerScreen.waitUntilLoaded();
    await expect(registerScreen.root).toBeDisplayed();
  });

  // Negative cases

  it("shows inline validation errors when submitting an empty form", async () => {
    await loginScreen.submit();

    expect(await loginScreen.emailErrorText()).toEqual(
      MESSAGES.login.invalidEmail
    );
    expect(await loginScreen.passwordErrorText()).toEqual(
      MESSAGES.login.passwordRequired
    );
  });

  it("shows only the email error for a malformed email", async () => {
    await loginScreen.login("john@example", VALID_LOGIN.password);

    expect(await loginScreen.emailErrorText()).toEqual(
      MESSAGES.login.invalidEmail
    );
    expect(await loginScreen.isShown("login-password-error")).toEqual(false);
    await expect(loginScreen.root).toBeDisplayed();
  });
});

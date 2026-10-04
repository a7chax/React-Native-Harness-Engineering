import { loginScreen, forgotPasswordScreen } from "../screens";
import { launchAppFresh } from "../helpers/app";
import { MESSAGES } from "../data/testData";

describe("Forgot password", () => {
  beforeEach(async () => {
    await launchAppFresh();
    await loginScreen.waitUntilLoaded();
    await loginScreen.goToForgotPassword();
    await forgotPasswordScreen.waitUntilLoaded();
  });

  // Positive cases

  it("shows the success message after requesting a reset with a valid email", async () => {
    await forgotPasswordScreen.requestReset("john@example.com");

    expect(await forgotPasswordScreen.isSuccessVisible()).toEqual(true);
    expect(await forgotPasswordScreen.successText()).toEqual(
      MESSAGES.forgot.success
    );
  });

  it("returns to Login from the Back to login link", async () => {
    await forgotPasswordScreen.backToLogin();

    await loginScreen.waitUntilLoaded();
    await expect(loginScreen.root).toBeDisplayed();
  });

  it("hides the success message once the email is edited", async () => {
    await forgotPasswordScreen.requestReset("john@example.com");
    expect(await forgotPasswordScreen.isSuccessVisible()).toEqual(true);

    await forgotPasswordScreen.fillEmail("jane@example.com");

    expect(await forgotPasswordScreen.isShown("forgot-success")).toEqual(false);
  });

  // Negative cases

  it("shows an inline error when submitting an empty form", async () => {
    await forgotPasswordScreen.submit();

    expect(await forgotPasswordScreen.emailErrorText()).toEqual(
      MESSAGES.forgot.invalidEmail
    );
  });

  it("rejects a malformed email without sending a reset link", async () => {
    await forgotPasswordScreen.requestReset("not-an-email");

    expect(await forgotPasswordScreen.emailErrorText()).toEqual(
      MESSAGES.forgot.invalidEmail
    );
    expect(await forgotPasswordScreen.isShown("forgot-success")).toEqual(false);
  });
});

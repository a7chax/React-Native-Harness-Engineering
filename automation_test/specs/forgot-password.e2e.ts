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

  it("shows an inline error when submitting an empty form", async () => {
    await forgotPasswordScreen.submit();

    expect(await forgotPasswordScreen.emailErrorText()).toEqual(
      MESSAGES.forgot.invalidEmail
    );
  });

  it("shows the success message after requesting a reset with a valid email", async () => {
    await forgotPasswordScreen.requestReset("john@example.com");

    expect(await forgotPasswordScreen.isSuccessVisible()).toEqual(true);
  });
});

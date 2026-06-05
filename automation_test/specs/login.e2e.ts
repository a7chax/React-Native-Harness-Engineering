import { loginScreen, homeScreen } from "../screens";
import { launchAppFresh } from "../helpers/app";
import { MESSAGES, VALID_LOGIN } from "../data/testData";

describe("Login", () => {
  beforeEach(async () => {
    await launchAppFresh();
    await loginScreen.waitUntilLoaded();
  });

  it("shows inline validation errors when submitting an empty form", async () => {
    await loginScreen.submit();

    expect(await loginScreen.emailErrorText()).toEqual(
      MESSAGES.login.invalidEmail
    );
    expect(await loginScreen.passwordErrorText()).toEqual(
      MESSAGES.login.passwordRequired
    );
  });

  it("navigates to Home with valid credentials", async () => {
    await loginScreen.login(VALID_LOGIN.email, VALID_LOGIN.password);

    await homeScreen.waitUntilLoaded();
    await expect(homeScreen.root).toBeDisplayed();
  });
});

import { loginScreen, registerScreen, homeScreen } from "../screens";
import { launchAppFresh } from "../helpers/app";
import { MESSAGES, VALID_REGISTRATION } from "../data/testData";

describe("Register", () => {
  beforeEach(async () => {
    await launchAppFresh();
    await loginScreen.waitUntilLoaded();
    await loginScreen.goToRegister();
    await registerScreen.waitUntilLoaded();
  });

  it("shows per-field validation errors for invalid input", async () => {
    await registerScreen.fillField("name", "A");
    expect(await registerScreen.errorText("name")).toEqual(
      MESSAGES.register.name
    );

    await registerScreen.fillField("email", "invalid_email");
    expect(await registerScreen.errorText("email")).toEqual(
      MESSAGES.register.email
    );

    await registerScreen.fillField("password", "short");
    expect(await registerScreen.isErrorVisible("password")).toEqual(true);
    expect(await registerScreen.errorText("password")).toEqual(
      MESSAGES.register.password
    );

    await registerScreen.fillField("confirmPassword", "different");
    expect(await registerScreen.errorText("confirmPassword")).toEqual(
      MESSAGES.register.confirmPassword
    );
  });

  it("navigates to Home after a fully valid submission", async () => {
    await registerScreen.fillForm(VALID_REGISTRATION);
    await registerScreen.submit();

    await homeScreen.waitUntilLoaded();
    await expect(homeScreen.root).toBeDisplayed();
  });
});

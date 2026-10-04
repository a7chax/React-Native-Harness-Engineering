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

  // Positive cases

  it("navigates to Home after a fully valid submission", async () => {
    await registerScreen.fillForm(VALID_REGISTRATION);
    await registerScreen.submit();

    await homeScreen.waitUntilLoaded();
    await expect(homeScreen.root).toBeDisplayed();
  });

  it("clears each field error once the value is corrected", async () => {
    await registerScreen.fillField("name", "A");
    expect(await registerScreen.isErrorVisible("name")).toEqual(true);
    await registerScreen.fillField("name", VALID_REGISTRATION.name);
    expect(await registerScreen.isShown("register-name-error")).toEqual(false);

    await registerScreen.fillField("email", "invalid_email");
    expect(await registerScreen.isErrorVisible("email")).toEqual(true);
    await registerScreen.fillField("email", VALID_REGISTRATION.email);
    expect(await registerScreen.isShown("register-email-error")).toEqual(false);
  });

  it("returns to Login with the Android back button", async () => {
    await driver.back();

    await loginScreen.waitUntilLoaded();
    await expect(loginScreen.root).toBeDisplayed();
  });

  // Negative cases

  it("shows every field error when submitting an empty form", async () => {
    await registerScreen.submit();

    expect(await registerScreen.errorText("name")).toEqual(MESSAGES.register.name);
    expect(await registerScreen.errorText("email")).toEqual(MESSAGES.register.email);
    expect(await registerScreen.errorText("password")).toEqual(
      MESSAGES.register.password
    );
    await expect(registerScreen.root).toBeDisplayed();
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

  it("rejects a password without a number", async () => {
    await registerScreen.fillForm({
      ...VALID_REGISTRATION,
      password: "passwordonly",
      confirmPassword: "passwordonly",
    });
    await registerScreen.submit();

    expect(await registerScreen.errorText("password")).toEqual(
      MESSAGES.register.password
    );
    await expect(registerScreen.root).toBeDisplayed();
  });
});

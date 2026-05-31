import { BaseScreen } from "./BaseScreen";
import { byTestId } from "../helpers/selectors";
import { setField, scrollIntoView } from "../helpers/gestures";

type RegisterField = "name" | "email" | "password" | "confirmPassword";

class RegisterScreen extends BaseScreen {
  readonly rootTestId = "register-screen";

  private fieldTestId(field: RegisterField): string {
    switch (field) {
      case "name":
        return "register-name-input";
      case "email":
        return "register-email-input";
      case "password":
        return "register-password-input";
      case "confirmPassword":
        return "register-confirm-password-input";
    }
  }

  private errorTestId(field: RegisterField): string {
    switch (field) {
      case "name":
        return "register-name-error";
      case "email":
        return "register-email-error";
      case "password":
        return "register-password-error";
      case "confirmPassword":
        return "register-confirm-password-error";
    }
  }

  async fillField(field: RegisterField, value: string): Promise<void> {
    const testId = this.fieldTestId(field);
    await scrollIntoView(testId);
    await setField(byTestId(testId), value);
  }

  async fillForm(values: {
    name: string;
    email: string;
    password: string;
    confirmPassword: string;
  }): Promise<void> {
    await this.fillField("name", values.name);
    await this.fillField("email", values.email);
    await this.fillField("password", values.password);
    await this.fillField("confirmPassword", values.confirmPassword);
  }

  async scrollToSubmit(): Promise<void> {
    await scrollIntoView("register-submit-button");
  }

  async submit(): Promise<void> {
    await this.scrollToSubmit();
    const button = this.el("register-submit-button");
    await button.waitForDisplayed({ timeout: 15000 });
    await button.click();
  }

  async errorText(field: RegisterField): Promise<string> {
    return this.textOf(this.errorTestId(field));
  }

  async isErrorVisible(field: RegisterField): Promise<boolean> {
    const error = this.el(this.errorTestId(field));
    try {
      await error.waitForDisplayed({ timeout: 15000 });
    } catch {
      return false;
    }
    return error.isDisplayed();
  }
}

export default new RegisterScreen();

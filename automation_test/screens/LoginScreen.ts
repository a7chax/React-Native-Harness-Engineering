import { BaseScreen } from "./BaseScreen";
import { byTestId } from "../helpers/selectors";
import { setField } from "../helpers/gestures";

class LoginScreen extends BaseScreen {
  readonly rootTestId = "login-screen";

  async fillEmail(v: string): Promise<void> {
    await setField(byTestId("login-email-input"), v);
  }

  async fillPassword(v: string): Promise<void> {
    await setField(byTestId("login-password-input"), v);
  }

  async submit(): Promise<void> {
    const button = this.el("login-submit-button");
    await button.waitForDisplayed({ timeout: 15000 });
    await button.click();
  }

  async login(email: string, password: string): Promise<void> {
    await this.fillEmail(email);
    await this.fillPassword(password);
    await this.submit();
  }

  async emailErrorText(): Promise<string> {
    return this.textOf("login-email-error");
  }

  async passwordErrorText(): Promise<string> {
    return this.textOf("login-password-error");
  }

  async goToForgotPassword(): Promise<void> {
    const link = this.el("login-to-forgot");
    await link.waitForDisplayed({ timeout: 15000 });
    await link.click();
  }

  async goToRegister(): Promise<void> {
    const link = this.el("login-to-register");
    await link.waitForDisplayed({ timeout: 15000 });
    await link.click();
  }
}

export default new LoginScreen();

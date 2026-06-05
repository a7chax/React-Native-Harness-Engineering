import { BaseScreen } from "./BaseScreen";
import { byTestId } from "../helpers/selectors";
import { setField } from "../helpers/gestures";

class ForgotPasswordScreen extends BaseScreen {
  readonly rootTestId = "forgot-screen";

  async fillEmail(v: string): Promise<void> {
    await setField(byTestId("forgot-email-input"), v);
  }

  async submit(): Promise<void> {
    const button = this.el("forgot-submit-button");
    await button.waitForDisplayed({ timeout: 15000 });
    await button.click();
  }

  async requestReset(email: string): Promise<void> {
    await this.fillEmail(email);
    await this.submit();
  }

  async emailErrorText(): Promise<string> {
    return this.textOf("forgot-email-error");
  }

  async isSuccessVisible(): Promise<boolean> {
    const success = this.el("forgot-success");
    try {
      await success.waitForDisplayed({ timeout: 15000 });
    } catch {
      return false;
    }
    return success.isDisplayed();
  }

  async backToLogin(): Promise<void> {
    const link = this.el("forgot-to-login");
    await link.waitForDisplayed({ timeout: 15000 });
    await link.click();
  }
}

export default new ForgotPasswordScreen();

import { BaseScreen } from "./BaseScreen";

class HomeScreen extends BaseScreen {
  readonly rootTestId = "home-screen";

  async welcomeText(): Promise<string> {
    return this.textOf("home-welcome");
  }

  async logout(): Promise<void> {
    const button = this.el("logout-button");
    await button.waitForDisplayed({ timeout: 15000 });
    await button.click();
  }
}

export default new HomeScreen();

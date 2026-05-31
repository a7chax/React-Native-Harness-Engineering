import type { ChainablePromiseElement } from "webdriverio";
import { byTestId } from "../helpers/selectors";

export abstract class BaseScreen {
  abstract readonly rootTestId: string;

  get root(): ChainablePromiseElement {
    return $(byTestId(this.rootTestId));
  }

  async waitUntilLoaded(timeout = 20000): Promise<void> {
    await this.root.waitForDisplayed({ timeout });
  }

  async isLoaded(): Promise<boolean> {
    return this.root.isDisplayed();
  }

  protected el(testId: string): ChainablePromiseElement {
    return $(byTestId(testId));
  }

  protected async textOf(testId: string): Promise<string> {
    const element = this.el(testId);
    await element.waitForDisplayed({ timeout: 15000 });
    return element.getText();
  }
}

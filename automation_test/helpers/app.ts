import { APP } from "../data/testData";

/**
 * Launch the app from a clean state: terminate the running instance (if any)
 * then activate it again. terminateApp is effectively a no-op when the app is
 * not running, so this is safe to call in every beforeEach.
 */
export async function launchAppFresh(): Promise<void> {
  await driver.execute("mobile: terminateApp", { appId: APP.packageName });
  await driver.execute("mobile: activateApp", { appId: APP.packageName });
}

/**
 * Restart the app. Alias delegating to launchAppFresh.
 */
export async function restartApp(): Promise<void> {
  await launchAppFresh();
}

import { scrollToTestId } from "./selectors";

/**
 * Hide the soft keyboard if it is currently shown. Both the query and the hide
 * action are guarded because some drivers throw when the keyboard cannot be
 * detected/dismissed; a failure here must never fail the test.
 */
export async function hideKeyboardIfVisible(): Promise<void> {
  try {
    if (await driver.isKeyboardShown()) {
      await driver.hideKeyboard();
    }
  } catch {
    // Swallow: keyboard state is best-effort.
  }
}

/**
 * Robustly set the value of a text field:
 * wait for it, focus it, attempt to clear any existing value, type the new
 * value, then dismiss the keyboard so it does not obscure later elements.
 */
export async function setField(selector: string, value: string): Promise<void> {
  const el = $(selector);
  await el.waitForDisplayed({ timeout: 15000 });
  await el.click();
  try {
    await el.clearValue();
  } catch {
    // Some fields/drivers reject clearValue when already empty; ignore.
  }
  await el.setValue(value);
  await hideKeyboardIfVisible();
}

/**
 * Scroll an element identified by testID into view.
 * - Android: resolving the UiScrollable selector triggers the scroll. Guarded
 *   because the element may already be on-screen (or non-scrollable container).
 * - iOS: no-op (handled defensively; flows under test fit on screen).
 */
export async function scrollIntoView(testId: string): Promise<void> {
  if (driver.isIOS) {
    return;
  }
  try {
    await $(scrollToTestId(testId));
  } catch {
    // Already visible or nothing to scroll; ignore.
  }
}

import { test, expect, type Locator, type Page } from '@playwright/test';
import { selectDay } from './calendar';

const COACH_NAME = 'Gabriel';
const TARGET_YEAR = 2026;
const TARGET_MONTH = 'August';
const TARGET_DAY = '12';

test.use({ timezoneId: 'Asia/Saigon' });

async function selectCoach(page: Page) {
  await page.getByRole('radio', { name: new RegExp(COACH_NAME, 'i') }).click();
}

async function selectTargetDate(page: Page) {
  await selectDay(page, new RegExp(`${TARGET_MONTH} ${TARGET_YEAR}`, 'i'), TARGET_DAY);
}

function toastTitle(page: Page, title: string) {
  return page.getByText(title, { exact: true });
}

test.describe('error toasts carry a per-flow title, not a generic "Error"', () => {
  test('Availability Error when /api/bookings/paid returns 500', async ({ page }) => {
    await page.route('**/api/bookings/paid**', route =>
      route.fulfill({ status: 500, body: 'forced availability failure' })
    );

    await page.goto('/');
    await selectCoach(page);
    await selectTargetDate(page);

    await expect(toastTitle(page, 'Availability Error')).toBeVisible({ timeout: 15_000 });
    await expect(toastTitle(page, 'Error')).toHaveCount(0);
  });

  test('Availability Error when the slots request fails at the network level', async ({ page }) => {
    await page.route('**/api/bookings/paid**', route => route.abort('failed'));

    await page.goto('/');
    await selectCoach(page);
    await selectTargetDate(page);

    await expect(toastTitle(page, 'Availability Error')).toBeVisible({ timeout: 15_000 });
    await expect(toastTitle(page, 'Error')).toHaveCount(0);
  });

  test('Checkout Error when POST /api/checkout returns 500', async ({ page }) => {
    await page.route('**/api/checkout', async route => {
      if (route.request().method() !== 'POST') {
        await route.continue();
        return;
      }
      await route.fulfill({ status: 500, body: 'forced checkout failure' });
    });

    await page.goto('/');
    await selectCoach(page);
    await selectTargetDate(page);

    const timeSlots = page.getByRole('radio', { name: /^\d{1,2}:\d{2} (AM|PM)$/ });
    await expect(timeSlots.first()).toBeVisible({ timeout: 15_000 });

    const total = await timeSlots.count();
    let picked: Locator | null = null;
    for (let i = 0; i < total; i++) {
      const candidate = timeSlots.nth(i);
      if (await candidate.isEnabled()) {
        picked = candidate;
        break;
      }
    }
    expect(picked, 'expected at least one selectable time slot').not.toBeNull();
    await picked!.click();

    const payButton = page.getByRole('button', { name: /proceed to payment/i });
    await expect(payButton).toBeEnabled();
    await payButton.click();

    await expect(toastTitle(page, 'Checkout Error')).toBeVisible({ timeout: 15_000 });
    await expect(toastTitle(page, 'Error')).toHaveCount(0);
  });
});

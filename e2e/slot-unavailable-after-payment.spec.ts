import { test, expect } from '@playwright/test';

const COACH_NAME = 'Gabriel';
const TARGET_YEAR = 2026;
const TARGET_MONTH = 'August';
const TARGET_DAY = '12';
const PAID_SLOT_LABEL = '8:00 PM';

test.use({ timezoneId: 'Asia/Saigon' });

test.describe('slot already paid is not selectable and checkout rejects it', () => {
  test('booking grid disables the paid slot after a reload', async ({ page }) => {
    await page.goto('/');

    await page.getByRole('radio', { name: new RegExp(COACH_NAME, 'i') }).click();

    const monthHeading = page.getByRole('heading', { name: new RegExp(`${TARGET_MONTH} ${TARGET_YEAR}`, 'i') });
    for (let i = 0; i < 6; i++) {
      if (await monthHeading.isVisible().catch(() => false)) break;
      await page.getByRole('button', { name: /next month/i }).click();
    }
    await expect(monthHeading).toBeVisible();

    await page.getByRole('button', { name: TARGET_DAY, exact: true }).click();

    const paidSlotRadio = page.getByRole('radio', { name: PAID_SLOT_LABEL, exact: true });
    await expect(paidSlotRadio).toBeVisible();
    await expect(paidSlotRadio).toBeDisabled();
  });

  test('POST /api/checkout rejects the same coach+slot with 409', async ({ page }) => {
    const response = await page.request.post('/api/checkout', {
      data: {
        provider: 'stripe',
        storePendingBooking: true,
        bookingData: {
          userEmail: 'qa-forced-checkout@example.com',
          bookingPlan: {
            coach: 'GABRIEL',
            frequency: 'ONCE',
          },
          selectedDate: '2026-08-12T20:00:00.000+07:00',
          utcDate: '2026-08-12T13:00:00.000Z',
          selectedTimezone: 'Asia/Saigon',
        },
      },
    });

    expect(response.status()).toBe(409);
    const body = await response.json();
    expect(body).toEqual({ error: 'This time slot is no longer available' });
  });
});

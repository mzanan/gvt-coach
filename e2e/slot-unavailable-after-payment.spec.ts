import { test, expect } from '@playwright/test';
import {
  TAKEN_SLOT_COACH,
  TAKEN_SLOT_COACH_LABEL,
  TAKEN_SLOT_UTC_ISO,
  TAKEN_SLOT_YEAR,
  TAKEN_SLOT_MONTH,
  TAKEN_SLOT_DAY,
  TAKEN_SLOT_LABEL_SAIGON
} from './fixtures';
import { selectDay } from './calendar';

const COACH_NAME = TAKEN_SLOT_COACH_LABEL;
const TARGET_YEAR = TAKEN_SLOT_YEAR;
const TARGET_MONTH = TAKEN_SLOT_MONTH;
const TARGET_DAY = TAKEN_SLOT_DAY;
const PAID_SLOT_LABEL = TAKEN_SLOT_LABEL_SAIGON;

test.use({ timezoneId: 'Asia/Saigon' });

test.describe('slot already paid is not selectable and checkout rejects it', () => {
  test('booking grid disables the paid slot after a reload', async ({ page }) => {
    await page.goto('/');

    await page.getByRole('radio', { name: new RegExp(COACH_NAME, 'i') }).click();

    await selectDay(page, new RegExp(`${TARGET_MONTH} ${TARGET_YEAR}`, 'i'), TARGET_DAY);

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
            coach: TAKEN_SLOT_COACH,
            frequency: 'ONCE',
          },
          selectedDate: '2026-08-12T20:00:00.000+07:00',
          utcDate: TAKEN_SLOT_UTC_ISO,
          selectedTimezone: 'Asia/Saigon',
        },
      },
    });

    expect(response.status()).toBe(409);
    const body = await response.json();
    expect(body).toEqual({ error: 'This time slot is no longer available' });
  });
});

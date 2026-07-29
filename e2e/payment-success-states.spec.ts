import { test, expect } from '@playwright/test';

const PAID_ORDER_ID = 'qa-paid-0001';
const PENDING_ORDER_ID = 'qa-pending-0001';
const VOID_ORDER_ID = 'qa-void-0001';

test.use({ timezoneId: 'UTC' });

test.describe('/payment/success terminal states', () => {
  test('already paid checkout renders the confirmed booking', async ({ page }) => {
    await page.goto(`/payment/success?checkout_order_id=${PAID_ORDER_ID}`);

    await expect(page.getByRole('heading', { name: 'Booking Confirmed!' })).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText('Schedule Details')).toBeVisible();
    await expect(page.getByTestId('booking-date')).toHaveText('Tuesday, September 15, 2026');
    await expect(page.getByTestId('booking-time')).toHaveText('10:00 AM');
    await expect(page.getByText('qa-paid@example.com')).toBeVisible();
  });

  test('checkout that never confirms falls back to a retryable error screen', async ({ page }) => {
    test.setTimeout(60_000);

    const confirmCalls: number[] = [];
    page.on('request', request => {
      if (request.url().includes('/api/bookings/confirm')) confirmCalls.push(Date.now());
    });

    await page.goto(`/payment/success?checkout_order_id=${PENDING_ORDER_ID}`);

    await expect(page.getByRole('heading', { name: 'Payment Processing' })).toBeVisible({ timeout: 30_000 });

    await expect(page.getByRole('heading', { name: "We couldn't confirm your payment" })).toBeVisible({ timeout: 45_000 });
    await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Payment Processing' })).toHaveCount(0);

    expect(confirmCalls.length).toBeGreaterThanOrEqual(10);
  });

  test('voided checkout renders a terminal screen with no retry', async ({ page }) => {
    await page.goto(`/payment/success?checkout_order_id=${VOID_ORDER_ID}`);

    await expect(page.getByRole('heading', { name: 'This payment was canceled' })).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole('link', { name: 'Back to booking' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Try again' })).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'Payment Processing' })).toHaveCount(0);
  });
});

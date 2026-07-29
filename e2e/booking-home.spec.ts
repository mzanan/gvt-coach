import { test, expect } from '@playwright/test';

test('booking page loads with the coach selector', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByRole('heading', { name: /book a consultation/i })).toBeVisible();
  await expect(page.getByText(/select coach/i)).toBeVisible();
});

import { test, expect } from '@playwright/test';
import { loginAsAdmin, adminApiFetch } from './adminAuth';

interface CoachRecord {
  id: string;
  [key: string]: unknown;
}

async function getCoaches(): Promise<CoachRecord[]> {
  const res = await adminApiFetch('/api/admin/coaches');
  return res.json();
}

async function putCoach(coach: CoachRecord): Promise<void> {
  await adminApiFetch(`/api/admin/coaches/${encodeURIComponent(coach.id)}`, {
    method: 'PUT',
    body: JSON.stringify(coach),
  });
}

test.describe('/admin Coaches tab: coach form behavior', () => {
  let originalCoaches: CoachRecord[];

  test.beforeAll(async () => {
    originalCoaches = await getCoaches();
  });

  test.afterAll(async () => {
    for (const coach of originalCoaches) {
      await putCoach(coach);
    }
  });

  test('saving a coach persists the Polar product id even though the field is hidden again before Save is clicked', async ({ page }) => {
    const polarProductId = `polar_prod_hidden_${Date.now()}`;

    await loginAsAdmin(page);
    await page.goto('/admin');
    await page.getByRole('tab', { name: 'Coaches' }).click();
    await page.getByRole('tab', { name: 'Gabriel' }).click();

    const panel = page.getByRole('tabpanel');
    await panel.getByRole('combobox').filter({ hasText: /stripe|polar|disabled/i }).first().click();
    await page.getByRole('option', { name: 'Polar' }).click();

    const polarInput = panel.getByLabel('Polar product ID');
    await expect(polarInput).toBeVisible();
    await polarInput.fill(polarProductId);

    await panel.getByRole('combobox').filter({ hasText: 'Polar' }).first().click();
    await page.getByRole('option', { name: 'Stripe' }).click();
    await expect(panel.getByLabel('Polar product ID')).toHaveCount(0);

    await panel.getByRole('button', { name: 'Save coach' }).click();
    await expect(page.getByText('Saved', { exact: true })).toBeVisible();

    const [gabriel] = (await getCoaches()).filter(c => c.id === 'GABRIEL');
    expect(gabriel.polarProductId).toBe(polarProductId);
    expect(gabriel.paymentProvider).toBe('stripe');
  });

  test('an empty display name reports inline as soon as the field loses focus, and blocks the save', async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto('/admin');
    await page.getByRole('tab', { name: 'Coaches' }).click();
    await page.getByRole('tab', { name: 'Matias' }).click();

    const panel = page.getByRole('tabpanel');
    await panel.getByLabel('Display name').fill('');
    await panel.getByLabel('Email').focus();

    await expect(panel.getByText('Display name is required.')).toBeVisible();

    await panel.getByRole('button', { name: 'Save coach' }).click();
    await expect(page.getByText('Save Failed', { exact: true })).toHaveCount(0);
    await expect(panel.getByText('Display name is required.')).toBeVisible();
  });

  test('a malformed email reports inline on blur and clears as soon as it is corrected', async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto('/admin');
    await page.getByRole('tab', { name: 'Coaches' }).click();
    await page.getByRole('tab', { name: 'Matias' }).click();

    const panel = page.getByRole('tabpanel');
    const email = panel.getByLabel('Email');
    await email.fill('not-an-email');
    await panel.getByLabel('Display name').focus();

    await expect(panel.getByText('Enter a valid email address.')).toBeVisible();

    await email.fill('coach@example.com');
    await expect(panel.getByText('Enter a valid email address.')).toHaveCount(0);
  });
});

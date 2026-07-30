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

async function restoreCoach(coach: CoachRecord): Promise<void> {
  const current = await getCoaches();
  const path = current.some(c => c.id === coach.id)
    ? { url: `/api/admin/coaches/${encodeURIComponent(coach.id)}`, method: 'PUT' }
    : { url: '/api/admin/coaches', method: 'POST' };

  const res = await adminApiFetch(path.url, { method: path.method, body: JSON.stringify(coach) });
  if (!res.ok) {
    throw new Error(`Could not restore coach ${coach.id}: ${res.status} ${await res.text()}`);
  }
}

test.describe('/admin Coaches tab: coach form behavior', () => {
  let originalCoaches: CoachRecord[];

  test.beforeAll(async () => {
    originalCoaches = await getCoaches();
  });

  test.afterAll(async () => {
    for (const coach of originalCoaches) {
      await restoreCoach(coach);
    }
  });

  test('an unsaved edit on one coach survives switching to another coach and back', async ({ page }) => {
    const draftName = `Matias Draft ${Date.now()}`;

    await loginAsAdmin(page);
    await page.goto('/admin');
    await page.getByRole('tab', { name: 'Coaches' }).click();

    const panel = page.getByRole('tabpanel');
    await expect(panel.getByLabel('Display name')).toHaveValue('Matias');
    await panel.getByLabel('Display name').fill(draftName);

    await page.getByRole('tab', { name: 'Gabriel' }).click();
    await expect(page.getByRole('tabpanel').getByLabel('Display name')).toHaveValue('Gabriel');

    await page.getByRole('tab', { name: 'Matias' }).click();
    await expect(page.getByRole('tabpanel').getByLabel('Display name')).toHaveValue(draftName);
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

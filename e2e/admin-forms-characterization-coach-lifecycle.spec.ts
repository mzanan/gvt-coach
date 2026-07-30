import { test, expect } from '@playwright/test';
import { loginAsAdmin, adminApiFetch } from './adminAuth';

interface CoachRecord {
  id: string;
  displayName: string;
  email: string;
  [key: string]: unknown;
}

interface SiteConfig {
  contactEmail: string;
  [key: string]: unknown;
}

async function getCoaches(): Promise<CoachRecord[]> {
  const res = await adminApiFetch('/api/admin/coaches');
  return res.json();
}

async function getSite(): Promise<SiteConfig> {
  const res = await adminApiFetch('/api/admin/settings');
  const body = await res.json();
  return body.site;
}

async function restoreCoach(coach: CoachRecord): Promise<void> {
  const current = await getCoaches();
  const exists = current.some(c => c.id === coach.id);
  if (exists) {
    await adminApiFetch(`/api/admin/coaches/${encodeURIComponent(coach.id)}`, {
      method: 'PUT',
      body: JSON.stringify(coach),
    });
  } else {
    await adminApiFetch('/api/admin/coaches', {
      method: 'POST',
      body: JSON.stringify(coach),
    });
  }
}

async function deleteCoachIfExists(id: string): Promise<void> {
  const current = await getCoaches();
  if (current.some(c => c.id === id)) {
    await adminApiFetch(`/api/admin/coaches/${encodeURIComponent(id)}`, { method: 'DELETE' });
  }
}

test.describe('/admin Coaches tab: create and delete lifecycle', () => {
  let originalCoaches: CoachRecord[];

  test.beforeAll(async () => {
    originalCoaches = await getCoaches();
  });

  test.afterAll(async () => {
    for (const coach of originalCoaches) {
      await restoreCoach(coach);
    }
    const current = await getCoaches();
    const originalIds = new Set(originalCoaches.map(c => c.id));
    for (const coach of current) {
      if (!originalIds.has(coach.id)) {
        await deleteCoachIfExists(coach.id);
      }
    }
  });

  test('creating a coach via the New coach dialog adds a tab and persists default settings copied from the template coach', async ({ page }) => {
    const uniqueName = `QA Coach ${Date.now()}`;
    const siteBefore = await getSite();

    await loginAsAdmin(page);
    await page.goto('/admin');
    await page.getByRole('tab', { name: 'Coaches' }).click();

    await page.getByRole('button', { name: 'New coach' }).click();
    const dialog = page.getByRole('dialog', { name: 'New coach' });
    await expect(dialog).toBeVisible();
    await dialog.getByLabel('Name').fill(uniqueName);
    await dialog.getByRole('button', { name: 'Create coach' }).click();

    await expect(page.getByText('Created', { exact: true })).toBeVisible();
    await expect(page.getByRole('tab', { name: uniqueName })).toBeVisible();

    const created = (await getCoaches()).find(c => c.displayName === uniqueName);
    expect(created).toBeTruthy();
    expect(created!.email).toBe(siteBefore.contactEmail);

    await deleteCoachIfExists(created!.id);
  });

  test('the New coach dialog Create button is disabled while the name field is empty', async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto('/admin');
    await page.getByRole('tab', { name: 'Coaches' }).click();

    await page.getByRole('button', { name: 'New coach' }).click();
    const dialog = page.getByRole('dialog', { name: 'New coach' });
    await expect(dialog.getByRole('button', { name: 'Create coach' })).toBeDisabled();

    await dialog.getByLabel('Name').fill('Temp');
    await expect(dialog.getByRole('button', { name: 'Create coach' })).toBeEnabled();
  });

  test('recreating a coach with the id of a deleted one does not resurrect the deleted coach unsaved values', async ({ page }) => {
    const reusedName = `Recycled Coach ${Date.now()}`;
    const ghostValue = 'GHOST DRAFT VALUE';

    const temp: CoachRecord = { ...originalCoaches[0], id: 'RECYCLED', displayName: reusedName, name: reusedName };
    const seeded = await adminApiFetch('/api/admin/coaches', { method: 'POST', body: JSON.stringify(temp) });
    if (!seeded.ok) throw new Error(`Could not seed the recycled coach: ${seeded.status}`);

    await loginAsAdmin(page);
    await page.goto('/admin');
    await page.getByRole('tab', { name: 'Coaches' }).click();
    await page.getByRole('tab', { name: reusedName }).click();

    const panel = page.getByRole('tabpanel');
    await panel.getByLabel('Display name').fill(ghostValue);

    await panel.getByRole('button', { name: 'Delete coach' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Delete' }).click();
    await expect(page.getByRole('tab', { name: reusedName })).toHaveCount(0);

    await page.getByRole('button', { name: 'New coach' }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Name').fill('Recycled');
    await dialog.getByRole('button', { name: 'Create coach' }).click();

    await expect(page.getByRole('tab', { name: 'Recycled', exact: true })).toBeVisible();
    await expect(page.getByRole('tabpanel').getByLabel('Display name')).toHaveValue('Recycled');
    await expect(page.getByRole('tabpanel').getByLabel('Display name')).not.toHaveValue(ghostValue);

    await deleteCoachIfExists('RECYCLED');
  });

  test('deleting a coach via its Delete dialog removes its tab, and the last remaining coach cannot be deleted', async ({ page }) => {
    const temp: CoachRecord = {
      ...originalCoaches[0],
      id: `TEMP_${Date.now()}`,
      displayName: `Temp Coach ${Date.now()}`,
      name: `Temp Coach ${Date.now()}`,
    };
    const seedResponse = await adminApiFetch('/api/admin/coaches', { method: 'POST', body: JSON.stringify(temp) });
    if (!seedResponse.ok) {
      throw new Error(`Could not seed the temp coach for this test: ${seedResponse.status} ${await seedResponse.text()}`);
    }

    await loginAsAdmin(page);
    await page.goto('/admin');
    await page.getByRole('tab', { name: 'Coaches' }).click();

    await page.getByRole('tab', { name: temp.displayName }).click();
    const panel = page.getByRole('tabpanel');
    await panel.getByRole('button', { name: 'Delete coach' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Delete' }).click();

    await expect(page.getByText('Deleted', { exact: true })).toBeVisible();
    await expect(page.getByRole('tab', { name: temp.displayName })).toHaveCount(0);

    await page.getByRole('tab', { name: 'Gabriel' }).click();
    await page.getByRole('tabpanel').getByRole('button', { name: 'Delete coach' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Delete' }).click();
    await expect(page.getByText('Deleted', { exact: true }).first()).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Gabriel' })).toHaveCount(0);

    await page.getByRole('tab', { name: 'Matias' }).click();
    const lastPanel = page.getByRole('tabpanel');
    await expect(lastPanel.getByRole('button', { name: 'Delete coach' })).toBeDisabled();
    await expect(lastPanel.getByText('The last coach cannot be deleted.')).toBeVisible();

    const guardResponse = await adminApiFetch('/api/admin/coaches/MATIAS', { method: 'DELETE' });
    expect(guardResponse.status).toBe(400);
    const guardBody = await guardResponse.json();
    expect(guardBody).toEqual({ error: 'Cannot delete the last coach' });

    const afterGuard = await getCoaches();
    expect(afterGuard.some(c => c.id === 'MATIAS')).toBe(true);
  });
});

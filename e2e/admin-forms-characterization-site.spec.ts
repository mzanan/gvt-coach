import { test, expect } from '@playwright/test';
import { loginAsAdmin, adminApiFetch } from './adminAuth';

interface SiteConfig {
  siteName: string;
  siteDescription: string;
  companyName: string;
  contactEmail: string;
}

async function getSite(): Promise<SiteConfig> {
  const res = await adminApiFetch('/api/admin/settings');
  const body = await res.json();
  return body.site;
}

async function putSite(site: SiteConfig): Promise<void> {
  await adminApiFetch('/api/admin/settings', {
    method: 'PUT',
    body: JSON.stringify({ site }),
  });
}

test.describe('/admin General tab: site settings form behavior', () => {
  let originalSite: SiteConfig;

  test.beforeAll(async () => {
    originalSite = await getSite();
  });

  test.afterAll(async () => {
    await putSite(originalSite);
  });

  test('editing the site name and clicking Save persists it: Saved toast appears and the value survives a reload', async ({ page }) => {
    const uniqueName = `QA Site Name ${Date.now()}`;

    await loginAsAdmin(page);
    await page.goto('/admin');

    const panel = page.getByRole('tabpanel');
    const siteNameInput = panel.getByLabel('Site name');
    await siteNameInput.fill(uniqueName);
    await panel.getByRole('button', { name: 'Save site settings' }).click();

    await expect(page.getByText('Saved', { exact: true })).toBeVisible();

    await page.reload();
    await expect(page.getByRole('tabpanel').getByLabel('Site name')).toHaveValue(uniqueName);
  });

  test('editing the site name WITHOUT saving, switching to Coaches and back to General: the typed value survives on main', async ({ page }) => {
    const draftName = `Unsaved Draft ${Date.now()}`;

    await loginAsAdmin(page);
    await page.goto('/admin');

    const panel = page.getByRole('tabpanel');
    const siteNameInput = panel.getByLabel('Site name');
    await siteNameInput.fill(draftName);

    await page.getByRole('tab', { name: 'Coaches' }).click();
    await expect(page.getByRole('tabpanel').getByRole('button', { name: 'Save coach' })).toBeVisible();

    await page.getByRole('tab', { name: 'General' }).click();

    await expect(page.getByRole('tabpanel').getByLabel('Site name')).toHaveValue(draftName);
  });

  test('an empty site name and a malformed contact email report inline on blur and block the save', async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto('/admin');

    const panel = page.getByRole('tabpanel');
    await panel.getByLabel('Site name').fill('');
    await panel.getByLabel('Description').focus();
    await expect(panel.getByText('Site name is required.')).toBeVisible();

    await panel.getByLabel('Contact email').fill('not-an-email');
    await panel.getByLabel('Company name').focus();
    await expect(panel.getByText('Enter a valid email address.')).toBeVisible();

    await panel.getByRole('button', { name: 'Save site settings' }).click();
    await expect(page.getByText('Saved', { exact: true })).toHaveCount(0);
    await expect(page.getByText('Save Failed', { exact: true })).toHaveCount(0);

    await page.reload();
    const reloadedPanel = page.getByRole('tabpanel');
    await expect(reloadedPanel.getByLabel('Site name')).not.toHaveValue('');
  });
});

import { test, expect, type Page, type Route } from '@playwright/test';

test.setTimeout(60000);

test.use({ timezoneId: 'Asia/Saigon' });

const TARGET_MONTH_HEADING = 'August 2026';

const ABANDONED = {
  coach: 'Matias',
  day: '12',
  slotsHeading: /^Wednesday, August 12$/,
  startParam: '2026-08-11T17:00',
};

const CURRENT = {
  coach: 'Gabriel',
  day: '20',
  slotsHeading: /^Thursday, August 20$/,
};

const STALE_RESPONSE_DELAY_MS = 10000;

async function openTargetMonth(page: Page) {
  const monthHeading = page.getByRole('heading', { name: TARGET_MONTH_HEADING });
  for (let i = 0; i < 8; i++) {
    if (await monthHeading.isVisible().catch(() => false)) break;
    await page.getByRole('button', { name: /next month/i }).click();
  }
  await expect(monthHeading).toBeVisible();
}

async function selectCoach(page: Page, coach: string) {
  const coachSection = page.getByRole('button', { name: /select coach/i });
  if (await coachSection.getAttribute('data-state') === 'closed') {
    await coachSection.click();
  }
  await page.getByRole('radio', { name: new RegExp(coach, 'i') }).click();
}

async function selectDay(page: Page, day: string) {
  await openTargetMonth(page);
  await page.getByRole('button', { name: day, exact: true }).click();
}

function isAbandonedSlotsRequest(url: string) {
  return url.includes('/api/bookings/paid') && decodeURIComponent(url).includes(ABANDONED.startParam);
}

async function runRace(page: Page, resolveStale: (route: Route) => Promise<void>) {
  const state = { staleSettled: false };

  await page.route('**/api/bookings/paid**', async route => {
    if (!isAbandonedSlotsRequest(route.request().url())) {
      await route.continue();
      return;
    }
    await new Promise(resolve => setTimeout(resolve, STALE_RESPONSE_DELAY_MS));
    state.staleSettled = true;
    await resolveStale(route);
  });

  await page.goto('/');
  await expect(page.getByRole('heading', { name: /book a consultation/i })).toBeVisible();

  const abandonedRequest = page.waitForRequest(request => isAbandonedSlotsRequest(request.url()));

  await selectCoach(page, ABANDONED.coach);
  await selectDay(page, ABANDONED.day);
  await abandonedRequest;

  expect(state.staleSettled).toBe(false);

  await selectCoach(page, CURRENT.coach);
  await selectDay(page, CURRENT.day);

  await expect(page.getByRole('heading', { name: CURRENT.slotsHeading })).toBeVisible();

  expect(state.staleSettled).toBe(false);

  await expect.poll(() => state.staleSettled, { timeout: 20000 }).toBe(true);
  await page.waitForTimeout(2000);
}

test.describe.configure({ mode: 'default' });

test.describe('stale slots response does not clobber the current selection', () => {
  test('a late successful response for an abandoned coach+date is discarded', async ({ page }) => {
    await runRace(page, route => route.continue());

    await expect(page.getByRole('heading', { name: CURRENT.slotsHeading })).toBeVisible();
    await expect(page.getByRole('heading', { name: ABANDONED.slotsHeading })).toHaveCount(0);
  });

  test('a late failed response for an abandoned coach+date raises no toast', async ({ page }) => {
    await runRace(page, route => route.abort('failed'));

    await expect(page.getByText('Failed to fetch', { exact: true })).toHaveCount(0);
    await expect(page.getByRole('region', { name: /notifications/i })).toHaveText('');
    await expect(page.getByRole('heading', { name: CURRENT.slotsHeading })).toBeVisible();
    await expect(page.getByRole('heading', { name: ABANDONED.slotsHeading })).toHaveCount(0);
  });
});

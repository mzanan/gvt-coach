import { expect, type Page } from '@playwright/test';

const MAX_MONTH_ADVANCES = 8;

export async function openMonth(page: Page, monthLabel: string | RegExp): Promise<void> {
  const monthHeading = page.getByRole('heading', { name: monthLabel });

  for (let i = 0; i < MAX_MONTH_ADVANCES; i++) {
    if (await monthHeading.isVisible().catch(() => false)) break;
    await page.getByRole('button', { name: /next month/i }).click();
  }

  await expect(monthHeading).toBeVisible();
}

export function dayButton(page: Page, monthLabel: string | RegExp, day: string) {
  return page
    .getByRole('grid', { name: monthLabel })
    .getByRole('button', { name: new RegExp(`\\b${day}(st|nd|rd|th),`) });
}

export async function selectDay(page: Page, monthLabel: string | RegExp, day: string): Promise<void> {
  await openMonth(page, monthLabel);
  await dayButton(page, monthLabel, day).click();
}

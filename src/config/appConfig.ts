import { SITE_CONFIG } from '@/config/site';
import { getSetting } from '@/lib/db/settings';
import { listCoaches, CoachRecord } from '@/lib/db/coaches';

export const SETTING_KEYS = {
  site: 'site_config',
} as const;

export type SiteConfig = typeof SITE_CONFIG;

export interface AppConfig {
  coaches: Record<string, CoachRecord>;
  site: SiteConfig;
}

export async function getEffectiveCoachesConfig(): Promise<Record<string, CoachRecord>> {
  const coaches = await listCoaches();
  const result: Record<string, CoachRecord> = {};
  for (const coach of coaches) {
    result[coach.id] = coach;
  }
  return result;
}

export async function getEffectiveSiteConfig(): Promise<SiteConfig> {
  const override = await getSetting<Partial<SiteConfig>>(SETTING_KEYS.site);
  return { ...SITE_CONFIG, ...override };
}

export async function getAppConfig(): Promise<AppConfig> {
  const [coaches, site] = await Promise.all([
    getEffectiveCoachesConfig(),
    getEffectiveSiteConfig(),
  ]);

  return { coaches, site };
}

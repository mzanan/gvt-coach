import { CoachId, COACHES_CONFIG } from '@/config/coaches';
import { SITE_CONFIG } from '@/config/site';
import { CoachConfig } from '@/types/coach';
import { getSetting } from '@/lib/db/settings';

export const SETTING_KEYS = {
  coaches: 'coaches_config',
  site: 'site_config',
  paymentProvider: 'payment_provider',
  meetingProvider: 'meeting_provider',
} as const;

export type SiteConfig = typeof SITE_CONFIG;
export type PaymentProvider = 'stripe' | 'polar' | 'lemonsqueezy' | 'disabled';
export type MeetingProvider = 'zoom' | 'google-meet';

export interface AppConfig {
  coaches: Record<CoachId, CoachConfig>;
  site: SiteConfig;
  paymentProvider: PaymentProvider;
  meetingProvider: MeetingProvider;
}

function mergeCoach(defaults: CoachConfig, override: Partial<CoachConfig> | undefined): CoachConfig {
  if (!override) return defaults;
  return {
    ...defaults,
    ...override,
    workingHours: {
      morning: { ...defaults.workingHours.morning, ...override.workingHours?.morning },
      afternoon: { ...defaults.workingHours.afternoon, ...override.workingHours?.afternoon },
    },
    prices: { ...defaults.prices, ...override.prices },
  };
}

export async function getEffectiveCoachesConfig(): Promise<Record<CoachId, CoachConfig>> {
  const overrides = await getSetting<Partial<Record<CoachId, Partial<CoachConfig>>>>(SETTING_KEYS.coaches);

  const result = {} as Record<CoachId, CoachConfig>;
  for (const coachId of Object.keys(COACHES_CONFIG) as CoachId[]) {
    result[coachId] = mergeCoach(COACHES_CONFIG[coachId], overrides?.[coachId]);
  }
  return result;
}

export async function getEffectiveSiteConfig(): Promise<SiteConfig> {
  const override = await getSetting<Partial<SiteConfig>>(SETTING_KEYS.site);
  return { ...SITE_CONFIG, ...override };
}

export async function getPaymentProvider(): Promise<PaymentProvider> {
  const stored = await getSetting<PaymentProvider>(SETTING_KEYS.paymentProvider);
  return stored
    || (process.env.NEXT_PUBLIC_GVT_COACH_PAYMENT_PROVIDER as PaymentProvider)
    || 'stripe';
}

export async function getMeetingProvider(): Promise<MeetingProvider> {
  const stored = await getSetting<MeetingProvider>(SETTING_KEYS.meetingProvider);
  return stored || 'zoom';
}

export async function getAppConfig(): Promise<AppConfig> {
  const [coaches, site, paymentProvider, meetingProvider] = await Promise.all([
    getEffectiveCoachesConfig(),
    getEffectiveSiteConfig(),
    getPaymentProvider(),
    getMeetingProvider(),
  ]);

  return { coaches, site, paymentProvider, meetingProvider };
}

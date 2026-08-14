/**
 * Feature entitlements.
 *
 * One rule, and it is the whole point of this file: **entitlements are resolved
 * server-side from subscription state, never supplied by the client.**
 *
 * Plan names must not be compared inline in UI components. A component that
 * writes `plan === 'advanced'` has (a) duplicated policy, (b) put it somewhere a
 * user can edit, and (c) guaranteed it will drift from the server's answer. Ask
 * `hasFeature` instead, and gate the server route as well as the UI — hiding a
 * button is presentation, not access control.
 */

export const FEATURES = [
  'basic_horoscope',
  'moon_phase',
  'life_path',
  'natal_chart',
  'personal_transits',
  'lunar_to_natal',
  'numerology_cycles',
  'notifications',
  'basic_compatibility',
  'transit_calendar',
  'synastry',
  'multiple_profiles',
  'advanced_reports',
  'downloadable_reports',
  'ai_explanations',
] as const;

export type Feature = (typeof FEATURES)[number];

export const PLANS = ['free', 'personal', 'advanced'] as const;
export type Plan = (typeof PLANS)[number];

/**
 * Features granted by each plan.
 *
 * Higher plans are supersets, expressed explicitly rather than by inheritance so
 * that reading this table answers the question completely.
 */
const FREE_FEATURES: readonly Feature[] = ['basic_horoscope', 'moon_phase', 'life_path'];

const PERSONAL_FEATURES: readonly Feature[] = [
  ...FREE_FEATURES,
  'natal_chart',
  'personal_transits',
  'lunar_to_natal',
  'numerology_cycles',
  'notifications',
  'basic_compatibility',
];

const ADVANCED_FEATURES: readonly Feature[] = [
  ...PERSONAL_FEATURES,
  'transit_calendar',
  'synastry',
  'multiple_profiles',
  'advanced_reports',
  'downloadable_reports',
  'ai_explanations',
];

export const PLAN_FEATURES: Readonly<Record<Plan, readonly Feature[]>> = {
  free: FREE_FEATURES,
  personal: PERSONAL_FEATURES,
  advanced: ADVANCED_FEATURES,
};

/**
 * Subscription statuses that still grant paid access.
 *
 * `past_due` is deliberately included: dunning is in progress and cutting a
 * paying customer off mid-retry is worse than a few days of grace. `canceled`
 * grants nothing beyond the period end, which the caller checks separately.
 */
const ENTITLING_STATUSES = new Set(['trialing', 'active', 'past_due']);

export interface SubscriptionState {
  readonly plan: string;
  readonly status: string;
  readonly currentPeriodEnd: Date | null;
}

/**
 * Resolve the effective plan for a subscription.
 *
 * Anything unrecognised, expired or non-entitling resolves to `free`. Failing
 * closed matters: a bug here should cost a user features, never hand out paid
 * ones.
 */
export function resolvePlan(subscription: SubscriptionState | null, now: Date = new Date()): Plan {
  if (subscription === null) return 'free';
  if (!ENTITLING_STATUSES.has(subscription.status)) return 'free';

  // An entitling status with an elapsed period end means the webhook that should
  // have closed it has not arrived. Treat it as expired rather than trusting it.
  if (
    subscription.currentPeriodEnd !== null &&
    subscription.currentPeriodEnd.getTime() < now.getTime()
  ) {
    return 'free';
  }

  const plan = subscription.plan as Plan;
  return (PLANS as readonly string[]).includes(plan) ? plan : 'free';
}

/** Whether a resolved plan grants a feature. */
export function planHasFeature(plan: Plan, feature: Feature): boolean {
  return PLAN_FEATURES[plan].includes(feature);
}

/** Whether a subscription grants a feature. The only check callers should use. */
export function hasFeature(
  subscription: SubscriptionState | null,
  feature: Feature,
  now: Date = new Date(),
): boolean {
  return planHasFeature(resolvePlan(subscription, now), feature);
}

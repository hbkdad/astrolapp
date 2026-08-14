import 'server-only';
import { cookies } from 'next/headers';
import { assertValidTimeZone, type HouseSystem } from '@astrolapp/astro-engine';

/**
 * Birth profile storage — INTERIM.
 *
 * The profile currently lives in a cookie because persistence is not built yet
 * (see docs/PROJECT_STATUS.md). This is deliberately not a long-term design:
 *
 *   * The cookie holds birth date, time and coordinates, which is personal data
 *     sitting in the browser rather than under an account the user can delete.
 *   * It is capped at one profile, so multiple-profile support is impossible.
 *
 * It is used rather than a URL parameter because birth data must never travel in
 * a query string, where it lands in browser history, referrer headers and server
 * access logs.
 *
 * When `packages/db` is wired up, this module becomes a thin lookup by user id
 * and every caller stays the same.
 */

const COOKIE_NAME = 'astrolapp_profile';

export interface StoredBirthProfile {
  readonly fullName: string;
  /** `YYYY-MM-DD`. */
  readonly birthDate: string;
  /** `HH:MM`, or null when the user does not know their birth time. */
  readonly birthTime: string | null;
  readonly timeZone: string;
  readonly latitude: number;
  readonly longitude: number;
  readonly placeLabel: string;
  readonly houseSystem: HouseSystem;
}

export interface ProfileValidationError {
  readonly field: string;
  readonly message: string;
}

/**
 * Validate untrusted form input.
 *
 * Returns errors rather than throwing so the form can show all of them at once.
 */
export function validateProfileInput(
  input: Record<string, unknown>,
): { ok: true; profile: StoredBirthProfile } | { ok: false; errors: ProfileValidationError[] } {
  const errors: ProfileValidationError[] = [];

  const fullName = typeof input['fullName'] === 'string' ? input['fullName'].trim() : '';

  const birthDate = typeof input['birthDate'] === 'string' ? input['birthDate'] : '';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(birthDate)) {
    errors.push({ field: 'birthDate', message: 'Enter a birth date.' });
  } else {
    const [year, month, day] = birthDate.split('-').map(Number);
    const parsed = new Date(Date.UTC(year ?? 0, (month ?? 1) - 1, day ?? 1));
    // Catches 31 February and similar, which the pattern alone allows.
    if (
      parsed.getUTCFullYear() !== year ||
      parsed.getUTCMonth() + 1 !== month ||
      parsed.getUTCDate() !== day
    ) {
      errors.push({ field: 'birthDate', message: 'That date does not exist.' });
    }
  }

  const rawTime = typeof input['birthTime'] === 'string' ? input['birthTime'].trim() : '';
  const birthTime = rawTime.length === 0 ? null : rawTime;
  if (birthTime !== null && !/^\d{2}:\d{2}$/.test(birthTime)) {
    errors.push({ field: 'birthTime', message: 'Use 24-hour HH:MM, or leave blank.' });
  }

  const timeZone = typeof input['timeZone'] === 'string' ? input['timeZone'] : '';
  try {
    assertValidTimeZone(timeZone);
  } catch {
    errors.push({ field: 'timeZone', message: 'Choose a valid time zone.' });
  }

  const latitude = Number(input['latitude']);
  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) {
    errors.push({ field: 'latitude', message: 'Latitude must be between -90 and 90.' });
  }

  const longitude = Number(input['longitude']);
  if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
    errors.push({ field: 'longitude', message: 'Longitude must be between -180 and 180.' });
  }

  const houseSystemInput =
    typeof input['houseSystem'] === 'string' ? input['houseSystem'] : 'placidus';
  const houseSystem: HouseSystem = (['placidus', 'whole-sign', 'equal'] as const).includes(
    houseSystemInput as HouseSystem,
  )
    ? (houseSystemInput as HouseSystem)
    : 'placidus';

  if (errors.length > 0) return { ok: false, errors };

  return {
    ok: true,
    profile: {
      fullName,
      birthDate,
      birthTime,
      timeZone,
      latitude,
      longitude,
      placeLabel: typeof input['placeLabel'] === 'string' ? input['placeLabel'].trim() : '',
      houseSystem,
    },
  };
}

export async function saveProfile(profile: StoredBirthProfile): Promise<void> {
  const store = await cookies();
  store.set(COOKIE_NAME, JSON.stringify(profile), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 90,
  });
}

export async function clearProfile(): Promise<void> {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}

/** Read the stored profile, or null. Malformed cookies are treated as absent. */
export async function readProfile(): Promise<StoredBirthProfile | null> {
  const store = await cookies();
  const raw = store.get(COOKIE_NAME)?.value;
  if (raw === undefined) return null;

  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return null;
    const result = validateProfileInput(parsed as Record<string, unknown>);
    return result.ok ? result.profile : null;
  } catch {
    return null;
  }
}

'use server';

import { redirect } from 'next/navigation';
import { clearProfile, saveProfile, validateProfileInput } from '@/lib/profile';

export interface ProfileFormState {
  readonly errors: { field: string; message: string }[];
}

/**
 * Persist a birth profile from the form.
 *
 * Validation runs here, on the server, regardless of any client-side checks —
 * form input is untrusted, and HTML validation attributes are a convenience for
 * the user rather than a control.
 */
export async function saveProfileAction(
  _previous: ProfileFormState,
  formData: FormData,
): Promise<ProfileFormState> {
  const result = validateProfileInput({
    fullName: formData.get('fullName'),
    birthDate: formData.get('birthDate'),
    birthTime: formData.get('birthTime'),
    timeZone: formData.get('timeZone'),
    latitude: formData.get('latitude'),
    longitude: formData.get('longitude'),
    placeLabel: formData.get('placeLabel'),
    houseSystem: formData.get('houseSystem'),
  });

  if (!result.ok) {
    return { errors: result.errors };
  }

  await saveProfile(result.profile);
  redirect('/today');
}

export async function clearProfileAction(): Promise<void> {
  await clearProfile();
  redirect('/profile');
}

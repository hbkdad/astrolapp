'use client';

import { useActionState } from 'react';
import { saveProfileAction, type ProfileFormState } from './actions';
import type { StoredBirthProfile } from '@/lib/profile';

const COMMON_TIME_ZONES = [
  'Europe/London',
  'Europe/Paris',
  'Europe/Berlin',
  'Europe/Madrid',
  'Europe/Moscow',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'America/Sao_Paulo',
  'Africa/Lagos',
  'Africa/Johannesburg',
  'Asia/Dubai',
  'Asia/Kolkata',
  'Asia/Shanghai',
  'Asia/Tokyo',
  'Australia/Sydney',
  'Pacific/Auckland',
  'UTC',
];

const initialState: ProfileFormState = { errors: [] };

function FieldError({ errors, field }: { errors: ProfileFormState['errors']; field: string }) {
  const error = errors.find((item) => item.field === field);
  if (error === undefined) return null;
  return (
    <p id={`${field}-error`} className="mt-1 text-xs text-demanding">
      {error.message}
    </p>
  );
}

export function ProfileForm({ existing }: { existing: StoredBirthProfile | null }) {
  const [state, formAction, pending] = useActionState(saveProfileAction, initialState);
  const hasError = (field: string): boolean => state.errors.some((item) => item.field === field);

  return (
    <form action={formAction} className="space-y-6">
      {state.errors.length > 0 && (
        // Announced to screen readers when validation fails.
        <div
          role="alert"
          className="rounded border border-demanding/50 bg-demanding/10 p-4 text-sm"
        >
          Please correct the {state.errors.length === 1 ? 'error' : 'errors'} below.
        </div>
      )}

      <div>
        <label htmlFor="fullName" className="block text-sm font-medium">
          Full birth name
        </label>
        <p className="mt-1 text-xs text-parchment-faint">
          Used only for numerology. Leave blank to skip the numerology sections.
        </p>
        <input
          id="fullName"
          name="fullName"
          type="text"
          defaultValue={existing?.fullName ?? ''}
          autoComplete="off"
          className="mt-2 w-full rounded border border-ink-line bg-ink-raised px-3 py-2"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="birthDate" className="block text-sm font-medium">
            Birth date <span className="text-demanding">*</span>
          </label>
          <input
            id="birthDate"
            name="birthDate"
            type="date"
            required
            defaultValue={existing?.birthDate ?? ''}
            aria-invalid={hasError('birthDate')}
            aria-describedby={hasError('birthDate') ? 'birthDate-error' : undefined}
            className="mt-2 w-full rounded border border-ink-line bg-ink-raised px-3 py-2"
          />
          <FieldError errors={state.errors} field="birthDate" />
        </div>

        <div>
          <label htmlFor="birthTime" className="block text-sm font-medium">
            Birth time
          </label>
          <p className="mt-1 text-xs text-parchment-faint">
            Leave blank if unknown. Without it, houses and the Ascendant cannot be calculated.
          </p>
          <input
            id="birthTime"
            name="birthTime"
            type="time"
            defaultValue={existing?.birthTime ?? ''}
            aria-invalid={hasError('birthTime')}
            aria-describedby={hasError('birthTime') ? 'birthTime-error' : undefined}
            className="mt-2 w-full rounded border border-ink-line bg-ink-raised px-3 py-2"
          />
          <FieldError errors={state.errors} field="birthTime" />
        </div>
      </div>

      <div>
        <label htmlFor="timeZone" className="block text-sm font-medium">
          Birth time zone <span className="text-demanding">*</span>
        </label>
        <p className="mt-1 text-xs text-parchment-faint">
          The zone of the birth place at the time of birth, not where you live now.
        </p>
        <select
          id="timeZone"
          name="timeZone"
          required
          defaultValue={existing?.timeZone ?? 'Europe/London'}
          className="mt-2 w-full rounded border border-ink-line bg-ink-raised px-3 py-2"
        >
          {COMMON_TIME_ZONES.map((zone) => (
            <option key={zone} value={zone}>
              {zone}
            </option>
          ))}
        </select>
        <FieldError errors={state.errors} field="timeZone" />
      </div>

      <fieldset className="grid gap-4 sm:grid-cols-3">
        <legend className="mb-2 text-sm font-medium">Birth place</legend>
        <div className="sm:col-span-3">
          <label htmlFor="placeLabel" className="block text-xs text-parchment-muted">
            Place name
          </label>
          <input
            id="placeLabel"
            name="placeLabel"
            type="text"
            defaultValue={existing?.placeLabel ?? ''}
            className="mt-1 w-full rounded border border-ink-line bg-ink-raised px-3 py-2"
          />
        </div>
        <div>
          <label htmlFor="latitude" className="block text-xs text-parchment-muted">
            Latitude <span className="text-demanding">*</span>
          </label>
          <input
            id="latitude"
            name="latitude"
            type="number"
            step="any"
            required
            defaultValue={existing?.latitude ?? ''}
            aria-invalid={hasError('latitude')}
            className="mt-1 w-full rounded border border-ink-line bg-ink-raised px-3 py-2 font-mono"
          />
          <FieldError errors={state.errors} field="latitude" />
        </div>
        <div>
          <label htmlFor="longitude" className="block text-xs text-parchment-muted">
            Longitude <span className="text-demanding">*</span>
          </label>
          <input
            id="longitude"
            name="longitude"
            type="number"
            step="any"
            required
            defaultValue={existing?.longitude ?? ''}
            aria-invalid={hasError('longitude')}
            className="mt-1 w-full rounded border border-ink-line bg-ink-raised px-3 py-2 font-mono"
          />
          <FieldError errors={state.errors} field="longitude" />
        </div>
        <div>
          <label htmlFor="houseSystem" className="block text-xs text-parchment-muted">
            House system
          </label>
          <select
            id="houseSystem"
            name="houseSystem"
            defaultValue={existing?.houseSystem ?? 'placidus'}
            className="mt-1 w-full rounded border border-ink-line bg-ink-raised px-3 py-2"
          >
            <option value="placidus">Placidus</option>
            <option value="whole-sign">Whole Sign</option>
            <option value="equal">Equal</option>
          </select>
        </div>
      </fieldset>

      <button
        type="submit"
        disabled={pending}
        className="rounded bg-brass px-5 py-2.5 font-medium text-ink transition-colors hover:bg-brass-bright disabled:opacity-60"
      >
        {pending ? 'Calculating…' : 'Save and calculate'}
      </button>
    </form>
  );
}

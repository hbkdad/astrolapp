import type { Metadata } from 'next';
import { readProfile } from '@/lib/profile';
import { ProfileForm } from './ProfileForm';
import { clearProfileAction } from './actions';

export const metadata: Metadata = { title: 'Birth profile' };

export default async function ProfilePage() {
  const existing = await readProfile();

  return (
    <div className="max-w-2xl">
      <h1 className="font-serif text-3xl">Birth profile</h1>
      <p className="mt-3 text-sm leading-relaxed text-parchment-muted">
        Your chart is calculated from an exact moment and place. Everything the app shows is derived
        from these values and can be recomputed from them.
      </p>

      <div className="panel mt-6 border-steel/30 bg-steel/5">
        <h2 className="text-sm font-medium text-steel">Where this is stored</h2>
        <p className="mt-2 text-xs leading-relaxed text-parchment-muted">
          Persistence is not built yet, so this profile is kept in an encrypted-in-transit,
          HTTP-only cookie on your own browser rather than in a database. It is never placed in a
          URL. You can remove it at any time with the button below.
        </p>
      </div>

      <div className="mt-8">
        <ProfileForm existing={existing} />
      </div>

      {existing !== null && (
        <form action={clearProfileAction} className="mt-10 border-t border-ink-line pt-6">
          <button
            type="submit"
            className="text-sm text-demanding underline underline-offset-4 hover:text-parchment"
          >
            Delete this profile
          </button>
        </form>
      )}
    </div>
  );
}

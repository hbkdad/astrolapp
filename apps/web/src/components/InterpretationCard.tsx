import type { Interpretation } from '@astrolapp/interpretation-engine';

/**
 * Displays an interpretation with FACT and INTERPRETATION visibly separated.
 *
 * This separation is the product's core honesty commitment made visible: the
 * user can always see which part is a calculated, checkable position and which
 * part is a traditional reading of it. The two are labelled, not merely styled
 * differently, so the distinction survives for screen reader users too.
 */
export function InterpretationCard({
  interpretation,
  headingLevel = 'h3',
}: {
  interpretation: Interpretation;
  headingLevel?: 'h2' | 'h3';
}) {
  const Heading = headingLevel;

  return (
    <article className="panel">
      <Heading className="font-serif text-lg text-parchment">{interpretation.title}</Heading>

      <dl className="mt-4 space-y-4">
        <div>
          <dt className="eyebrow text-steel">Calculated</dt>
          <dd className="mt-1 font-mono text-sm leading-relaxed text-parchment-muted">
            {interpretation.fact}
          </dd>
        </div>

        <div>
          <dt className="eyebrow text-brass">Traditional interpretation</dt>
          <dd className="mt-1 text-sm leading-relaxed text-parchment">
            {interpretation.interpretation}
          </dd>
        </div>
      </dl>

      {interpretation.categories.length > 0 && (
        <ul className="mt-4 flex flex-wrap gap-2" aria-label="Related areas">
          {interpretation.categories.map((category) => (
            <li
              key={category}
              className="rounded-full border border-ink-line px-2.5 py-0.5 text-xs capitalize text-parchment-faint"
            >
              {category.replace(/([A-Z])/g, ' $1')}
            </li>
          ))}
        </ul>
      )}
    </article>
  );
}

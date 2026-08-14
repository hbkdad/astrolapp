/**
 * A category score.
 *
 * Meaning is carried three ways — the number, the written band, and the bar's
 * length — so the component remains fully readable without colour perception.
 * The colour is the least important of the three and only reinforces the band.
 *
 * `confidenceLabel` is shown alongside because 50 with no evidence and 50 from
 * balanced opposing transits mean completely different things, and a bar alone
 * cannot distinguish them.
 */
export function ScoreBar({
  label,
  score,
  band,
  confidenceLabel,
  explanation,
}: {
  label: string;
  score: number;
  band: string;
  confidenceLabel: string;
  explanation: string;
}) {
  const tone = score >= 60 ? 'supported' : score <= 40 ? 'demanding' : 'neutral';
  const barColour =
    tone === 'supported' ? 'bg-supported' : tone === 'demanding' ? 'bg-demanding' : 'bg-steel';

  return (
    <div className="py-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3">
        <span className="font-medium capitalize text-parchment">
          {label.replace(/([A-Z])/g, ' $1')}
        </span>
        <span className="text-sm text-parchment-muted">
          <span className="font-mono text-parchment">{score.toFixed(0)}</span>
          <span aria-hidden="true"> · </span>
          {band}
        </span>
      </div>

      <div
        className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-ink-raised"
        role="img"
        aria-label={`${label}: ${score.toFixed(0)} out of 100, ${band}, based on ${confidenceLabel}`}
      >
        <div className={`h-full ${barColour}`} style={{ width: `${Math.max(2, score)}%` }} />
      </div>

      <p className="mt-2 text-xs leading-relaxed text-parchment-faint">{explanation}</p>
    </div>
  );
}

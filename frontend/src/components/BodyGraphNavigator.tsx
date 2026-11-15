import { useEffect, useState } from 'react';
import { History, RotateCcw, Search, Info } from 'lucide-react';
import {
  BODY_SYSTEMS,
  evidenceLabels,
  systemEvidence,
  regionForPart,
} from '../data/bodyGraph';
import { baselineDifference } from '../data/missionMonitoring';
import type { Crew } from '../data/fixtures';
import type { SavedCheckIn, FollowUpEvent } from '../types/api';
import { loadFollowUps } from '../api';

type Props = {
  crew: Crew;
  records: SavedCheckIn[];
  history: SavedCheckIn[];
  record?: SavedCheckIn;
  replaying: boolean;
  part: string;
  loading: boolean;
  error: string;
  onReplay: (id: string | null) => void;
  onPart: (part: string) => void;
  onInvestigate: (id: string) => void;
};

export function BodyGraphNavigator({
  crew,
  records,
  history,
  record,
  replaying,
  part,
  loading,
  error,
  onReplay,
  onPart,
  onInvestigate,
}: Props) {
  const [open, setOpen] = useState(false);
  const [follow, setFollow] = useState<{
    key: string;
    rows: FollowUpEvent[];
    error: string;
    loading: boolean;
  }>({ key: '', rows: [], error: '', loading: false });
  const key = `${crew.id}:${record?.id ?? ''}`;

  useEffect(() => {
    if (!open || !record) return;
    let active = true;
    setFollow({ key, rows: [], error: '', loading: true });
    loadFollowUps(crew.id, record.id)
      .then((rows) => {
        if (active) setFollow({ key, rows, error: '', loading: false });
      })
      .catch((e) => {
        if (active)
          setFollow({ key, rows: [], error: e.message, loading: false });
      });
    return () => {
      active = false;
    };
  }, [key, open, crew.id, record?.id]);

  return (
    <section
      className="bodygraph-navigator"
      aria-label="BodyGraph evidence navigator"
      data-crew={crew.id}
      data-check-in-id={record?.id ?? ''}
    >
      <div className="bgn-replay-bar">
        <label className="bgn-replay-label">
          <History size={14} className="bgn-icon-accent" />
          <select
            className="bgn-select"
            aria-label="Mission replay"
            disabled={loading || !records.length}
            value={replaying ? record?.id ?? '' : 'latest'}
            onChange={(e) =>
              onReplay(e.target.value === 'latest' ? null : e.target.value)
            }
          >
            <option value="latest">Latest recorded observation</option>
            {records.map((r) => (
              <option value={r.id} key={r.id}>
                {r.recorded_at.slice(0, 16).replace('T', ' ')} · {r.id}
              </option>
            ))}
          </select>
        </label>
        {replaying && (
          <button
            className="bgn-reset-btn"
            type="button"
            onClick={() => onReplay(null)}
            title="Return to latest observation"
          >
            <RotateCcw size={13} />
            <span>Latest</span>
          </button>
        )}
      </div>

      {loading && (
        <p className="bgn-status" role="status">
          Loading BodyGraph evidence…
        </p>
      )}
      {error && <p className="bgn-status error">{error}</p>}

      <div
        className="bodygraph-system-list"
        role="group"
        aria-label="Body-system evidence map"
      >
        {BODY_SYSTEMS.map((system) => {
          const { state } = systemEvidence(system.id, record, crew);
          const isSelected = regionForPart(part) === system.id;
          return (
            <button
              key={system.id}
              type="button"
              className={`bgn-system-pill ${isSelected ? 'active' : ''}`}
              aria-pressed={isSelected}
              aria-label={`Select ${system.label}`}
              title={evidenceLabels(state).join(' · ')}
              onClick={() => onPart(system.part)}
            >
              <span>{system.short}</span>
              <span
                className="bodygraph-evidence-marks"
                aria-label={evidenceLabels(state).join('; ')}
              >
                {state.recorded && <i className="evidence-recorded">●</i>}
                {state.changed && <i className="evidence-change">◇</i>}
                {state.missing && <i className="evidence-missing">?</i>}
                {state.review && <i className="evidence-review">↗</i>}
              </span>
            </button>
          );
        })}
      </div>

      <div className="bgn-legend" aria-label="Evidence map legend">
        <span>
          <i className="evidence-recorded">●</i> Recorded
        </span>
        <span>
          <i className="evidence-change">◇</i> Changed
        </span>
        <span>
          <i className="evidence-missing">?</i> Missing
        </span>
        <span>
          <i className="evidence-review">↗</i> Review
        </span>
      </div>

      <div className="bgn-accordions">
        <details className="bgn-details">
          <summary>Cross-system observations ({history.slice(-7).length})</summary>
          <ol aria-label="Cross-system recorded observations">
            {history.slice(-7).map((r) => (
              <li key={r.id}>
                <strong>
                  <time dateTime={r.recorded_at}>
                    {r.recorded_at.slice(0, 16).replace('T', ' ')}
                  </time>
                </strong>{' '}
                · HR {r.hr ?? 'Unknown'} (Δ
                {baselineDifference(r.hr, crew.baseline)}) · Sleep{' '}
                {r.sleep ?? 'Unknown'}h · BP {r.bp ?? 'Unknown'}
                {r.symptoms.length > 0 && (
                  <div className="bgn-acc-sym">
                    Symptoms: {r.symptoms.join(', ')}
                  </div>
                )}
              </li>
            ))}
          </ol>
        </details>

        <details
          className="bgn-details"
          onToggle={(e) => setOpen(e.currentTarget.open)}
        >
          <summary>Recorded follow-up</summary>
          {(follow.key !== key || follow.loading) && open && record && (
            <p role="status">Loading recorded follow-up…</p>
          )}
          {follow.key === key && follow.error && (
            <p role="alert">{follow.error}</p>
          )}
          {follow.key === key && !follow.loading && !follow.error && (
            <ul>
              {follow.rows.length ? (
                follow.rows.slice(-5).map((event) => (
                  <li key={event.id}>
                    <strong>{event.event_type}</strong> ·{' '}
                    {event.recorded_at.slice(0, 16).replace('T', ' ')} —{' '}
                    {event.note ?? 'No note'}
                  </li>
                ))
              ) : (
                <li>No follow-up events recorded.</li>
              )}
            </ul>
          )}
        </details>
      </div>

      <div className="bgn-footer-row">
        <span
          className="bgn-info-chip"
          title="States describe saved evidence, not risk, disease, or medical approval."
        >
          <Info size={13} />
          <span>Evidence only</span>
        </span>
        <button
          type="button"
          className="bgn-investigate-btn"
          disabled={!record || loading || !!error}
          onClick={() => record && onInvestigate(record.id)}
        >
          <Search size={13} />
          <span>Investigate replay</span>
        </button>
      </div>
    </section>
  );
}

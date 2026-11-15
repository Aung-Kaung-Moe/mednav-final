import { useCallback, useEffect, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  BookOpen,
  CheckCircle2,
  ClipboardCheck,
  Droplets,
  FileText,
  HeartPulse,
  Moon,
  Pill,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { investigationApi } from '../api';
import type { Crew } from '../data/fixtures';
import {
  getClinicalResourcesForSuggestion,
  getOfflineHealthCareGuide,
} from '../data/medicalReferences';
import type {
  InvestigationSessionDTO,
  SavedCheckIn,
} from '../types/api';

type Props = {
  live?: boolean;
  crew: Crew;
  liveRecord?: SavedCheckIn | null;
  onStockChanged?: () => Promise<void> | void;
  go: (p: number) => void;
};

export function IterativeInvestigation({
  live = true,
  crew,
  liveRecord,
  onStockChanged,
  go,
}: Props) {
  const [session, setSession] = useState<InvestigationSessionDTO | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [numericInput, setNumericInput] = useState('');

  const loadLatest = useCallback(async () => {
    if (!live) return;
    setLoading(true);
    setError('');
    try {
      const dto = await investigationApi.getLatestSession(crew.id);
      setSession(dto);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [live, crew.id, liveRecord?.id]);

  useEffect(() => {
    void loadLatest();
  }, [loadLatest]);

  const handleAnswer = async (questionId: string, answerValue: string) => {
    if (!session) return;
    setSubmitting(true);
    setError('');
    try {
      const parsedNum =
        numericInput.trim() !== '' && Number.isFinite(Number(numericInput))
          ? Number(numericInput)
          : undefined;
      const dto = await investigationApi.submitAnswer(session.id, {
        question_id: questionId,
        answer_value: answerValue,
        numeric_value: parsedNum,
      });
      setSession(dto);
      setNumericInput('');
      if (questionId === 'mission_duration_check') {
        await onStockChanged?.();
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDispense = async (medicationId?: string) => {
    if (!session) return;
    setSubmitting(true);
    setError('');
    try {
      const dto = await investigationApi.dispenseAllocation(session.id, medicationId);
      setSession(dto);
      await onStockChanged?.();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  if (!live) {
    return (
      <div className="mission-console space-subpage">
        <div className="subpage-top-bar">
          <button type="button" className="hairline-pill-btn" onClick={() => go(0)}>
            <ArrowLeft size={16} /> Overview
          </button>
          <div className="wide-planetary-label">
            I T E R A T I V E &nbsp; I N V E S T I G A T I O N
          </div>
          <span />
        </div>
        <div className="right-frosted-sheet" style={{ maxWidth: 680, margin: '24px auto' }}>
          <h2>Backend Required for Investigation</h2>
          <p className="telemetry-summary-copy">
            Switch to Live FastAPI mode in Footer → Developer tools to run the iterative investigation and mission medication rationing.
          </p>
        </div>
      </div>
    );
  }

  const snap = session?.check_in_snapshot;
  const alloc = session?.medication_allocation;
  const q = session?.current_question;
  const isCompleted = session?.status === 'completed';
  const healthCareGuide = getOfflineHealthCareGuide(session?.condition_id, alloc?.medication_id);
  const titleText = session?.assessment_title ?? '';
  const isUrgentOutcome = /urgent|fever|tachycardia|alert/i.test(titleText);
  const isClearOutcome = /normal|clear|workout/i.test(titleText);
  const outcomeTone = isUrgentOutcome ? 'urgent' : isClearOutcome ? 'clear' : 'info';

  const getChipVisual = (text: string) => {
    const lower = text.toLowerCase();
    if (lower.includes('heart rate')) return { tone: 'chip-hr', Icon: HeartPulse };
    if (lower.includes('sleep')) return { tone: 'chip-sleep', Icon: Moon };
    if (lower.includes('symptom')) return { tone: 'chip-symptoms', Icon: Activity };
    return { tone: 'is-alert', Icon: Sparkles };
  };

  const getMedVisual = (medId: string | null | undefined) => {
    if (medId === 'oral_rehydration_salts') return { tone: 'is-cyan', Icon: Droplets };
    if (medId === 'melatonin_3mg') return { tone: 'is-violet', Icon: Moon };
    if (medId === 'ondansetron_8mg' || medId === 'meclizine_25mg') return { tone: 'is-amber', Icon: Activity };
    return { tone: 'is-rose', Icon: Pill };
  };

  return (
    <div
      className="mission-console mars-configurator-screen"
      data-testid="iterative-investigation"
      data-status={session?.status ?? 'loading'}
    >
      {/* TOP BAR (matches Dashboard header anatomy) */}
      <div className="dashboard-header-bar inv-header-bar">
        <div className="dash-title-group">
          <h1 className="section-sans-headline" data-testid="investigation-crew-label">
            {crew.id} · Health Investigation
          </h1>
        </div>

        <div className="dashboard-header-actions">
          <button
            type="button"
            className="hairline-pill-btn"
            onClick={() => go(0)}
          >
            <ArrowLeft size={14} /> Overview
          </button>
          <button
            type="button"
            className="hairline-pill-btn"
            onClick={() => go(4)}
          >
            <Pill size={14} /> View Medical Inventory
          </button>
        </div>
      </div>

      {error && (
        <p role="alert" className="error" style={{ margin: '12px 0' }}>
          {error}
        </p>
      )}

      {loading && !session ? (
        <div className="command-card" style={{ padding: 24 }}>
          <p className="telemetry-summary-copy">Loading investigation…</p>
        </div>
      ) : (
        <div className="inv-workspace">
          {/* LEFT: ITERATIVE QUESTIONS OR FINAL MEDICATION ADVICE */}
          <div className="inv-main-column">
            {/* ACTIVE QUESTION CARD */}
            {session?.status === 'in_progress' && q && (
              <section className="command-card inv-question-card" aria-label="Current investigation question">
                <header className="command-card-header">
                  <div className="command-card-title">
                    <Activity size={17} />
                    <span>Check-In Questions</span>
                  </div>
                  <span className="realtime-tag">
                    STEP {session.turn_count + 1} / {session.max_turns} · {crew.id.toUpperCase()}
                  </span>
                </header>
                <h2 className="inv-question-prompt">{q.prompt}</h2>
                <p className="inv-question-rationale">{q.rationale}</p>

                {q.required_equipment && (
                  <div className="inv-equipment-tag">
                    Device: <strong>{q.required_equipment}</strong> —{' '}
                    <span className={q.equipment_usable ? 'ok-txt' : 'unknown-val'}>
                      {q.equipment_usable ? 'Available' : 'Unavailable'}
                    </span>
                  </div>
                )}

                {q.supports_numeric_input && (
                  <div className="inv-numeric-row">
                    <label>
                      {q.numeric_label ?? 'Value'} ({q.numeric_unit ?? ''}):
                      <input
                        type="number"
                        step={q.id === 'mission_duration_check' ? 1 : 0.1}
                        min={q.id === 'mission_duration_check' ? 1 : undefined}
                        placeholder={q.id === 'mission_duration_check' ? 'e.g. 60' : 'e.g. 37.1'}
                        value={numericInput}
                        onChange={(e) => setNumericInput(e.target.value)}
                      />
                      {q.id === 'mission_duration_check' && numericInput.trim() !== '' && (
                        <button
                          type="button"
                          className="hairline-pill-btn"
                          disabled={submitting}
                          onClick={() => void handleAnswer('mission_duration_check', '45')}
                        >
                          Confirm Days
                        </button>
                      )}
                      {q.id === 'temperature_check' && numericInput.trim() !== '' && (
                        <button
                          type="button"
                          className="hairline-pill-btn active"
                          disabled={submitting}
                          onClick={() =>
                            void handleAnswer(
                              'temperature_check',
                              Number(numericInput) >= 38.0 ? 'elevated' : 'normal'
                            )
                          }
                        >
                          Confirm Temp
                        </button>
                      )}
                    </label>
                  </div>
                )}

                <div className="inv-options-grid">
                  {q.options.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      disabled={submitting}
                      className={`inv-option-btn tone-${opt.tone}`}
                      onClick={() => void handleAnswer(q.id, opt.value)}
                    >
                      <span>{opt.label}</span>
                    </button>
                  ))}
                </div>
              </section>
            )}

            {/* FINAL RESULT & MEDICATION INSTRUCTION */}
            {isCompleted && alloc && (
              <section
                className={`command-card inv-outcome-card tone-${outcomeTone} mode-${session?.dispensed ? 'standard' : alloc.rationing_mode}`}
                aria-label="Investigation outcome and medication allocation"
              >
                <div className="inv-outcome-hero">
                  {isUrgentOutcome ? (
                    <HeartPulse size={20} className="vital-icon coral-txt" />
                  ) : isClearOutcome ? (
                    <ShieldCheck size={20} className="inv-bare-accent" />
                  ) : (
                    <CheckCircle2 size={20} className="inv-bare-accent" />
                  )}
                  <h2 className="inv-outcome-title">{session?.assessment_title}</h2>
                </div>
                <p className="telemetry-summary-copy inv-outcome-summary">{session?.assessment_summary}</p>

                {healthCareGuide?.condition?.immediate_actions[0] && (
                  <div className="inv-care-pill" data-testid="offline-healthcare-guide">
                    <ShieldCheck size={15} className="inv-bare-accent" aria-hidden="true" />
                    <div>
                      <strong>Care:</strong> {healthCareGuide.condition.immediate_actions[0]}
                    </div>
                  </div>
                )}

                <div className="inv-allocation-box">
                  <div className="inv-alloc-head">
                    {alloc.medication_id && (
                      <Pill size={16} className="inv-bare-accent" aria-hidden="true" />
                    )}
                    <p className="inv-alloc-schedule">
                      {alloc.medication_name ? (
                        <>
                          <strong>{alloc.medication_name}</strong> ·{' '}
                        </>
                      ) : null}
                      {session?.dispensed
                        ? `Deducted ${session.dispensed_units} ${alloc.unit} for ${crew.id} (${alloc.stock_available} ${alloc.unit} left).`
                        : alloc.dosage_schedule
                            .replace(/\s*\([^)]*reserving[^)]*\)/i, '')
                            .replace(/\s*\([^)]*\btotal\)/gi, '')}
                    </p>
                  </div>

                  {alloc.medication_id && (
                    <div className="inv-ration-metrics">
                      <div className="inv-metric-card">
                        <small>Stock</small>
                        <strong className={alloc.stock_available === 0 ? 'coral-txt' : ''}>
                          {alloc.stock_available} {alloc.unit}
                        </strong>
                      </div>
                      <div className="inv-metric-card">
                        <small>Crew Reserve</small>
                        <strong>
                          {alloc.crew_safety_reserve} {alloc.unit}
                        </strong>
                      </div>
                      <div className="inv-metric-card">
                        <small>Standard</small>
                        <strong>
                          {alloc.standard_total_units} {alloc.unit}
                        </strong>
                      </div>
                      <div className="inv-metric-card is-recommended">
                        <small>Recommended</small>
                        <strong className="inv-highlight-dose">
                          {session?.dispensed ? session.dispensed_units : alloc.recommended_total_units} {alloc.unit}
                        </strong>
                      </div>
                    </div>
                  )}

                  <div className="inv-outcome-actions">
                    {alloc.medication_id && !session?.dispensed && alloc.recommended_total_units > 0 && (
                      <button
                        type="button"
                        className="hairline-pill-btn active inv-take-btn"
                        disabled={submitting}
                        onClick={() => void handleDispense()}
                      >
                        <ClipboardCheck size={14} />
                        <span>
                          Take {alloc.recommended_total_units} {alloc.unit}
                        </span>
                      </button>
                    )}

                    <button
                      type="button"
                      className="hairline-pill-btn inv-action-inventory"
                      onClick={() => go(4)}
                    >
                      <Pill size={14} /> Check Medical Inventory
                    </button>

                    <button
                      type="button"
                      className="hairline-pill-btn inv-action-report"
                      onClick={() => go(5)}
                    >
                      <FileText size={14} /> Incident Report
                    </button>
                  </div>
                </div>
              </section>
            )}

            {/* CO-TREATMENT CARD */}
            {isCompleted && (session?.secondary_allocations?.length ?? 0) > 0 && (
              <section className="command-card inv-secondary-card">
                <header className="command-card-header">
                  <div className="command-card-title">
                    <Pill size={17} />
                    <span>Co-Treatments for {crew.id}</span>
                  </div>
                  <span className="realtime-tag">
                    {session!.secondary_allocations.length} AVAILABLE
                  </span>
                </header>
                <div className="inv-secondary-list">
                  {session!.secondary_allocations.map((sec) => {
                    const secTaken = Boolean(
                      sec.medication_id &&
                        session?.dispensed_secondary_ids?.includes(sec.medication_id)
                    );
                    const { tone, Icon } = getMedVisual(sec.medication_id);
                    return (
                      <div key={sec.medication_id ?? sec.instruction_headline} className="inv-secondary-item">
                        <div className="inv-secondary-lead">
                          <Icon size={16} className={`inv-bare-icon ${tone}`} aria-hidden="true" />
                          <div className="inv-secondary-copy">
                            <strong>
                              {sec.medication_name} · {sec.recommended_total_units} {sec.unit}
                            </strong>
                            <p>{sec.dosage_schedule.replace(/\s*\([^)]*\btotal\)/gi, '')}</p>
                          </div>
                        </div>
                        {sec.medication_id && !secTaken && sec.recommended_total_units > 0 && (
                          <button
                            type="button"
                            className="hairline-pill-btn inv-secondary-take-btn"
                            disabled={submitting}
                            onClick={() => void handleDispense(sec.medication_id ?? undefined)}
                          >
                            Take {sec.recommended_total_units} {sec.unit}
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </section>
            )}
          </div>

          {/* RIGHT: SNAPSHOT + POSSIBLE CAUSES + REFERENCES */}
          <aside className="command-card inv-hypotheses-col" aria-label="Possible causes and snapshot">
            {snap && (
              <div className="inv-side-section">
                <header className="command-card-header inv-side-header">
                  <div className="command-card-title">
                    <HeartPulse size={16} />
                    <span>{crew.id} · Daily Telemetry</span>
                  </div>
                </header>
                <div className="inv-chip-row">
                  {snap.anomalies.length > 0 ? (
                    snap.anomalies.map((item, idx) => {
                      const cleanItem = item.replace(/\s*\(normal [^)]+\)/i, '');
                      const { tone, Icon } = getChipVisual(cleanItem);
                      return (
                        <span key={idx} className={`inv-data-chip ${tone}`}>
                          <Icon size={12} className={`inv-bare-icon ${tone}`} /> {cleanItem}
                        </span>
                      );
                    })
                  ) : (
                    <span className="inv-data-chip chip-ok">
                      <ShieldCheck size={12} className="inv-bare-accent" /> Normal Baseline
                    </span>
                  )}
                  {snap.missing_fields.map((f) => (
                    <span key={f} className="inv-data-chip is-missing">
                      <AlertTriangle size={12} className="inv-bare-icon is-missing" /> Missing: {f}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div className="inv-side-section">
              <div className="trace-header-line">
                <span className="micro-label inv-causes-title">
                  POSSIBLE CAUSES
                </span>
              </div>

              <div className="inv-hyp-list">
                {(session?.hypotheses ?? [])
                  .filter((h) => !isCompleted || h.status !== 'ruled_out')
                  .slice(0, 3)
                  .map((h, idx) => {
                    const barTone =
                      idx === 0
                        ? isUrgentOutcome
                          ? 'bar-rose'
                          : 'bar-cyan'
                        : 'bar-muted';
                    return (
                      <div key={h.id} className={`inv-hyp-item status-${h.status} ${barTone}`}>
                        <div className="inv-hyp-head">
                          <strong>{h.label}</strong>
                          <span className={`inv-hyp-badge badge-${h.status} ${barTone}`}>
                            {h.status.replace('_', ' ')}
                          </span>
                        </div>
                        {h.status === 'leading' && <small>{h.reason}</small>}
                      </div>
                    );
                  })}
              </div>
            </div>

            {isCompleted && (alloc?.medication_id || (session?.condition_id && session.condition_id !== 'routine_observation')) && (
              <div className="inv-side-section inv-ref-sidebar" data-testid="medication-source-links">
                <span className="micro-label">REFERENCES</span>
                <div className="inv-ref-links">
                    {getClinicalResourcesForSuggestion(
                      alloc?.medication_id,
                      (session?.secondary_allocations?.length ?? 0) > 0,
                      session?.condition_id
                    )
                      .slice(0, 2)
                      .map((res) => (
                      <a
                        key={res.id}
                        href={res.referenceUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inv-ref-card-link"
                      >
                        <BookOpen size={13} className="inv-bare-accent" />
                        <span>{res.shortCitation} ↗</span>
                      </a>
                    ))}
                </div>
              </div>
            )}
          </aside>
        </div>
      )}
    </div>
  );
}

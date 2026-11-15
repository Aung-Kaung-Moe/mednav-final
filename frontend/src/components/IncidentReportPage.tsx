import { useEffect, useState } from 'react';
import { reportApi } from '../api';
import type { MedicalReportDTO, ReportSnapshotDTO } from '../types/api';
import '../reporting.css';

const date = (value:string|null|undefined) => value
  ? `${new Date(value).toISOString().replace('T', ' ').slice(0, 16)} UTC`
  : 'Not recorded';
const reading = (value:number|string|null|undefined, unit='') => value == null ? 'Not recorded' : `${value}${unit}`;

export function IncidentReportPage({ crewId, go }: {crewId:string; go:(page:number)=>void}) {
  const [snapshot, setSnapshot] = useState<ReportSnapshotDTO|null>(null);
  const [latest, setLatest] = useState<MedicalReportDTO|null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    setBusy(true);
    setError('');
    setSnapshot(null);
    setLatest(null);
    Promise.all([reportApi.preview(crewId), reportApi.list(crewId)])
      .then(([current, reports]) => {
        if (!active) return;
        setSnapshot(current);
        setLatest(reports[0] ?? null);
      })
      .catch((cause:Error) => { if (active) setError(cause.message); })
      .finally(() => { if (active) setBusy(false); });
    return () => { active = false; };
  }, [crewId]);

  async function generate() {
    setBusy(true);
    setError('');
    try {
      const report = await reportApi.create(crewId);
      const response = await fetch(reportApi.pdfUrl(report.id, report.version, true));
      if (!response.ok) throw new Error('The PDF was saved, but its download failed. Use the latest PDF link below.');
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement('a');
      link.href = url;
      link.download = report.pdf_name;
      document.body.append(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 60000);
      setLatest(report);
      setSnapshot(report.snapshot);
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const records = snapshot?.measurements ?? [];
  const newest = [...records].reverse();
  const mostRecent = (key:'hr'|'sleep'|'bp') => newest.find(row => row[key] != null);
  const hr = mostRecent('hr');
  const sleep = mostRecent('sleep');
  const bp = mostRecent('bp');
  const symptoms = [...new Map(snapshot?.symptoms.map(item => [item.name, item]) ?? []).values()];
  const taken = snapshot?.medications.filter(med => med.status === 'taken') ?? [];

  return <div className="medical-report-page space-subpage">
    <header className="mr-top"><button className="hairline-pill-btn" onClick={() => go(0)}>Overview</button><span>MEDNAV / INCIDENT REPORT</span></header>
    <div className="mr-intro">
      <div><span className="micro-label">{crewId.toUpperCase()} · LAST 7 DAYS</span><h1>Health report</h1><p>Your recorded health information in one place.</p></div>
      <button className="hairline-pill-btn active mr-generate" disabled={busy || !snapshot} onClick={generate}>
        {busy ? 'Preparing PDF…' : 'Generate & download PDF'}
      </button>
    </div>
    {error && <p className="mr-error" role="alert">{error}</p>}
    {busy && !snapshot && <p role="status">Loading health records…</p>}
    {snapshot && <>
      <p className="mr-period">{date(snapshot.period_start)} – {date(snapshot.period_end)}</p>
      <div className="mr-metrics" aria-label="Recorded health measurements">
        <div className="mr-metric"><span>Heart rate</span><strong>{reading(hr?.hr, ' bpm')}</strong><small>{date(hr?.recorded_at)}</small></div>
        <div className="mr-metric"><span>Sleep duration</span><strong>{reading(sleep?.sleep, ' hours')}</strong><small>{date(sleep?.recorded_at)}</small></div>
        <div className="mr-metric"><span>Blood pressure</span><strong>{reading(bp?.bp, ' mmHg')}</strong><small>{date(bp?.recorded_at)}</small></div>
      </div>
      <div className="mr-details">
        <section className="mr-card"><h2>Symptoms</h2>{symptoms.length
          ? <ul className="mr-list">{symptoms.map(symptom => <li key={symptom.name}><strong>{symptom.name}</strong><span>Last reported {date(symptom.recorded_at)}</span></li>)}</ul>
          : <p>No symptoms reported in the last 7 days.</p>}</section>
        <section className="mr-card"><h2>Medicines taken</h2>{taken.length
          ? <ul className="mr-list mr-medicine-list">{taken.map(med => <li key={med.id}><strong>{med.medication_name} · {med.dose || 'Amount not recorded'}</strong><span>Taken by {med.astronaut_id} · {med.taken_at ? date(med.taken_at) : `Recorded ${date(med.recorded_at)} (take time unknown)`}</span></li>)}</ul>
          : <p>No medicines taken are documented in the last 7 days.</p>}</section>
      </div>
      {latest && <p className="mr-last-pdf">Latest saved PDF: <a href={reportApi.pdfUrl(latest.id, latest.version, true)}>{date(latest.created_at)} · Download again</a></p>}
      <p className="mr-note">Synthetic demonstration data · Not a real medical record. The PDF includes recorded readings, symptoms and medicines taken. Missing values stay unrecorded.</p>
    </>}
  </div>;
}

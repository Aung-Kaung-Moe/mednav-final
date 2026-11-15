import type {SavedCheckIn} from '../types/api';
import {regionForPart} from './bodyGraph';

// Selection and ordering only: no medical interpretation or decision rules.
export function orderedRecords(rows: SavedCheckIn[], crewId: string): SavedCheckIn[] {
  if (rows.some(row => row.astronaut_id !== crewId || !Number.isFinite(Date.parse(row.recorded_at)))) {
    throw new Error('History contains a mismatched crew or invalid observation timestamp.');
  }
  // SQLite/Python retains microseconds. Date.parse truncates to milliseconds;
  // compare the remaining fractional digits before using ID as a stable tie-break.
  const fraction=(timestamp:string)=>(timestamp.match(/\.(\d+)(?:Z|[+-]\d{2}:\d{2})$/i)?.[1]??'').slice(3).padEnd(9,'0');
  return [...rows].sort((a,b) => Date.parse(a.recorded_at)-Date.parse(b.recorded_at) || fraction(a.recorded_at).localeCompare(fraction(b.recorded_at)) || a.id.localeCompare(b.id));
}

export const bodyRegion=regionForPart;

// Conservative text matching exposes reports only; it cannot establish an ocular finding.
export function visualSymptoms(row: SavedCheckIn): string[] {
  return row.symptoms.filter(s => /\b(vision|visual|eyes?|ocular|sight|blurry|blurred|floaters|photophobia)\b/i.test(s));
}

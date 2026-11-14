import type { Astronaut, Equipment, HealthHistory, InvestigationRequest, InvestigationResponse, Measurements } from './types'

export const demoAstronauts: Astronaut[] = [
  { astronaut_id: 'A01', display_name: 'Commander Alex Morgan', dataset_type: 'synthetic' },
  { astronaut_id: 'A02', display_name: 'Mission Specialist Taylor Chen', dataset_type: 'synthetic' },
  { astronaut_id: 'A03', display_name: 'Flight Engineer Sam Rivera', dataset_type: 'synthetic' },
  { astronaut_id: 'A04', display_name: 'Science Officer Jordan Ellis', dataset_type: 'synthetic' },
]
export const demoInventory: Equipment[] = [
  { equipment_id: 'bp_monitor', label: 'Blood-pressure monitor', quantity: 0, usable: false, dataset_type: 'synthetic' },
  { equipment_id: 'thermometer', label: 'Digital thermometer', quantity: 1, usable: true, dataset_type: 'synthetic' },
  { equipment_id: 'pulse_oximeter', label: 'Pulse oximeter', quantity: 1, usable: true, dataset_type: 'synthetic' },
  { equipment_id: 'ecg_device', label: 'ECG device', quantity: 0, usable: false, dataset_type: 'synthetic' },
]
const dates = ['2026-11-10T08:00:00Z', '2026-11-11T08:00:00Z', '2026-11-12T08:00:00Z', '2026-11-13T08:00:00Z']
const crew: Record<string, { hr: number; sleep: number; hrs: (number | null)[]; sleeps: (number | null)[] }> = {
  A01: { hr: 70, sleep: 7.3, hrs: [70, 72, null, 81], sleeps: [7.3, null, 5.8, 4.9] },
  A02: { hr: 66, sleep: 7.5, hrs: [67, 68, 69, 66], sleeps: [7.8, 7.4, 7.3, 7.5] },
  A03: { hr: 73, sleep: 6.9, hrs: [74, 72, 75, 73], sleeps: [6.9, 7.0, 6.6, 7.1] },
  A04: { hr: 69, sleep: 7.2, hrs: [69, 71, 70, 68], sleeps: [7.2, 6.9, 7.5, 7.1] },
}
export function demoHealthFor(id: string): HealthHistory {
  const d = crew[id] ?? crew.A01
  return {
    astronaut_id: id,
    baseline: { resting_hr_bpm: d.hr, sleep_hours: d.sleep },
    series: dates.map((observed_at, i) => ({
      observed_at,
      resting_hr_bpm: d.hrs[i],
      sleep_hours: d.sleeps[i],
    })),
    dataset_type: 'synthetic',
  }
}
export function defaultMeasurementsFor(id: string): Measurements {
  return id === 'A01'
    ? { resting_hr_bpm: 88, sleep_hours: 4.2, systolic_bp_mm_hg: null, diastolic_bp_mm_hg: null }
    : { resting_hr_bpm: null, sleep_hours: null, systolic_bp_mm_hg: null, diastolic_bp_mm_hg: null }
}

/** Deterministic, illustration-only fixture. NOT a clinical algorithm. */
export function simulateInvestigation(data: InvestigationRequest): InvestigationResponse {
  const m = data.measurements
  const missing_data = (Object.entries(m) as Array<[keyof Measurements, number | null]>).filter(([,v]) => v === null).map(([key])=>key)
  if (data.emergency_override) {
    return {
      status: 'escalate', observations: data.symptoms.map(s => `Reported symptom: ${s.replaceAll('_', ' ')}`),
      missing_data, resource_constraints: [],
      safety_flags: ['approved_emergency_protocol_required'], next_check: null,
      requires_medical_officer_review: true,
      explanation: 'Emergency workflow triggered by an explicit demo scenario flag. Follow the mission-approved emergency protocol and contact the medical officer. No treatment is provided by this prototype.',
      evidence_sources: ['synthetic:emergency_scenario'], diagnosis: null,
    }
  }
  const observations: string[] = []
  if (data.symptoms.length) observations.push(`Reported symptoms: ${data.symptoms.map(s=>s.replaceAll('_',' ')).join(', ')}`)
  if (m.resting_hr_bpm !== null && data.personal_baseline.resting_hr_bpm !== null && m.resting_hr_bpm !== data.personal_baseline.resting_hr_bpm)
    observations.push('Resting heart rate differs from the recorded personal baseline')
  if (m.sleep_hours !== null && data.personal_baseline.sleep_hours !== null && m.sleep_hours < data.personal_baseline.sleep_hours)
    observations.push('Recorded sleep duration is below the personal baseline')
  const resource_constraints = missing_data.some(k => k.includes('_bp_')) && !data.available_equipment.includes('bp_monitor')
    ? ['bp_monitor unavailable'] : []
  const requiresReview = data.symptoms.length > 0 || observations.length > 0
  return {
    status: requiresReview ? 'needs_review' : 'monitoring', observations,
    missing_data, resource_constraints, safety_flags: [],
    next_check: {
      id: requiresReview ? 'symptom_review_checklist' : 'routine_record_review',
      label: requiresReview ? 'Open the reviewed symptom-assessment checklist' : 'Review the routine health log',
      requires_equipment: [], prototype_only: true,
    },
    requires_medical_officer_review: requiresReview,
    explanation: resource_constraints.length
      ? 'Blood-pressure measurements are unknown and the inventory has no usable blood-pressure monitor. The cause of symptoms remains unknown.'
      : 'This is a simulated workflow recommendation, not a diagnosis. Missing values remain unknown; review records under the mission-approved process.',
    evidence_sources: ['synthetic:investigation_demo_v1'], diagnosis: null,
  }
}

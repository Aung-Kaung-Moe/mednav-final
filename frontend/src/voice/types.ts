/** MEDNAV API_CONTRACT.md v1. Do not rename or expand backend fields without agreement. */
export type DatasetType = 'synthetic'
export type CommunicationStatus = 'offline' | 'online'
export type UiMode = 'demo' | 'api'

export type Measurements = {
  resting_hr_bpm: number | null
  sleep_hours: number | null
  systolic_bp_mm_hg: number | null
  diastolic_bp_mm_hg: number | null
}
export type PersonalBaseline = {
  resting_hr_bpm: number | null
  sleep_hours: number | null
}
export type Astronaut = {
  astronaut_id: string
  display_name: string
  dataset_type: DatasetType
}
export type HealthHistory = {
  astronaut_id: string
  baseline: PersonalBaseline
  series: Array<{ observed_at: string; resting_hr_bpm: number | null; sleep_hours: number | null }>
  dataset_type: DatasetType
}
export type Equipment = {
  equipment_id: string
  label: string
  quantity: number
  usable: boolean
  dataset_type: DatasetType
}
export type InvestigationRequest = {
  astronaut_id: string
  observed_at: string
  symptoms: string[]
  measurements: Measurements
  personal_baseline: PersonalBaseline
  available_equipment: string[]
  communication_status: CommunicationStatus
  emergency_override: boolean
  dataset_type: DatasetType
}
export type CheckinRequest = Pick<InvestigationRequest, 'astronaut_id'|'observed_at'|'symptoms'|'measurements'|'dataset_type'>
export type CheckinResult = { checkin_id: string; saved: boolean }
export type NextCheck = {
  id: string
  label: string
  requires_equipment: string[]
  prototype_only: boolean
}
export type InvestigationResponse = {
  status: string
  observations: string[]
  missing_data: string[]
  resource_constraints: string[]
  safety_flags: string[]
  next_check: NextCheck | null
  requires_medical_officer_review: boolean
  explanation: string
  evidence_sources: string[]
  diagnosis: null
}

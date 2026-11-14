import { demoAstronauts, demoHealthFor, demoInventory, simulateInvestigation } from './demo'
import type { Astronaut, CheckinRequest, CheckinResult, Equipment, HealthHistory, InvestigationRequest, InvestigationResponse, UiMode } from './types'

const apiBase = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000').replace(/\/$/, '')
let nextDemoCheckinId = 1

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${apiBase}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  })
  const raw = await response.text()
  let data: unknown = null
  try { data = raw ? JSON.parse(raw) : null } catch { throw new Error(`API returned invalid JSON (${response.status})`) }
  if (!response.ok) {
    const envelope = data as { error?: { message?: string } } | null
    throw new Error(envelope?.error?.message || `API request failed: ${response.status}`)
  }
  return data as T
}

export function apiFor(mode: UiMode) {
  if (mode === 'demo') return {
    astronauts: async (): Promise<Astronaut[]> => structuredClone(demoAstronauts),
    health: async (id: string): Promise<HealthHistory> => demoHealthFor(id),
    inventory: async (): Promise<Equipment[]> => structuredClone(demoInventory),
    checkin: async (_data: CheckinRequest): Promise<CheckinResult> => ({ checkin_id: `demo-${nextDemoCheckinId++}`, saved: true }),
    investigate: async (data: InvestigationRequest): Promise<InvestigationResponse> => simulateInvestigation(data),
  }
  return {
    astronauts: () => request<Astronaut[]>('/api/v1/astronauts'),
    health: (id: string) => request<HealthHistory>(`/api/v1/astronauts/${encodeURIComponent(id)}/health`),
    inventory: () => request<Equipment[]>('/api/v1/inventory'),
    checkin: (data: CheckinRequest) => request<CheckinResult>('/api/v1/checkins', { method: 'POST', body: JSON.stringify(data) }),
    investigate: (data: InvestigationRequest) => request<InvestigationResponse>('/api/v1/investigations', { method: 'POST', body: JSON.stringify(data) }),
  }
}

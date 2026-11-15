import type {
  CrewProactiveAlertDTO,
  InvestigationSessionDTO,
  MissionContextDTO,
  SavedCheckIn as Saved,
} from './types/api';

export const API =
  (import.meta as unknown as { env: Record<string, string> }).env.VITE_API_URL || 'http://127.0.0.1:8000/api/v1';

async function request<T>(path: string, method = 'GET', body?: unknown): Promise<T> {
  let response: Response;
  try {
    response = await fetch(API + path, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(10000),
    });
  } catch {
    throw new Error('Backend unavailable. Start FastAPI or explicitly select local fixture mode.');
  }
  const data = await response.json();
  if (!response.ok) {
    throw new Error(typeof data.detail === 'string' ? data.detail : `API ${response.status}: invalid request`);
  }
  return data;
}

export const investigationApi = {
  getCrewAlerts: () => request<CrewProactiveAlertDTO[]>('/investigation/crew-alerts'),
  getMissionContext: () => request<MissionContextDTO>('/investigation/mission-context'),
  updateMissionContext: (patch: {
    crew_count?: number;
    remaining_days?: number;
    medications?: { id: string; quantity: number }[];
  }) => request<MissionContextDTO>('/investigation/mission-context', 'PATCH', patch),
  resetMissionContext: () => request<MissionContextDTO>('/investigation/mission-context/reset', 'POST'),
  getLatestSession: (astronautId: string) =>
    request<InvestigationSessionDTO>(`/investigation/sessions/latest/${encodeURIComponent(astronautId)}`),
  startSession: (payload: { astronaut_id: string; check_in_id?: string }) =>
    request<InvestigationSessionDTO>('/investigation/sessions', 'POST', payload),
  submitAnswer: (
    sessionId: string,
    payload: { question_id: string; answer_value: string; numeric_value?: number }
  ) =>
    request<InvestigationSessionDTO>(
      `/investigation/sessions/${encodeURIComponent(sessionId)}/answer`,
      'POST',
      payload
    ),
  dispenseAllocation: (sessionId: string, medicationId?: string) =>
    request<InvestigationSessionDTO>(
      `/investigation/sessions/${encodeURIComponent(sessionId)}/dispense`,
      'POST',
      medicationId ? { medication_id: medicationId } : undefined
    ),
  createSyntheticCheckIn: (payload: {
    astronaut_id: string;
    hr: number | null;
    sleep: number | null;
    bp: string | null;
    symptoms: string[];
  }) => request<Saved>('/check-ins', 'POST', payload),
};

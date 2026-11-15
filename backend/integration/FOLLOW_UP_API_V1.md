# Follow-up workflow API v1

Additive MEDNAV v2 contract. Existing check-in, inventory, history, investigation and report semantics are unchanged. OpenAPI: `/openapi.json`; interactive `/docs` remains disabled.

## POST /api/v1/follow-ups

Requires a user action. JSON example input:

```json
{"astronaut_id":"Crew A","check_in_id":"demo-A-180","event_type":"note_recorded","note":"Synthetic documentation note for later review."}
```

Required strict string IDs identify an existing synthetic check-in belonging to the named astronaut. `event_type` is exactly one of `review_requested`, `note_recorded`, `action_recorded`. `note` is optional/null for review/action; a note event requires nonblank text. Notes are trimmed, limited to 2000 characters, and returned as plain text. Extra fields are forbidden. Clients cannot supply IDs, provenance, synthetic flags, approvals or timestamps.

HTTP **201** response fields:

| Field | Type / source |
| --- | --- |
| id | server UUID string |
| astronaut_id | validated supplied crew ID |
| check_in_id | validated supplied saved check-in ID |
| event_type | supplied workflow enum |
| note | trimmed string or null |
| recorded_at | server-recorded ISO-8601 UTC datetime; SQLite naive UTC is restored to explicit UTC on reads |
| provenance | server string: `User-recorded workflow event linked to synthetic check-in; no medical approval implied` |
| synthetic | literal true; linked medical record is synthetic |

Timestamps identify event recording time, not when a medical action occurred. The note is a user's assertion, not an independently verified action, officer approval, treatment outcome or transmission to Earth. No engine response is persisted.

## GET /api/v1/astronauts/{astronaut_id}/follow-ups

Returns HTTP **200**, an array of the same event DTOs in ascending `(recorded_at, id)` order. Optional `check_in_id` restricts results to that crew's saved record. Pagination uses `limit` (default 100, range 1–1000) and `offset` (default 0, minimum 0). Empty selections return `[]`. The frontend paginates to retrieve the complete selected history. There is no update/delete endpoint in v1.

## Errors

| Condition | HTTP / JSON |
| --- | --- |
| Unknown astronaut | 404 `{"detail":"Astronaut not found"}` |
| Unknown check-in | 404 `{"detail":"Check-in not found"}` |
| Crew/check-in mismatch | 422 `{"detail":"Check-in does not belong to astronaut"}` |
| Non-synthetic check-in | 422 `{"detail":"Follow-up requires a synthetic check-in"}` |
| Missing/invalid fields, enum, notes, extras, pagination | 422 `{"detail":[{"loc":[...],"msg":"...","type":"..."}]}`; existing redacted validation convention, no echoed input value |
| Unexpected database/server failure | 500 through normal server exception logging; no fabricated saved event |

GET validates a supplied check-in filter as strictly as POST. `insufficient_evidence` remains a valid investigation result, unrelated to follow-up HTTP errors.

## Persistence and isolation

New table `follow_up_events` is created by the existing startup `Base.metadata.create_all`. No original table is dropped, altered or reseeded destructively. Indexed foreign keys reference `astronauts.id` and `check_ins.id`; the backend additionally validates the matching pair and synthetic restriction in the insert session before committing. FK enforcement rejects nonexistent references even for direct database writes. Pair ownership is enforced by the API; bypassing the API with ad hoc SQL is unsupported.

Creation is transactional. Failed validation does not insert an event or mutate check-ins, baselines, inventory or seed records. Notes are user-entered synthetic-demo documentation; do not enter real personal medical information in a shared hackathon database. No authentication or officer identity verification has been added.

Incident JSON exports remain session previews. This API does not persist, approve or synchronize incident reports. Existing Stable v1 engine code and medical rules are untouched.

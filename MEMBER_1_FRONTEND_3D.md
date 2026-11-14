# Member 1 — Frontend, UI/UX, 3D and Optional Voice

## Your mission

Build MEDNAV's astronaut-facing interface. You own `frontend/`; do not implement medical rules in the browser. Everything medical or resource-aware comes from the versioned backend API in `API_CONTRACT.md`.

## Read before coding

`AGENTS.md` → `PROJECT_SPEC.md` → `API_CONTRACT.md` → `ARCHITECTURE.md` → this file.

## Build in this order

1. Vite + React + TypeScript app with simple navigation.
2. Astronaut selection and health history charts; label all fake records `Synthetic demo`.
3. Check-in form (symptoms, health readings with explicit unknowns).
4. Evidence result screen with observations, missing-data list, constraints, safety flags, next-check suggestion and medical-review state.
5. Inventory panel and local incident report view.
6. **Optional:** 3D human body selector mapping heart/brain/bone areas to **existing records**; never imply direct organ scans or measured spatial gene activity.
7. **Optional:** 3–5 offline voice commands: "show my health", "open inventory", "open heart information", "what is missing", "record symptom". Confirm before saving symptom data; always provide clickable fallbacks.

## API dependencies

- `GET /api/v1/astronauts`
- `GET /api/v1/astronauts/{astronaut_id}/health`
- `POST /api/v1/checkins`
- `GET /api/v1/inventory`
- `POST /api/v1/investigations`
- `GET /api/v1/reports/{incident_id}`

Start with fixture JSON matching the documented API; replace with live API at the Hour-12–20 integration checkpoint.

## Acceptance criteria

- End-to-end check-in and investigation works with keyboard and mouse.
- `null`/unknown readings are visibly unknown, not zero or green/normal.
- `status=escalate` renders a highly visible approved-protocol handoff, not treatment advice.
- `next_check=null` renders meaningful "no safe check selected" UI.
- No hardcoded fake medical findings in live production components.
- Offline mode works with a local API and bundled assets.

## Handoff to Member 2

Send: expected API types, base URL configuration, any unresolved contract discrepancies and one screenshot/recording showing the live endpoint. Keep UI copy source-grounded.

## Copy-to-agent task

> You own `frontend/` for MEDNAV. Read AGENTS.md, PROJECT_SPEC.md, API_CONTRACT.md and ARCHITECTURE.md. Build a responsive React/TypeScript health dashboard, check-in, trends, missing-data and inventory views, and investigation evidence result. Never make independent medical recommendations. Use API contract v1 and mark every fictional record synthetic. Add 3D body navigation only after end-to-end API flow works. Voice is optional with confirmation and clickable fallback. Deliver tested code, run instructions and a small PR; do not edit other owners' folders.

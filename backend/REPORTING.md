# MEDNAV synthetic medical reporting

The Incident Report page shows the last seven days of heart rate, sleep duration, blood pressure, readable reported symptoms, and medicines confirmed as taken. The **Generate & download PDF** button creates an immutable A4 PDF from the same current data and starts its download. Investigation **Take** confirmations now record the astronaut, exact deducted amount, and time in the same transaction as the inventory deduction. Older confirmed deductions are recovered on startup; their exact take time is marked unknown. Medication inventory alone is never treated as proof that a dose was taken.

## Local setup

From `backend`, install `requirements.txt`, then set a private officer key before starting FastAPI:

```powershell
$env:MEDNAV_OFFICER_KEY = '<choose-a-private-local-demo-key>'
.\.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

Start the frontend with `npm run dev` from `frontend` and open `http://127.0.0.1:5173/`. The officer key is entered in the Medical Officer Review panel for review, queue, and simulated Earth controls. It is held in page memory only. The reporting API accepts loopback requests only. This is a local synthetic prototype; the key is a demonstration gate, not production identity management.

The PDF archive defaults to `backend/reports/` beside the SQLite database. Set `MEDNAV_REPORT_DIR` to move it. Back up the SQLite database and this directory together. The backend adds reporting tables with `CREATE TABLE IF NOT EXISTS` at startup; existing check-in and inventory tables are unchanged.

## Demonstration

The current synthetic profile is named **Crew A** (the repository has no separate A01 identifier).

1. Select Crew A and open **Incident Report**. The page immediately shows current saved records for the last seven UTC calendar days. If there are no recent check-ins, save a synthetic Health Check-In first.
2. Click **Generate & download PDF**. The browser downloads the PDF. **Download again** retrieves the latest saved copy. Open that PDF in a normal PDF viewer to print it.

The medical-officer review and simulated Earth queue remain available through the reporting API for the existing store-and-forward prototype. They are no longer shown on the simplified Incident Report page.

No real Earth link or NASA receiver is connected. The simulation state is separate from `navigator.onLine`. A production deployment needs real user authentication, transport encryption, and a configured receiver adapter before sending sensitive records.

## Added API routes

All routes are under `/api/v1`. Existing routes remain unchanged.

| Method | Route | Purpose |
| --- | --- | --- |
| GET / POST | `/reports` | List or create reports |
| GET | `/reports/preview?astronaut_id=` | Current seven-day data without creating a PDF |
| GET | `/reports/{id}` | Current report snapshot and status |
| GET / POST | `/reports/{id}/versions` | Version history or new PDF version |
| GET | `/reports/{id}/pdf?version=&download=` | Preview, print or download archived PDF |
| GET | `/reports/{id}/audit` | Version and transmission audit |
| GET / POST | `/reports/{id}/reviews` | Review history or authorized review |
| GET | `/astronauts/{id}/medication-administrations` | Documented administration history |
| POST | `/medication-administrations` | Confirmed officer-entered record |
| GET / POST | `/earth/status` | Simulated link state or authorized toggle |
| GET | `/earth/received` | Simulated ground receipts |
| POST | `/reports/{id}/queue` | Authorized PDF queueing |
| POST | `/reports/{id}/retry` | Authorized retry of a failed transfer |

The new SQLite tables are `medical_reports`, `medical_report_versions`, `medication_administrations`, `medical_officer_reviews`, `earth_link_state`, `report_transmissions`, `simulated_ground_receipts`, and `medical_report_audit`. `MEDNAV_OFFICER_KEY` is required for write operations that document administrations, record medical reviews, or control transmission.

## Reliability notes

The outbound queue and acknowledgements survive restarts. Each report version has a stable idempotency key and immutable checksum. The worker retries due failures with exponential backoff, stopping after five attempts. A missing or corrupt PDF never becomes delivered. The simulated receiver saves a copy and returns an acknowledgement only after validating the checksum. Reports are labeled synthetic throughout.

The current check-in table has no separate onset, severity, respiratory, temperature, hydration, or activity fields. These remain unknown. Investigation evaluation was not previously persisted; report creation captures an actual engine response for the latest check-in when available. A generated PDF records its snapshot at generation time; later status changes appear in the live audit and require a new PDF version to be included in the document.

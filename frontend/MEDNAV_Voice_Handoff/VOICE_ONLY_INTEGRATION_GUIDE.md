# MEDNAV Voice-only Integration Handoff (current Vosk + Piper implementation)

**Important:** This is the *existing* Vosk-browser + Piper implementation. It does **NOT** implement `Systran/faster-whisper-tiny.en`. Faster-Whisper would require a separate Python speech-to-text service and frontend recorder/transcription adapter. Do not represent this ZIP as that new architecture.

## Copy these into the recipient's ORIGINAL frontend project

- `src/voice/` -> `<existing_frontend>/src/voice/` (entire directory: VoiceAssistant.tsx, commands.ts, questions.ts, recognizer.ts, speaker.ts, voice.css, vosk-browser.d.ts)
- `scripts/prepare_vosk.py` -> `<existing_frontend>/scripts/prepare_vosk.py`
- `tests/voice-check.mjs` -> `<existing_frontend>/tests/voice-check.mjs` (optional but recommended)
- `VOICE_COMMANDS.md`, `MEMBER_1_VOICE_HANDOFF.md` -> docs (optional)

## Merge, DON'T overwrite

`reference_only_DO_NOT_OVERWRITE/` contains copies of the original files *for comparison*, not replacements. Existing frontend's `App.tsx`, `InvestigationConsole.tsx`, `api.ts`, `types.ts`, `demo.ts`, `package.json`, and `vite.config.ts` may have newer changes. Merge only the relevant lines.

### App.tsx additions

At top:
```tsx
import VoiceAssistant from './voice/VoiceAssistant'
```

Inside the existing root JSX *once*, alongside the main layout (not inside a conditional page view):
```tsx
<VoiceAssistant crew={crew} onNavigate={go} />
```

`crew` is the currently selected astronaut ID (A01-A04). `go` must navigate to one of `dashboard`, `crew`, `investigation`, `trends`, `inventory`, `reports`, `research`, `settings`. If the original app's names differ, supply an adapter callback. Do not duplicate the app's existing state.

### Investigation result event bridge

`VoiceAssistant` emits `mednav:voice-investigation` with detail `{ request, response, checkin_id, mode }` on a successful confirmed voice check-in. The existing investigation UI must **listen** to this event to show its result; see the implementation in `reference_only_DO_NOT_OVERWRITE/src/InvestigationConsole.tsx` (lines around listener) and adjust to that component's real state. Conversely, after manual investigation, dispatch `mednav:investigation-result` with detail `{ request, response, mode }` for the assistant's 'Read my recommendation' command.

### Dependencies

Merge into `package.json` dependencies:
```json
"vosk-browser": "^0.0.8"
```
`lucide-react`, `react`, and `react-dom` are already required by the source. Do NOT overwrite package.json just to add a dependency. Run `npm install vosk-browser@^0.0.8` from the frontend root.

### Vite Piper proxy (MERGE into vite.config.ts)

```ts
server: {
  proxy: {
    '/piper': {
      target: 'http://127.0.0.1:5000',
      changeOrigin: true,
      rewrite: path => path.replace(/^\/piper/, ''),
    },
  },
},
```
If existing vite.config.ts has other server/proxy settings, merge rather than replace. `speaker.ts` POSTs `{text}` as JSON to `/piper/synthesize`. Piper needs to be running locally on port 5000. For production builds configure an equivalent proxy.

### Speech models (NOT included in ZIP)

- One-time download: `python scripts/prepare_vosk.py` from frontend root. It produces `public/models/vosk-model.tar.gz` (~tens of MB). If the target computer is offline, copy this **generated model file** from the source computer to exactly that path on the target computer.
- Piper needs `en_US-lessac-medium.onnx` and `en_US-lessac-medium.onnx.json`; copy both into target computer's chosen `voices/` directory if offline.
- Also install runtime dependencies: Node/npm, `piper-tts[http]` inside Python environment (ideally Python 3.12 or 3.13 if 3.14 is incompatible). `.venv` and `node_modules` are machine-specific and should not be shared across computers.

### Windows PowerShell quick setup

From target frontend root:
```powershell
npm.cmd install
py -3 scripts\prepare_vosk.py
py -3 -m venv .venv
.\.venv\Scripts\python.exe -m pip install "piper-tts[http]"
.\.venv\Scripts\python.exe -m piper.download_voices --data-dir .\voices en_US-lessac-medium
.\.venv\Scripts\python.exe -m piper.http_server -m en_US-lessac-medium --data-dir .\voices --host 127.0.0.1 --port 5000
```
In a second PowerShell window run `npm.cmd run dev`, then browse `http://localhost:5173`. With models installed, click `VOICE AI` -> `Enable offline microphone`, allow mic permission, say `Hey MEDNAV`. Without models, text command testing still works.

### Run tests

From target frontend root:
```powershell
npm.cmd run build
```
If the team added the voice script to package.json, also run `npm.cmd run test:voice`. Do not claim that a newly merged frontend is verified until it passes its build and browser/audio tests.

### Backend caution

`VoiceAssistant` imports `apiFor` from `../api` and types from `../types`; these must match the existing Contract v1. The current Member 2 backend uses some other endpoint names/payloads. Do not enable `Local API` until the contract adapter is reconciled; use `Synthetic demo` for initial testing. Medical data must be explicitly confirmed; do not invent readings or treat synthetic records as real.

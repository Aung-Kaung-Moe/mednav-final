# Member 1 — Offline Voice Implementation Handoff

- Owns `src/voice/`, `src/App.tsx` voice mount, and small UI integration in `src/InvestigationConsole.tsx`.
- Offline ASR runs in browser using Vosk small English model packaged as `public/models/vosk-model.tar.gz`.
- Offline TTS uses local Piper voice via Vite proxy `/piper/synthesize` (port 5000).
- No ChatGPT API, cloud STT, or CDN at runtime.
- `VoiceAssistant` is mounted once globally, with active astronaut `crew` and navigation callback `onNavigate`.
- All 13 command categories and questionnaire prompts are in `src/voice/commands.ts` / `questions.ts`.
- `mode=demo`: synthetic fixture API adapter only. `mode=api`: requires Member 2 contract reconciliation first.
- `mednav:voice-investigation`: emitted when voice flow saves and obtains investigation response; InvestigationConsole listens.
- `mednav:investigation-result`: emitted from normal form, voice UI listens to read its recommendation.
- No engine logic or disease inference in the frontend.
- Test `npm run test:voice`, `npm run test:static`, `npm run build` after npm install.

## Known limitations

- Recognition and Piper playback require installation and model downloads. Tests here do not include an audio-based browser run.
- Keyword detection is phrase recognition, not a separately trained wake-word classifier. Noise and accents can affect wake accuracy.
- The script-processor microphone pipeline is simple for a hackathon; consider AudioWorklet for production.
- TTS fallback is **text only** when Piper is unavailable, to avoid browser/platform-dependent cloud speech synthesis.
- Research crews C001–C004 remain separate; voice reads only selected synthetic crew A01–A04.
- Full integration requires Member 2 backend compatibility and Member 3 safety approval.

# MEDNAV Voice Agent — Predefined Intents and Medical Dialog

## Commands

The recognizer accepts the following phrases (and close, unambiguous matches). The assistant waits for **Hey MEDNAV** after microphone activation; subsequent commands do not need the wake phrase until the session is closed.

| Intent | Example commands |
|---|---|
| Wake | Hey MEDNAV; Hey Med Nav; Hello MEDNAV |
| Health questionnaire | Start health check; Begin health check; New health check in |
| Health overview | Show my health status; How is my health; Read my vitals |
| Resting heart rate | What is my heart rate?; Tell me my pulse; Read my BPM |
| Sleep | How many hours did I sleep?; Read my sleep data |
| Blood pressure | What is my blood pressure?; Tell me my BP |
| Trends | Show my health history; Open health trends |
| Missing data | What measurements are missing?; Show missing data |
| Equipment | Check medical equipment; What equipment is available? |
| Investigate | Investigate my health; Run investigation |
| Read result | Read my recommendation; What is the next check? |
| Manual pulse timer | Start pulse timer; Measure my heart rate |
| Session | Repeat; Stop listening; Cancel |

`src/voice/commands.ts` contains the full machine-readable phrase list and conservative confidence/ambiguity checks.

## Questionnaire text (predefined)

1. **Symptoms:** “Are you experiencing any symptoms? For example, headache, dizziness, fatigue, or nausea. Say none if you have no symptoms.”
2. **Onset:** “When did these symptoms begin? You may say unknown.”
3. **Heart rate:** “Have you measured your resting heart rate? Tell me the number in beats per minute, or say not measured.”
4. **Sleep:** “How many hours did you sleep in your most recent sleep period? Or say unknown.”
5. **Blood pressure:** “What is your measured blood pressure? For example, 120 over 80, in millimeters of mercury. Or say not measured.”
6. **Confirmation:** MEDNAV reads back every field and asks for **Yes** or **No** before sending the check-in.
7. **Result:** MEDNAV speaks `status`, `requires_medical_officer_review`, `missing_data`, `resource_constraints`, `next_check.label`, and `explanation` directly from the investigation result. An escalation result suppresses the normal next check.

Onset is displayed locally as a conversation note **only**, because API v1 has no onset field. It is not transmitted to the backend. Other unrecognized symptoms require manual form input; the voice interface does not invent symptom codes.

## Missing data

`not measured`, `unknown`, `skip`, `no reading`, `not available` → `null`, never 0.

Blood pressure is **never** estimated from speech, webcam, pulse, or symptoms. A manually counted pulse is only considered a measurement if the user counts for 60 seconds and explicitly confirms.

## Medical safety

- No automatic diagnosis, treatment, medicine dose, or unvalidated risk percentage.
- A recognized emergency expression interrupts the routine questionnaire and instructs the user to follow the mission-approved emergency protocol and seek medical officer review. No emergency flag is autonomously submitted to the backend.
- Uncertain transcription asks for repetition; no silent guesses or saving on ambiguous input.
- **Only** confirmed check-ins are sent to the API.
- Use real medical emergency support rather than relying on this experimental system in an actual emergency.

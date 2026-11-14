import io
import wave
import numpy as np
from fastapi import FastAPI, Request, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from faster_whisper import WhisperModel
import uvicorn

MODEL_ID = "Systran/faster-whisper-tiny.en"

app = FastAPI(title="MEDNAV Local Voice-to-Text Service")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

print(f"[MEDNAV Voice] Loading local model: {MODEL_ID} ...")
whisper_model = WhisperModel(MODEL_ID, device="cpu", compute_type="int8")
print(f"[MEDNAV Voice] Model {MODEL_ID} ready.")


def decode_wav_bytes(raw_bytes: bytes) -> np.ndarray | io.BytesIO:
    """Decode 16-bit PCM 16kHz mono WAV directly into float32 numpy array, or fallback to BytesIO."""
    try:
        with wave.open(io.BytesIO(raw_bytes), "rb") as wf:
            if wf.getnchannels() == 1 and wf.getsampwidth() == 2 and wf.getframerate() == 16000:
                frames = wf.readframes(wf.getnframes())
                pcm16 = np.frombuffer(frames, dtype=np.int16)
                return pcm16.astype(np.float32) / 32768.0
    except Exception:
        pass
    return io.BytesIO(raw_bytes)


@app.get("/api/v1/voice/status")
def voice_status():
    return {
        "status": "ready",
        "model": MODEL_ID,
        "device": "cpu",
        "compute_type": "int8",
        "offline_capable": True,
    }


@app.post("/api/v1/voice/transcribe")
async def transcribe_audio(
    request: Request,
    file: UploadFile | None = File(default=None),
):
    if file is not None:
        raw_bytes = await file.read()
    else:
        raw_bytes = await request.body()

    if not raw_bytes or len(raw_bytes) < 100:
        raise HTTPException(status_code=400, detail="Empty or too short audio payload.")

    try:
        audio_input = decode_wav_bytes(raw_bytes)
        segments, info = whisper_model.transcribe(
            audio_input,
            language="en",
            beam_size=3,
            vad_filter=True,
            initial_prompt=(
                "Astronaut health check-in: headache, dizziness, fatigue, nausea, "
                "muscle discomfort, heart rate bpm, sleep duration hours, "
                "systolic and diastolic blood pressure mmHg, unknown."
            ),
        )
        text = " ".join(seg.text.strip() for seg in segments).strip()
        return {
            "text": text,
            "model": MODEL_ID,
            "duration_s": round(getattr(info, "duration", 0.0), 2),
        }
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Transcription failed with {MODEL_ID}: {exc}",
        ) from exc


if __name__ == "__main__":
    uvicorn.run(app, host="127.0.0.1", port=8000, log_level="info")

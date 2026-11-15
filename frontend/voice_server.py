import io
import os
import re
import wave
import numpy as np
from fastapi import FastAPI, Request, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from faster_whisper import WhisperModel
import uvicorn

MODEL_ID = os.environ.get("MEDNAV_WHISPER_MODEL", "Systran/faster-whisper-tiny.en")

CHECKIN_HOTWORDS = (
    "headache, dizziness, fatigue, nausea, muscle discomfort, "
    "no symptoms, heart rate, blood pressure, sleep, systolic, diastolic, "
    "bpm, hours, mmHg, unknown, Hey MEDNAV, Hello MEDNAV, MEDNAV, health check, "
    "read my recommendation, what is my heart rate, what data is missing"
)


def reliable_live_text(text: str, duration_s: float) -> bool:
    """Discard implausible repetitions from short, live microphone segments."""
    words = re.findall(r"[a-z0-9]+", text.lower())
    if not words:
        return False
    if len(words) > max(12, int(duration_s * 5.5) + 4):
        return False
    if len(words) >= 8 and max(words.count(word) for word in set(words)) / len(words) >= 0.65:
        return False
    return True

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
    """Decode 16-bit PCM WAV, resample to 16kHz mono float32, and normalize quiet mic levels."""
    try:
        with wave.open(io.BytesIO(raw_bytes), "rb") as wf:
            channels = wf.getnchannels()
            sampwidth = wf.getsampwidth()
            framerate = wf.getframerate()
            if sampwidth == 2 and channels >= 1 and framerate > 0:
                frames = wf.readframes(wf.getnframes())
                pcm16 = np.frombuffer(frames, dtype=np.int16)
                if channels > 1:
                    pcm16 = pcm16.reshape(-1, channels).mean(axis=1)
                audio = pcm16.astype(np.float32) / 32768.0
                if framerate != 16000 and len(audio) > 1:
                    target_len = max(1, int(round(len(audio) * 16000 / framerate)))
                    src_x = np.linspace(0.0, 1.0, len(audio), endpoint=False)
                    dst_x = np.linspace(0.0, 1.0, target_len, endpoint=False)
                    audio = np.interp(dst_x, src_x, audio).astype(np.float32)
                peak = float(np.max(np.abs(audio))) if len(audio) else 0.0
                rms = float(np.sqrt(np.mean(audio * audio))) if len(audio) else 0.0
                if peak < 0.018 or rms < 0.004:
                    return np.zeros_like(audio)
                if peak < 0.35:
                    audio = np.clip(audio * min(4.0, 0.35 / peak), -1.0, 1.0).astype(np.float32)
                return audio
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
    segment_mode: bool = False,
):
    if file is not None:
        raw_bytes = await file.read()
    else:
        raw_bytes = await request.body()

    if not raw_bytes or len(raw_bytes) < 100:
        raise HTTPException(status_code=400, detail="Empty or too short audio payload.")

    try:
        audio_input = decode_wav_bytes(raw_bytes)
        if isinstance(audio_input, np.ndarray) and audio_input.size:
            peak = float(np.max(np.abs(audio_input)))
            rms = float(np.sqrt(np.mean(audio_input * audio_input)))
            if peak < 0.015 or rms < 0.003:
                return {"text": "", "model": MODEL_ID, "duration_s": round(audio_input.size / 16000, 2)}
        segments, info = whisper_model.transcribe(
            audio_input,
            language="en",
            beam_size=3 if segment_mode else 5,
            temperature=0.0,
            condition_on_previous_text=False,
            hotwords=CHECKIN_HOTWORDS,
            vad_filter=not segment_mode,
            vad_parameters={
                "threshold": 0.35,
                "min_silence_duration_ms": 500,
                "speech_pad_ms": 350,
            },
            initial_prompt="MEDNAV astronaut health check. Measurements: heart rate, sleep, blood pressure.",
        )
        text = " ".join(seg.text.strip() for seg in segments).strip()
        duration = float(getattr(info, "duration", 0.0))
        if segment_mode and not reliable_live_text(text, duration):
            text = ""
        return {
            "text": text,
            "model": MODEL_ID,
            "duration_s": round(duration, 2),
        }
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Transcription failed with {MODEL_ID}: {exc}",
        ) from exc


if __name__ == "__main__":
    uvicorn.run(app, host="127.0.0.1", port=8000, log_level="info")

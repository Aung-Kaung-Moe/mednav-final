import io
import os
import re
import wave
from collections import Counter
import numpy as np
from fastapi import FastAPI, Request, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from faster_whisper import WhisperModel
import uvicorn

MODEL_ID = os.environ.get("MEDNAV_WHISPER_MODEL", "Systran/faster-whisper-tiny.en")

CHECKIN_HOTWORDS = (
    "headache, dizziness, fatigue, nausea, muscle discomfort, "
    "no symptoms, heart rate, blood pressure, sleep, systolic, diastolic, "
    "bpm, hours, mmHg, unknown, Hey MEDNAV, MEDNAV, start health check, "
    "read my recommendation, what is my heart rate, what data is missing"
)

LIVE_HOTWORDS = "Hey MEDNAV, MEDNAV, health check, stop"

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


def decode_wav_bytes(raw_bytes: bytes, normalize: bool = True) -> np.ndarray | io.BytesIO:
    """Decode 16-bit PCM WAV and resample to 16kHz mono float32."""
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
                if normalize and 0.01 < peak < 0.5:
                    audio = np.clip(audio * (0.7 / peak), -1.0, 1.0).astype(np.float32)
                return audio
    except Exception:
        pass
    return io.BytesIO(raw_bytes)


def reliable_live_text(text: str, duration_s: float) -> bool:
    """Reject short-clip loops and implausibly long transcripts before UI dispatch."""
    words = re.findall(r"[a-z0-9]+", text.lower())
    if not words or len(text) > max(80, int(duration_s * 35)):
        return False
    if len(words) >= 8 and Counter(words).most_common(1)[0][1] / len(words) >= 0.65:
        return False
    return True


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
        # Live microphone noise should not be amplified into apparent speech.
        audio_input = decode_wav_bytes(raw_bytes, normalize=not segment_mode)
        segments, info = whisper_model.transcribe(
            audio_input,
            language="en",
            beam_size=3 if segment_mode else 5,
            temperature=0.0,
            condition_on_previous_text=False,
            max_new_tokens=48 if segment_mode else None,
            hotwords=LIVE_HOTWORDS if segment_mode else CHECKIN_HOTWORDS,
            vad_filter=True,
            vad_parameters={
                "threshold": 0.35,
                "min_speech_duration_ms": 100 if segment_mode else 250,
                "min_silence_duration_ms": 300 if segment_mode else 500,
                "speech_pad_ms": 150 if segment_mode else 350,
            },
            initial_prompt=None if segment_mode else (
                "Astronaut health check-in: no symptoms, headache, dizziness, fatigue, nausea, "
                "muscle discomfort, heart rate 72 bpm, sleep 7.5 hours, "
                "blood pressure 120 over 80 mmHg, systolic, diastolic, unknown."
            ),
        )
        accepted = [
            seg.text.strip() for seg in segments
            if not segment_mode or (
                seg.avg_logprob >= -1.2
                and seg.no_speech_prob < 0.65
                and seg.compression_ratio < 2.0
                and reliable_live_text(seg.text, getattr(info, "duration", 0.0))
            )
        ]
        text = " ".join(accepted).strip()
        if segment_mode and not reliable_live_text(text, getattr(info, "duration", 0.0)):
            text = ""
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
    uvicorn.run(app, host="127.0.0.1", port=int(os.environ.get("MEDNAV_VOICE_PORT", "8002")), log_level="info")

"""Local offline Piper TTS HTTP server for MEDNAV spoken responses."""
import io
import os
import threading
import wave
from functools import lru_cache
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from piper.voice import PiperVoice
from pydantic import BaseModel
from starlette.concurrency import run_in_threadpool
import uvicorn

DEFAULT_MODEL = Path(__file__).resolve().parent / "models" / "piper" / "en_US-lessac-medium.onnx"
MODEL_PATH = Path(os.environ.get("MEDNAV_PIPER_MODEL", str(DEFAULT_MODEL)))
HOST = os.environ.get("MEDNAV_PIPER_HOST", "127.0.0.1")
PORT = int(os.environ.get("MEDNAV_PIPER_PORT", "5000"))

app = FastAPI(title="MEDNAV Local Piper Voice Service")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

_lock = threading.Lock()
_voice: PiperVoice | None = None
COMMON_PROMPTS = (
    "Hello, astronaut Crew A. I am MEDNAV. Would you like to start a health check?",
    "Any symptoms? Say a symptom, or none.",
    "When did the symptoms begin?",
    "What was your measured heart rate?",
    "How many hours did you sleep?",
    "What was your measured blood pressure?",
)


class SynthesizeRequest(BaseModel):
    text: str


def get_voice() -> PiperVoice:
    global _voice
    with _lock:
        if _voice is None:
            if not MODEL_PATH.is_file():
                raise RuntimeError(f"Piper voice model not found at {MODEL_PATH}")
            _voice = PiperVoice.load(str(MODEL_PATH))
        return _voice


@lru_cache(maxsize=64)
def synthesize_wav_bytes(text: str) -> bytes:
    cleaned = text.strip()
    if not cleaned:
        raise HTTPException(status_code=400, detail="Text must not be empty.")
    voice = get_voice()
    buffer = io.BytesIO()
    with _lock:
        with wave.open(buffer, "wb") as wav_file:
            voice.synthesize_wav(cleaned, wav_file)
    return buffer.getvalue()


@app.on_event("startup")
def warm_common_prompts():
    for prompt in COMMON_PROMPTS:
        synthesize_wav_bytes(prompt)


@app.get("/health")
def health():
    return {
        "status": "ready" if MODEL_PATH.is_file() else "unavailable",
        "voice": MODEL_PATH.stem,
        "offline_capable": True,
    }


@app.post("/synthesize")
@app.post("/")
async def synthesize(payload: SynthesizeRequest):
    wav_bytes = await run_in_threadpool(synthesize_wav_bytes, payload.text)
    return Response(content=wav_bytes, media_type="audio/wav")


if __name__ == "__main__":
    get_voice()
    uvicorn.run(app, host=HOST, port=PORT, log_level="info")

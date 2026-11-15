"""Bounded local WAV transcription. Never saves or evaluates medical observations."""
import io
import logging
import os
import threading
import wave
from pathlib import Path
from typing import Literal
from fastapi import APIRouter, HTTPException, Query, Request
from pydantic import BaseModel
from starlette.concurrency import run_in_threadpool

router=APIRouter(prefix='/api/v1/voice',tags=['local voice'])
MAX_BYTES=2_000_000
lock=threading.Lock()
_whisper_lock=threading.Lock()
_whisper_model=None
logger=logging.getLogger(__name__)

MODEL_ID=os.environ.get('MEDNAV_WHISPER_MODEL','Systran/faster-whisper-tiny.en')
WHISPER_LOCAL_DIR=Path(__file__).resolve().parents[1]/'models'/'faster-whisper-tiny.en'
CHECKIN_HOTWORDS=(
    'headache, dizziness, fatigue, nausea, muscle discomfort, '
    'no symptoms, heart rate, blood pressure, sleep, systolic, diastolic, '
    'bpm, hours, mmHg, unknown, Hey MEDNAV, MEDNAV, start health check, '
    'read my recommendation, what is my heart rate, what data is missing'
)


class Transcript(BaseModel):
    text:str


class VoiceStatus(BaseModel):
    available:bool
    engine:Literal['faster-whisper','pocketsphinx']
    language:Literal['en-US']
    sample_rate:Literal[16000]
    max_seconds:Literal[30]
    cloud:Literal[False]


class WhisperStatus(BaseModel):
    status:Literal['ready','unavailable']
    model:str
    available:bool
    engine:Literal['faster-whisper','pocketsphinx']
    device:Literal['cpu']
    compute_type:Literal['int8']
    offline_capable:Literal[True]


class VoiceError(BaseModel):
    detail:str


def _has_faster_whisper_model():
    try:
        import faster_whisper  # noqa: F401
        import numpy  # noqa: F401
    except ImportError:
        return False
    if (WHISPER_LOCAL_DIR/'model.bin').is_file():
        return True
    try:
        from faster_whisper.utils import download_model
        download_model(MODEL_ID,local_files_only=True)
        return True
    except Exception:
        return False


def _has_pocketsphinx_model():
    try:
        from pocketsphinx import get_model_path
        root=Path(get_model_path())/'en-us'
        return (root/'en-us'/'mdef').is_file() and (root/'en-us.lm.bin').is_file() and (root/'cmudict-en-us.dict').is_file()
    except ImportError:
        return False


def _active_engine():
    if _has_faster_whisper_model(): return 'faster-whisper'
    return 'pocketsphinx'


def _get_whisper_model():
    global _whisper_model
    with _whisper_lock:
        if _whisper_model is None:
            from faster_whisper import WhisperModel
            source=str(WHISPER_LOCAL_DIR) if (WHISPER_LOCAL_DIR/'model.bin').is_file() else MODEL_ID
            _whisper_model=WhisperModel(source,device='cpu',compute_type='int8',local_files_only=True)
        return _whisper_model


def model_status():
    return _has_faster_whisper_model() or _has_pocketsphinx_model()


def decode_wav(data:bytes,allow_resample:bool=False):
    try:
        with wave.open(io.BytesIO(data),'rb') as wav:
            rate=wav.getframerate()
            channels=wav.getnchannels()
            width=wav.getsampwidth()
            comptype=wav.getcomptype()
            frames=wav.getnframes()
            if not allow_resample:
                if channels!=1 or width!=2 or comptype!='NONE' or rate!=16000:
                    raise ValueError('Expected 16 kHz mono PCM16 WAV')
                if not 1600<=frames<=16000*30:
                    raise ValueError('Recording must be between 0.1 and 30 seconds')
            else:
                if channels<1 or width!=2 or comptype!='NONE' or rate<=0:
                    raise ValueError('Expected PCM16 WAV')
                if not max(1,int(rate*0.1))<=frames<=rate*30:
                    raise ValueError('Recording must be between 0.1 and 30 seconds')
            audio=wav.readframes(frames)
            if len(audio)!=frames*width*channels: raise ValueError('Truncated WAV recording')
            return audio,rate,channels
    except (wave.Error,EOFError,ValueError) as exc:
        raise HTTPException(422,str(exc) if isinstance(exc,ValueError) else 'Invalid WAV recording') from None


def _pcm16_to_float16k(audio:bytes,rate:int,channels:int):
    import numpy as np
    pcm=np.frombuffer(audio,dtype=np.int16)
    if channels>1:
        pcm=pcm.reshape(-1,channels).mean(axis=1)
    samples=pcm.astype(np.float32)/32768.0
    if rate!=16000 and len(samples)>1:
        target_len=max(1,int(round(len(samples)*16000/rate)))
        samples=np.interp(
            np.linspace(0.0,1.0,target_len,endpoint=False),
            np.linspace(0.0,1.0,len(samples),endpoint=False),
            samples,
        ).astype(np.float32)
    return samples


def transcribe(audio,rate:int=16000,channels:int=1,segment_mode:bool=False):
    if not model_status(): raise HTTPException(503,'Local English voice model unavailable. Install backend/requirements-voice.txt.')
    if not lock.acquire(blocking=False): raise HTTPException(429,'Voice recognition busy. Retry shortly.')
    try:
        if _has_faster_whisper_model():
            import numpy as np
            samples=_pcm16_to_float16k(audio,rate,channels)
            peak=float(np.max(np.abs(samples))) if len(samples) else 0.0
            if peak<1e-4:
                return Transcript(text='')
            if 0.01<peak<0.5:
                samples=np.clip(samples*(0.7/peak),-1.0,1.0).astype(np.float32)
            model=_get_whisper_model()
            segments,_info=model.transcribe(
                samples,
                language='en',
                beam_size=3 if segment_mode else 5,
                temperature=0.0,
                condition_on_previous_text=False,
                hotwords=CHECKIN_HOTWORDS,
                vad_filter=False,
                initial_prompt=(
                    'Astronaut health check-in: no symptoms, headache, dizziness, fatigue, nausea, '
                    'muscle discomfort, heart rate 72 bpm, sleep 7.5 hours, '
                    'blood pressure 120 over 80 mmHg, systolic, diastolic, unknown.'
                ),
            )
            return Transcript(text=' '.join(seg.text.strip() for seg in segments).strip())
        from pocketsphinx import Decoder
        decoder=Decoder(samprate=16000,loglevel='ERROR')
        decoder.start_utt();decoder.process_raw(audio,False,True);decoder.end_utt()
        hypothesis=decoder.hyp()
        return Transcript(text=hypothesis.hypstr if hypothesis else '')
    except HTTPException: raise
    except Exception:
        logger.exception('Local transcription failed')
        raise HTTPException(500,'Local transcription failed. Retry or use manual check-in.') from None
    finally: lock.release()


@router.get('/status',response_model=VoiceStatus)
def status():
    return {'available':model_status(),'engine':_active_engine(),'language':'en-US','sample_rate':16000,'max_seconds':30,'cloud':False}


@router.get('/whisper-status',response_model=WhisperStatus)
def whisper_status():
    available=model_status()
    return {'status':'ready' if available else 'unavailable','model':MODEL_ID,'available':available,'engine':_active_engine(),'device':'cpu','compute_type':'int8','offline_capable':True}


@router.post('/transcribe',response_model=Transcript,
    openapi_extra={'requestBody':{'required':True,'content':{'audio/wav':{'schema':{'type':'string','format':'binary'}}}}},
    responses={code:{'model':VoiceError,'description':description} for code,description in {
        413:'Recording exceeds request limit',415:'Expected audio/wav',422:'Invalid WAV format or duration',
        429:'Local recognition busy',503:'Local model unavailable',500:'Transcription failed'}.items()})
async def endpoint(request:Request,segment_mode:bool=Query(default=False)):
    if request.headers.get('content-type','').split(';')[0].strip().lower()!='audio/wav':
        raise HTTPException(415,'Send Content-Type: audio/wav')
    data=bytearray()
    async for chunk in request.stream():
        data.extend(chunk)
        if len(data)>MAX_BYTES: raise HTTPException(413,'Recording too large')
    audio,rate,channels=decode_wav(bytes(data),allow_resample=segment_mode)
    return await run_in_threadpool(transcribe,audio,rate,channels,segment_mode)

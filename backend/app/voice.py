"""Bounded local WAV transcription. Never saves or evaluates medical observations."""
import io
import logging
import threading
import wave
from pathlib import Path
from typing import Literal
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from starlette.concurrency import run_in_threadpool

router=APIRouter(prefix='/api/v1/voice',tags=['local voice'])
MAX_BYTES=2_000_000
lock=threading.Lock()
logger=logging.getLogger(__name__)


class Transcript(BaseModel):
    text:str


class VoiceStatus(BaseModel):
    available:bool
    engine:Literal['pocketsphinx']
    language:Literal['en-US']
    sample_rate:Literal[16000]
    max_seconds:Literal[30]
    cloud:Literal[False]


class VoiceError(BaseModel):
    detail:str


def model_status():
    try:
        from pocketsphinx import get_model_path
        root=Path(get_model_path())/'en-us'
        return (root/'en-us'/'mdef').is_file() and (root/'en-us.lm.bin').is_file() and (root/'cmudict-en-us.dict').is_file()
    except ImportError:
        return False


def decode_wav(data:bytes):
    try:
        with wave.open(io.BytesIO(data),'rb') as wav:
            rate=wav.getframerate()
            if wav.getnchannels()!=1 or wav.getsampwidth()!=2 or wav.getcomptype()!='NONE' or rate!=16000:
                raise ValueError('Expected 16 kHz mono PCM16 WAV')
            frames=wav.getnframes()
            if not 1600<=frames<=16000*30:
                raise ValueError('Recording must be between 0.1 and 30 seconds')
            audio=wav.readframes(frames)
            if len(audio)!=frames*2: raise ValueError('Truncated WAV recording')
            return audio
    except (wave.Error,EOFError,ValueError) as exc:
        raise HTTPException(422,str(exc) if isinstance(exc,ValueError) else 'Invalid WAV recording') from None


def transcribe(audio):
    if not model_status(): raise HTTPException(503,'Local English voice model unavailable. Install backend/requirements-voice.txt.')
    from pocketsphinx import Decoder
    if not lock.acquire(blocking=False): raise HTTPException(429,'Voice recognition busy. Retry shortly.')
    try:
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
    return {'available':model_status(),'engine':'pocketsphinx','language':'en-US','sample_rate':16000,'max_seconds':30,'cloud':False}


@router.post('/transcribe',response_model=Transcript,
    openapi_extra={'requestBody':{'required':True,'content':{'audio/wav':{'schema':{'type':'string','format':'binary'}}}}},
    responses={code:{'model':VoiceError,'description':description} for code,description in {
        413:'Recording exceeds request limit',415:'Expected audio/wav',422:'Invalid WAV format or duration',
        429:'Local recognition busy',503:'Local model unavailable',500:'Transcription failed'}.items()})
async def endpoint(request:Request):
    if request.headers.get('content-type','').split(';')[0].strip().lower()!='audio/wav':
        raise HTTPException(415,'Send Content-Type: audio/wav')
    data=bytearray()
    async for chunk in request.stream():
        data.extend(chunk)
        if len(data)>MAX_BYTES: raise HTTPException(413,'Recording too large')
    audio=decode_wav(bytes(data))
    return await run_in_threadpool(transcribe,audio)

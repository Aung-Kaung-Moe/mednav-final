import io
import wave
import pytest
from fastapi.testclient import TestClient
from app.main import create_app
from app import voice

def wav(rate=16000,channels=1,frames=1600):
    stream=io.BytesIO()
    with wave.open(stream,'wb') as f:
        f.setnchannels(channels);f.setsampwidth(2);f.setframerate(rate);f.writeframes(b'\0\0'*channels*frames)
    return stream.getvalue()

@pytest.fixture
def client(tmp_path):
    with TestClient(create_app(f'sqlite:///{(tmp_path/"voice.db").as_posix()}')) as c: yield c

@pytest.mark.parametrize('data',[b'',b'invalid',wav(rate=48000),wav(channels=2),wav(frames=10),wav(frames=16000*31),wav()[:-2]],ids=['empty','invalid','wrong-rate','stereo','short','long','truncated'])
def test_invalid_audio(client,data):
    assert client.post('/api/v1/voice/transcribe',content=data,headers={'Content-Type':'audio/wav'}).status_code==422

def test_wrong_type_and_limit(client):
    assert client.post('/api/v1/voice/transcribe',content=wav()).status_code==415
    assert client.post('/api/v1/voice/transcribe',content=b'0'*2_000_001,headers={'Content-Type':'audio/wav'}).status_code==413


def test_voice_openapi_matches_real_binary_contract(client):
    schema=client.get('/openapi.json').json()
    operation=schema['paths']['/api/v1/voice/transcribe']['post']
    assert operation['requestBody']['required'] is True
    assert operation['requestBody']['content']['audio/wav']['schema']=={'type':'string','format':'binary'}
    assert {'413','415','422','429','500','503'}<=operation['responses'].keys()
    status=client.get('/api/v1/voice/status').json()
    assert set(status)=={'available','engine','language','sample_rate','max_seconds','cloud'}
    assert status['sample_rate']==16000 and status['cloud'] is False

def test_missing_model_is_explicit(client,monkeypatch):
    monkeypatch.setattr(voice,'model_status',lambda:False)
    r=client.post('/api/v1/voice/transcribe',content=wav(),headers={'Content-Type':'audio/wav'})
    assert r.status_code==503 and 'model unavailable' in r.json()['detail']

def test_real_local_model_silence_does_not_save(client):
    if not voice.model_status(): pytest.skip('Optional local speech model not installed')
    before=client.get('/api/v1/astronauts/Crew%20A/history').json()
    r=client.post('/api/v1/voice/transcribe',content=wav(frames=16000),headers={'Content-Type':'audio/wav'})
    assert r.status_code==200 and isinstance(r.json()['text'],str)
    assert client.get('/api/v1/astronauts/Crew%20A/history').json()==before


def test_real_speech_offline(client,monkeypatch):
    from pathlib import Path
    import socket
    fixture=Path(__file__).resolve().parents[2]/'.demo-runtime/voice-checkin.wav'
    if not voice.model_status() or not fixture.exists(): pytest.skip('Generate local WAV and install voice model')
    def forbidden(*args,**kwargs): raise AssertionError('External network forbidden during recognition')
    monkeypatch.setattr(socket,'create_connection',forbidden)
    monkeypatch.setattr(socket.socket,'connect',forbidden)
    r=client.post('/api/v1/voice/transcribe',content=fixture.read_bytes(),headers={'Content-Type':'audio/wav'})
    assert r.status_code==200
    assert 'heart rate' in r.json()['text'] and 'headache' in r.json()['text']

import { useState, useRef, useEffect } from 'react';
import { Mic, Square, Check, RotateCcw, AlertCircle } from 'lucide-react';
import { symptomOptions } from '../data/fixtures';
import {API} from '../api';

export type ParsedVoiceCheckIn = {
  symptoms?: string[];
  clearSymptoms?: boolean;
  removeSymptoms?: string[];
  hr?: string | null;
  sleep?: string | null;
  sys?: string | null;
  dia?: string | null;
};

type Props = {
  onApply: (parsed: ParsedVoiceCheckIn) => void;
};


export function parseTranscriptToCheckIn(text: string): ParsedVoiceCheckIn {
  const numbers:Record<string,number>={zero:0,one:1,two:2,three:3,four:4,five:5,six:6,seven:7,eight:8,nine:9,ten:10,eleven:11,twelve:12,thirteen:13,fourteen:14,fifteen:15,sixteen:16,seventeen:17,eighteen:18,nineteen:19,twenty:20,thirty:30,forty:40,fifty:50,sixty:60,seventy:70,eighty:80,ninety:90};
  const words=Object.keys(numbers).concat('hundred','point').join('|');
  const prepared=text.toLowerCase().replace(/\bheart-rate\b/g,'heart rate').replace(/\bb\.p\.\b/g,'bp').replace(/\band a half\b/g,'.5').replace(/\bslash\b/g,'/');
  const lower=prepared.replace(new RegExp(`\\b(?:${words})(?:[ -]+(?:and[ -]+)?(?:${words}))*\\b`,'g'),phrase=>{
    const [whole,decimal,...extra]=phrase.replace(/ and /g,' ').split(' point ');
    const tokens=whole.split(/[ -]+/);
    const small=(parts:string[])=>parts.length===0?0:parts.length===1?numbers[parts[0]]:parts.length===2&&numbers[parts[0]]>=20&&numbers[parts[0]]%10===0&&numbers[parts[1]]>0&&numbers[parts[1]]<10?numbers[parts[0]]+numbers[parts[1]]:undefined;
    const rest=tokens[1]==='hundred'?small(tokens.slice(2)):small(tokens);
    if(rest===undefined||extra.length||(tokens[1]==='hundred'&&!(numbers[tokens[0]]>=1&&numbers[tokens[0]]<=9)))return phrase;
    const digits=decimal?.split(/[ -]+/);
    if(digits?.some(w=>numbers[w]===undefined||numbers[w]>9))return phrase;
    const n=rest+(tokens[1]==='hundred'?numbers[tokens[0]]*100:0);
    return String(n)+(digits?'.'+digits.map(w=>numbers[w]).join(''):'');
  }).replace(/\b(?:minus|negative)\s+(?=\d)/g,'-');
  const result: ParsedVoiceCheckIn = {};

  if (/\b(no symptoms|none reported|feeling fine|no symptom)\b/.test(lower)) {
    result.clearSymptoms = true;
    result.symptoms = [];
  } else {
    const aliases=(sym:string)=>sym==='Muscle discomfort'?['muscle discomfort','muscle ache','muscle pain','soreness']:[sym.toLowerCase()];
    const denied = symptomOptions.filter(sym=>aliases(sym).some(s=>new RegExp(`\\b(?:no|without|denies|not experiencing)\\s+(?:a\\s+)?${s}\\b`).test(lower)));
    if(denied.length)result.removeSymptoms=denied;
    const matched = symptomOptions.filter((sym) => {
      if(denied.includes(sym))return false;
      const s = sym.toLowerCase();
      if (s === 'headache') {
        return /\b(headache|head ache|headaches|migraine)\b/.test(lower);
      }
      if (s === 'dizziness') {
        return /\b(dizziness|dizzy|dizzyness|lightheaded|vertigo)\b/.test(lower);
      }
      if (s === 'fatigue') {
        return /\b(fatigue|fatigued|tired|exhausted|exhaustion)\b/.test(lower);
      }
      if (s === 'nausea') {
        return /\b(nausea|nauseous|queasy)\b/.test(lower);
      }
      if (s === 'muscle discomfort') {
        return (
          lower.includes('muscle discomfort') ||
          lower.includes('muscle ache') ||
          lower.includes('muscle pain') ||
          lower.includes('soreness') ||
          lower.includes('muscle sore')
        );
      }
      return lower.includes(s);
    });
    if (matched.length > 0) {
      result.symptoms = matched;
    }
  }

  if (/\b(heart rate|pulse|hr)\s+(is\s+)?(unknown|missing|not measured|none)\b/.test(lower)) {
    result.hr = '';
  } else {
    const hrMatch =
      lower.match(/\b(?:heart rate|pulse|hr)\s*(?:is|of|at)?\s*(\d+(?:\.\d+)?)\b(?!\.\d)/) ||
      lower.match(/(?<![\w.-])(\d+(?:\.\d+)?)\s*(?:bpm|beats per minute)\b/);
    if (hrMatch) {
      result.hr = hrMatch[1];
    }
  }

  if (/\b(sleep|slept)\s+(is\s+)?(unknown|missing|not measured)\b/.test(lower)) {
    result.sleep = '';
  } else {
    const sleepMatch =
      lower.match(
        /\b(?:sleep|slept|sleep duration)\s*(?:is|of|for|was)?\s*(\d{1,2}(?:\.\d+)?)\s*(?:hours|hrs|hour|h)?\b/
      ) ||
      lower.match(/(?<![\w.-])(\d{1,2}(?:\.\d+)?)\s*(?:hours|hrs)\s*(?:of\s+sleep)?\b/);
    if (sleepMatch) {
      const val = Number(sleepMatch[1]);
      if (val >= 0 && val <= 24) {
        result.sleep = sleepMatch[1];
      }
    }
  }

  if (
    /\b(blood pressure|bp)\s+(is\s+)?(unknown|missing|not measured|unavailable)\b/.test(
      lower
    )
  ) {
    result.sys = '';
    result.dia = '';
  } else {
    const bpPair =
      lower.match(
        /(?<![\w.-])\b(?:blood pressure|bp)?\s*(?:is|of|at)?\s*(\d{2,3})\s*(?:over|\/|by)\s*(\d{2,3})\b/
      ) ||
      lower.match(
        /\bsystolic\s*(?:is|of)?\s*(\d{2,3}).*?\bdiastolic\s*(?:is|of)?\s*(\d{2,3})\b/
      );
    if (bpPair) {
      result.sys = bpPair[1];
      result.dia = bpPair[2];
    }
  }

  return result;
}

function encodeWav16kMono(samples: Float32Array, sampleRate = 16000): Blob {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);

  const writeStr = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  };

  writeStr(0, 'RIFF');
  view.setUint32(4, 36 + samples.length * 2, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeStr(36, 'data');
  view.setUint32(40, samples.length * 2, true);

  let offset = 44;
  for (let i = 0; i < samples.length; i++, offset += 2) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }

  return new Blob([buffer], { type: 'audio/wav' });
}

export function VoiceCheckIn({ onApply }: Props) {
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState('');
  const [applied, setApplied] = useState(false);
  const [seconds, setSeconds] = useState(0);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Float32Array[]>([]);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      stopRecordingCleanup();
    };
  }, []);

  const stopRecordingCleanup = () => {
    if (timerRef.current) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (audioCtxRef.current) {
      audioCtxRef.current.close().catch(() => {});
      audioCtxRef.current = null;
    }
  };

  const startRecording = async () => {
    setError('');
    setApplied(false);
    chunksRef.current = [];
    setSeconds(0);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: 16000,
          echoCancellation: true,
          noiseSuppression: true,
        },
      });
      streamRef.current = stream;

      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      const ctx = new AudioCtx({ sampleRate: 16000 });
      audioCtxRef.current = ctx;

      const source = ctx.createMediaStreamSource(stream);
      const processor = ctx.createScriptProcessor(4096, 1, 1);

      processor.onaudioprocess = (e) => {
        const input = e.inputBuffer.getChannelData(0);
        chunksRef.current.push(new Float32Array(input));
      };

      source.connect(processor);
      const silentGain = ctx.createGain();
      silentGain.gain.value = 0;
      processor.connect(silentGain);
      silentGain.connect(ctx.destination);

      setRecording(true);
      timerRef.current = window.setInterval(() => {
        setSeconds((s) => s + 1);
      }, 1000);
    } catch {
      stopRecordingCleanup();setRecording(false);setError('Microphone unavailable. Please use the form below.');
    }
  };

  const stopAndTranscribe = async () => {
    setRecording(false);
    const actualSampleRate = audioCtxRef.current?.sampleRate ?? 16000;
    stopRecordingCleanup();

    const totalLen = chunksRef.current.reduce((acc, c) => acc + c.length, 0);
    if (totalLen < 1600) {
      setError('Hold or speak for at least 1 second.');
      return;
    }

    const merged = new Float32Array(totalLen);
    let offset = 0;
    for (const chunk of chunksRef.current) {
      merged.set(chunk, offset);
      offset += chunk.length;
    }

    const wavBlob = encodeWav16kMono(merged.subarray(0,actualSampleRate*30), actualSampleRate);
    await sendAudio(wavBlob);
  };

  useEffect(()=>{if(recording && seconds>=30)void stopAndTranscribe();},[recording,seconds]);

  const sendAudio = async (wavBlob: Blob) => {
    setTranscribing(true);
    setError('');
    setTranscript('');setApplied(false);
    try {
      const res = await fetch(`${API}/voice/transcribe`, {
        method: 'POST',
        headers: { 'Content-Type': 'audio/wav' },
        body: wavBlob,
        signal: AbortSignal.timeout(60000),
      });
      if (!res.ok) {
        const detail=await res.json();throw new Error(typeof detail.detail==='string'?detail.detail:`Voice HTTP ${res.status}`);
      }
      const data = (await res.json()) as { text: string };
      if(!data.text.trim()){setTranscript('');setError('No speech recognized. Retry or use manual entry.');}else{setTranscript(data.text);setApplied(false);}
    } catch(e) {
      setError(e instanceof Error?e.message:'Voice service unavailable.');
    } finally {
      setTranscribing(false);
    }
  };

  const parsed = transcript ? parseTranscriptToCheckIn(transcript) : {};
  const hasExtracted =
    (parsed.symptoms && parsed.symptoms.length > 0) ||
    parsed.clearSymptoms ||
    (parsed.removeSymptoms?.length ?? 0)>0 ||
    parsed.hr !== undefined ||
    parsed.sleep !== undefined ||
    parsed.sys !== undefined;

  return (
    <div className="voice-checkin-box" role="region" aria-label="Voice check-in">
      <div className="voice-controls-row">
        <div>
          <strong>Voice Check-In</strong>
          <p className="voice-hint">
            Speak symptoms, heart rate, sleep, or blood pressure.
          </p>
        </div>

        {!recording ? (
          <button
            type="button"
            className="primary"
            onClick={startRecording}
            disabled={transcribing}
          >
            <Mic size={16} />
            {transcribing ? 'Transcribing…' : 'Record Voice'}
          </button>
        ) : (
          <button
            type="button"
            className="voice-stop-btn"
            onClick={stopAndTranscribe}
          >
            <Square size={15} />
            Stop ({seconds}s)
          </button>
        )}
      </div>

      {error && (
        <div className="voice-error" role="alert">
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}

      {transcript && (
        <div className="voice-transcript-review">
          <input
            aria-label="Voice transcript"
            value={transcript}
            onChange={(e) => {
              setTranscript(e.target.value);
              setApplied(false);
            }}
          />

          <div className="extracted-tags">
            {parsed.removeSymptoms?.length ? <span className="ext-tag">Remove: {parsed.removeSymptoms.join(', ')}</span>:null}
            {parsed.clearSymptoms && (
              <span className="ext-tag">Symptoms: None</span>
            )}
            {parsed.symptoms && parsed.symptoms.length > 0 && (
              <span className="ext-tag">
                Symptoms: {parsed.symptoms.join(', ')}
              </span>
            )}
            {parsed.hr !== undefined && (
              <span className={`ext-tag ${parsed.hr === '' ? 'amber' : ''}`}>
                HR: {parsed.hr === '' ? 'Unknown' : `${parsed.hr} bpm`}
              </span>
            )}
            {parsed.sleep !== undefined && (
              <span className={`ext-tag ${parsed.sleep === '' ? 'amber' : ''}`}>
                Sleep: {parsed.sleep === '' ? 'Unknown' : `${parsed.sleep} hrs`}
              </span>
            )}
            {parsed.sys !== undefined && (
              <span className={`ext-tag ${parsed.sys === '' ? 'amber' : ''}`}>
                BP: {parsed.sys === '' ? 'Unknown' : `${parsed.sys}/${parsed.dia}`}
              </span>
            )}
          </div>

          <div className="voice-confirm-actions">
            <button
              type="button"
              className="primary"
              disabled={!hasExtracted}
              onClick={() => {
                onApply(parsed);
                setApplied(true);
              }}
            >
              <Check size={16} />
              {applied ? 'Applied' : 'Apply to Form'}
            </button>
            <button
              type="button"
              className="secondary"
              onClick={() => {
                setTranscript('');
                setApplied(false);
                setError('');
              }}
            >
              <RotateCcw size={14} /> Clear
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

type OnResult = (text: string) => void;

function wav(samples: Float32Array, rate: number): Blob {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);
  const ascii = (offset: number, value: string) => {
    for (let i = 0; i < value.length; i++) view.setUint8(offset + i, value.charCodeAt(i));
  };
  ascii(0, 'RIFF'); view.setUint32(4, 36 + samples.length * 2, true);
  ascii(8, 'WAVE'); ascii(12, 'fmt ');
  view.setUint32(16, 16, true); view.setUint16(20, 1, true);
  view.setUint16(22, 1, true); view.setUint32(24, rate, true);
  view.setUint32(28, rate * 2, true); view.setUint16(32, 2, true);
  view.setUint16(34, 16, true); ascii(36, 'data');
  view.setUint32(40, samples.length * 2, true);
  for (let i = 0; i < samples.length; i++) {
    const sample = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(44 + i * 2, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
  }
  return new Blob([buffer], { type: 'audio/wav' });
}

/** Reuses the local Faster-Whisper service; no browser model or cloud speech. */
export class OfflineRecognizer {
  private context: AudioContext | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private processor: ScriptProcessorNode | null = null;
  private sink: GainNode | null = null;
  private stream: MediaStream | null = null;
  private chunks: Float32Array[] = [];
  private tail = new Float32Array(0);
  private interval: number | null = null;
  private controller: AbortController | null = null;
  private busy = false;
  private active = false;
  private generation = 0;
  public paused = false;

  constructor(private onText: OnResult, private onError: (message: string) => void = () => {}) {}

  async start() {
    if (this.active) return;
    let status = await fetch('/api/v1/voice/whisper-status');
    if (status.status === 404) {
      status = await fetch('/api/v1/voice/status');
    }
    if (!status.ok) throw new Error('Local Faster-Whisper service unavailable. Run the MEDNAV backend with Faster-Whisper installed.');
    const info = await status.json() as { model?: string; available?: boolean };
    if (info.available === false || info.model !== 'Systran/faster-whisper-tiny.en') {
      throw new Error(`Voice server is using ${info.model ?? 'an unavailable model'}. Restart it with Systran/faster-whisper-tiny.en.`);
    }
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, channelCount: 1 }, video: false });
      this.context = new AudioContext({ sampleRate: 16000 });
      if (this.context.state === 'suspended') await this.context.resume();
      this.source = this.context.createMediaStreamSource(this.stream);
      this.processor = this.context.createScriptProcessor(4096, 1, 1);
      this.sink = this.context.createGain();
      this.sink.gain.value = 0;
      this.processor.onaudioprocess = event => {
        if (!this.active || this.paused) return;
        this.chunks.push(new Float32Array(event.inputBuffer.getChannelData(0)));
      };
      this.source.connect(this.processor);
      this.processor.connect(this.sink);
      this.sink.connect(this.context.destination);
      this.active = true;
      this.paused = false;
      this.interval = window.setInterval(() => { void this.transcribeChunk(); }, 2400);
    } catch (error) { await this.stop(); throw error; }
  }

  private async transcribeChunk() {
    if (!this.active || this.busy) return;
    if (this.paused) { this.chunks = []; this.tail = new Float32Array(0); return; }
    const chunks = this.chunks.splice(0);
    const length = this.tail.length + chunks.reduce((sum, chunk) => sum + chunk.length, 0);
    if (length < (this.context?.sampleRate ?? 16000) / 2) return;
    const samples = new Float32Array(length);
    samples.set(this.tail);
    let offset = this.tail.length;
    for (const chunk of chunks) { samples.set(chunk, offset); offset += chunk.length; }
    this.tail = samples.slice(-Math.min(samples.length, Math.round((this.context?.sampleRate ?? 16000) * 0.4)));
    const generation = this.generation;
    const controller = new AbortController();
    this.controller = controller;
    this.busy = true;
    try {
      const result = await fetch('/api/v1/voice/transcribe?segment_mode=true', {
        method: 'POST', headers: { 'Content-Type': 'audio/wav' },
        body: wav(samples, this.context?.sampleRate ?? 16000), signal: controller.signal,
      });
      if (!result.ok) throw new Error(`Voice transcription failed (${result.status})`);
      const data = await result.json() as { text?: string };
      if (this.active && !this.paused && generation === this.generation && data.text?.trim()) this.onText(data.text.trim());
    } catch (error) {
      if (this.active && !controller.signal.aborted) this.onError(`Voice service error: ${error instanceof Error ? error.message : 'unavailable'}`);
    } finally { this.busy = false; if (this.controller === controller) this.controller = null; }
  }

  async stop() {
    this.active = false; this.paused = true; this.generation++;
    if (this.interval !== null) window.clearInterval(this.interval);
    this.interval = null;
    this.controller?.abort(); this.controller = null;
    this.chunks = []; this.tail = new Float32Array(0);
    this.processor?.disconnect(); this.source?.disconnect(); this.sink?.disconnect();
    if (this.processor) this.processor.onaudioprocess = null;
    this.stream?.getTracks().forEach(track => track.stop());
    await this.context?.close().catch(() => {});
    this.context = null; this.source = null; this.processor = null; this.sink = null; this.stream = null;
  }
}

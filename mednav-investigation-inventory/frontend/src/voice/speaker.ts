/** Local Piper output. Prime Web Audio from a user click so delayed synthesis can play. */
export class LocalSpeaker {
  private context: AudioContext | null = null;
  private source: AudioBufferSourceNode | null = null;
  private audio: HTMLAudioElement | null = null;
  private url: string | null = null;
  private controller: AbortController | null = null;
  private complete: (() => void) | null = null;

  async prime() {
    try { this.context ??= new AudioContext(); await this.context.resume(); }
    catch { /* The text response remains available. */ }
  }
  stop() {
    this.controller?.abort(); this.controller = null;
    try { this.source?.stop(); } catch { /* Already ended. */ }
    this.source = null;
    this.audio?.pause(); this.audio = null;
    this.complete?.(); this.complete = null;
    if (this.url) URL.revokeObjectURL(this.url);
    this.url = null;
  }
  async say(text: string): Promise<boolean> {
    this.stop();
    const controller = new AbortController(); this.controller = controller;
    const timeout = window.setTimeout(() => controller.abort(), 60000);
    try {
      const response = await fetch('/piper/synthesize', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }), signal: controller.signal,
      });
      if (!response.ok) return false;
      const bytes = await response.arrayBuffer();
      if (controller.signal.aborted || new TextDecoder('ascii').decode(bytes.slice(0, 4)) !== 'RIFF') return false;
      // Piper currently labels its WAV bytes text/html.
      const blob = new Blob([bytes], { type: 'audio/wav' });
      if (this.context?.state === 'running') {
        try {
          const buffer = await this.context.decodeAudioData(bytes.slice(0));
          if (controller.signal.aborted) return false;
          const source = this.context.createBufferSource();
          const comp = this.context.createDynamicsCompressor();
          const gain = this.context.createGain();
          gain.gain.value = 1.4;
          source.buffer = buffer;
          source.connect(comp);
          comp.connect(gain);
          gain.connect(this.context.destination);
          this.source = source;
          return await new Promise<boolean>(resolve => {
            this.complete = () => resolve(false);
            source.onended = () => resolve(true);
            source.start();
          });
        } catch { /* HTML audio can still decode the WAV file. */ }
      }
      this.url = URL.createObjectURL(blob);
      const audio = new Audio(this.url);
      audio.volume = 1.0;
      this.audio = audio;
      return await new Promise<boolean>(resolve => {
        this.complete = () => resolve(false);
        audio.onended = () => resolve(true);
        audio.onerror = () => resolve(false);
        void audio.play().catch(() => resolve(false));
      });
    } catch { return false; }
    finally { window.clearTimeout(timeout); if (this.controller === controller) this.stop(); }
  }
}

import { createModel } from 'vosk-browser'

export type RecognitionStatus = 'off'|'loading'|'listening'|'error'
type OnResult=(text:string)=>void

/** Vosk WASM runs in the browser. No network calls except GET of the locally hosted model. */
export class OfflineRecognizer {
  private model:Awaited<ReturnType<typeof createModel>>|null=null
  private recognizer:InstanceType<Awaited<ReturnType<typeof createModel>>['KaldiRecognizer']>|null=null
  private context:AudioContext|null=null
  private source:MediaStreamAudioSourceNode|null=null
  private processor:ScriptProcessorNode|null=null
  private sink:GainNode|null=null
  private stream:MediaStream|null=null
  public paused=false
  constructor(private onText:OnResult){}
  async start() {
    if(this.stream) return
    try {
      const response=await fetch('/models/vosk-model.tar.gz',{method:'HEAD'})
      if(!response.ok || (response.headers.get('content-type')||'').includes('text/html')) throw new Error('Missing offline Vosk model. Run: python scripts/prepare_vosk.py')
      this.model=await createModel('/models/vosk-model.tar.gz')
      this.recognizer=new this.model.KaldiRecognizer()
      this.recognizer.on('result',message=>{
        if(!this.paused&&message.result.text?.trim()) this.onText(message.result.text.trim())
      })
      this.stream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true,channelCount:1},video:false})
      this.context=new AudioContext({sampleRate:16000})
      if(this.context.state==='suspended') await this.context.resume()
      this.source=this.context.createMediaStreamSource(this.stream)
      this.processor=this.context.createScriptProcessor(4096,1,1)
      this.sink=this.context.createGain()
      this.sink.gain.value=0
      this.processor.onaudioprocess=event=>{
        if(!this.paused&&this.recognizer)this.recognizer.acceptWaveform(event.inputBuffer)
      }
      this.source.connect(this.processor)
      this.processor.connect(this.sink)
      this.sink.connect(this.context.destination)
    }catch(err){await this.stop();throw err}
  }
  async stop() {
    this.paused=true
    this.processor?.disconnect();this.source?.disconnect();this.sink?.disconnect()
    if(this.processor)this.processor.onaudioprocess=null
    this.stream?.getTracks().forEach(t=>t.stop())
    await this.context?.close().catch(()=>{})
    this.recognizer?.remove();this.model?.terminate()
    this.context=null;this.source=null;this.processor=null;this.stream=null;this.sink=null;this.recognizer=null;this.model=null
  }
}

/** Local minimal typing for the vosk-browser 0.0.8 runtime API. */
declare module 'vosk-browser' {
  export type VoskResultMessage={result:{text:string}}
  export interface VoskRecognizer {
    on(event:'result',cb:(message:VoskResultMessage)=>void):void
    acceptWaveform(buffer:AudioBuffer):void
    remove():void
  }
  export interface VoskModel {
    KaldiRecognizer:new()=>VoskRecognizer
    terminate():void
  }
  export function createModel(url:string):Promise<VoskModel>
}

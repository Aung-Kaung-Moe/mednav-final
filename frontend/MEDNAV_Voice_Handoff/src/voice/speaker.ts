/** Piper runs locally on 127.0.0.1:5000; Vite proxies /piper to avoid CORS. */
export class LocalSpeaker {
 private audio:HTMLAudioElement|null=null
 private url:string|null=null
 private complete:(()=>void)|null=null
 stop(){
  this.audio?.pause();this.audio=null
  if(this.complete){const done=this.complete;this.complete=null;done()}
  if(this.url){URL.revokeObjectURL(this.url);this.url=null}
 }
 async say(text:string):Promise<boolean> {
  this.stop()
  try {
   const result=await fetch('/piper/synthesize',{
    method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text})
   })
   if(!result.ok)throw new Error(`Piper status ${result.status}`)
   const blob=await result.blob()
   this.url=URL.createObjectURL(blob)
   const sound=new Audio(this.url)
   this.audio=sound
   const played=await new Promise<boolean>(resolve=>{
    let done=false
    const finish=(ok:boolean)=>{if(done)return;done=true;this.complete=null;resolve(ok)}
    this.complete=()=>finish(false)
    sound.onended=()=>finish(true)
    sound.onerror=()=>finish(false)
    sound.play().catch(()=>finish(false))
   })
   return played
  } catch {return false}
  finally{this.stop()}
 }
}

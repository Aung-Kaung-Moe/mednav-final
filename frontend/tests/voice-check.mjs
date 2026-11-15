/** Test actual matching and parsing TS modules without requiring npm network access. */
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { createRequire } from 'node:module'
const require=createRequire(import.meta.url)
let ts
try{ts=require('typescript')}
catch{const {execSync}=require('node:child_process');ts=require(execSync('npm root -g',{encoding:'utf8'}).trim()+'/typescript')}
const root=new URL('../',import.meta.url)
function load(file){
 const content=fs.readFileSync(new URL(file,root),'utf8')
 const res=ts.transpileModule(content,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022},reportDiagnostics:true,fileName:file})
 if(res.diagnostics?.length)throw new Error(res.diagnostics.map(x=>ts.flattenDiagnosticMessageText(x.messageText,' ')).join('\n'))
 const exports={};new Function('exports','require',res.outputText)(exports,()=>{throw new Error('Unexpected non-type import')})
 return exports
}
const commands=load('src/voice/commands.ts')
const questions=load('src/voice/questions.ts')
const cases=[
 ['Hey MEDNAV','wake'],['hey med nav','wake'],['what is my heart rate','heart_rate'],
 ['tell me my pulse','heart_rate'],['MEDNAV, read my BPM','heart_rate'],
 ['how many hours did i sleep','sleep'],['show my health history','history'],
 ['what measurements are missing','missing'],['what equipment is available','inventory'],
 ['read my recommendation','recommendation'],['start pulse timer','pulse_timer'],
 ['health check','start_check'],['here check','start_check'],['hear check','start_check'],['start health check','start_check'],['stop listening','control'],
]
for(const [text,expect] of cases){const output=commands.matchCommand(text);assert.equal(output,expect,`Command: ${text}`)}
assert.deepEqual(commands.parseWake('Hey MEDNAV what is my pulse?'),{woke:true,remainder:'what is my pulse?'})
assert.deepEqual(commands.parseWake('Hello, MEDNAV, can you help?'),{woke:true,remainder:'can you help?'})
assert.deepEqual(commands.parseWake('Hey there MEDNAV, start health check'),{woke:true,remainder:'start health check'})
assert.deepEqual(commands.parseWake('Hi Met Nav!'),{woke:true,remainder:''})
assert.deepEqual(commands.parseWake('The medical navigator is ready'),{woke:false,remainder:''})
assert.equal(commands.matchCommand('medicine dose for headache'),null)
assert.equal(commands.matchCommand('tell me how to prescribe pills'),null)
assert.deepEqual(questions.parseSymptoms('I have headache and feel tired'),['headache','fatigue'])
assert.deepEqual(questions.parseSymptoms('none'),[])
assert.deepEqual(questions.parseSymptoms('no'),[])
assert.equal(questions.spokenNumber('seventy two'),72)
assert.equal(questions.spokenNumber('one hundred twenty'),120)
assert.equal(questions.spokenNumber('seven point five'),7.5)
assert.equal(questions.spokenNumber('one twenty'),120)
assert.equal(questions.spokenNumber('82 bpm.'),82)
assert.equal(questions.spokenNumber('eighty two beats per minute.'),82)
assert.equal(questions.spokenNumber('82 bpm 90'),null)
assert.deepEqual(questions.parseBP('120 over 80'),[120,80])
assert.deepEqual(questions.parseBP('one hundred twenty over eighty'),[120,80])
assert.equal(questions.parseBP('there is no device'),null)
assert.equal(questions.isUnknown('not measured'),true)
assert.equal(questions.isUnknown('unknown'),true)
const draft=structuredClone(questions.INITIAL_DRAFT)
assert.equal(draft.measurements.systolic_bp_mm_hg,null)
assert.match(questions.draftSummary(draft),/unknown/i)
console.log(`PASS: ${cases.length} command routes + ${22} parse/safety assertions`)
// Static TS/TSX syntax validation, including entire existing frontend.
const files=[]
function scan(p){for(const f of fs.readdirSync(new URL(p,root),{withFileTypes:true})){if(f.isDirectory())scan(p+f.name+'/');else if(/\.tsx?$/.test(f.name) && !f.name.endsWith(".d.ts"))files.push(p+f.name)}}
scan('src/')
for(const file of files){
 const src=fs.readFileSync(new URL(file,root),'utf8')
 const out=ts.transpileModule(src,{fileName:file,reportDiagnostics:true,compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}})
 const errors=(out.diagnostics||[]).filter(d=>d.category===ts.DiagnosticCategory.Error)
 assert.equal(errors.length,0,`${file}: ${errors.map(d=>ts.flattenDiagnosticMessageText(d.messageText,' ')).join(' ')}`)
}
console.log(`PASS: ${files.length} source TS/TSX files transpile without syntax errors`)

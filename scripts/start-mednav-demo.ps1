param([string]$PythonPath, [switch]$Stop)
$ErrorActionPreference = 'Stop'
$project = Split-Path $PSScriptRoot -Parent
$runtime = Join-Path $project '.demo-runtime'
New-Item -ItemType Directory -Force $runtime | Out-Null
$stateFile = Join-Path $runtime 'processes.json'
function Expand-ProcessEntries($items) {
  foreach ($item in $items) {
    if ($item -is [array]) { Expand-ProcessEntries $item }
    elseif ($item -and $item.pid -and $item.started) { $item }
  }
}
if ($Stop) {
  if (Test-Path $stateFile) {
    foreach ($entry in @(Expand-ProcessEntries (Get-Content $stateFile -Raw | ConvertFrom-Json))) {
      if (!$entry.pid -or !$entry.started) { continue }
      $proc = Get-Process -Id $entry.pid -ErrorAction SilentlyContinue
      if ($proc -and $proc.StartTime.ToUniversalTime().Ticks.ToString() -eq $entry.started) {
        # Windows venv Python can spawn a child interpreter. Stop the owned tree.
        & taskkill.exe /PID $entry.pid /T /F | Out-Null
      }
    }
    Set-Content $stateFile '[]'
  }
  Write-Host 'Stopped only processes launched by this script. Reused servers remain running.'
  exit 0
}
if (!$PythonPath) { $PythonPath = Join-Path $project 'backend/.venv/Scripts/python.exe' }
if (!(Test-Path $PythonPath)) { throw 'Backend venv missing. Create backend/.venv and install requirements.txt plus requirements-voice.txt, or pass -PythonPath to an existing environment.' }
$PythonPath = (Resolve-Path $PythonPath).Path
& $PythonPath -c 'import fastapi,sqlalchemy,pydantic,uvicorn'
if ($LASTEXITCODE -ne 0) { throw 'Install backend/requirements.txt into the selected Python environment.' }
if (!(Test-Path (Join-Path $project 'frontend/node_modules/.bin/vite.cmd'))) { throw 'Frontend dependencies missing. Run npm.cmd ci from frontend/.' }
$priorLocation = Get-Location
try {
 Set-Location (Join-Path $project 'backend')
 Write-Host 'Local voice model ready:'
 & $PythonPath -c 'from app.voice import model_status; print(model_status())'
 if ($LASTEXITCODE -ne 0) { throw 'Voice availability check failed.' }
} finally { Set-Location $priorLocation }
$entries = @()
if (Test-Path $stateFile) { $entries = @(Expand-ProcessEntries (Get-Content $stateFile -Raw | ConvertFrom-Json)) }
function Test-OwnedService([int]$servicePid) {
 for($depth=0;$depth -lt 5;$depth++) {
   $owner=Get-CimInstance Win32_Process -Filter "ProcessId = $servicePid" -ErrorAction SilentlyContinue
   if(!$owner){return $false}
   foreach($entry in $script:entries) {
     if($entry.pid -eq $servicePid) {
       $proc=Get-Process -Id $servicePid -ErrorAction SilentlyContinue
       if($proc -and $proc.StartTime.ToUniversalTime().Ticks.ToString() -eq $entry.started){return $true}
     }
   }
   if(([string]$owner.CommandLine).Replace('/','\').IndexOf($project,[StringComparison]::OrdinalIgnoreCase) -ge 0){return $true}
   $servicePid=$owner.ParentProcessId
 }
 return $false
}
function Start-CheckedService($port,$url,$name,$file,$arguments,$directory) {
 $listener=Get-NetTCPConnection -State Listen -LocalPort $port -ErrorAction SilentlyContinue | Select-Object -First 1
 if ($listener) {
   if(!(Test-OwnedService $listener.OwningProcess)){throw "Port $port belongs to another or unverifiable checkout. Stop that server first; no unrelated process was stopped."}
   try { $response=Invoke-WebRequest -UseBasicParsing -Uri $url -TimeoutSec 3 } catch { throw "Port $port is occupied by an unready or unrelated service. Inspect the port owner; no process was stopped." }
   if ($name -eq 'backend' -and ($response.Content | ConvertFrom-Json).database -ne 'sqlite') { throw 'Port 8000 does not look like MEDNAV.' }
   if ($name -eq 'frontend' -and $response.Content -notmatch 'MEDNAV') { throw 'Port 5173 does not look like MEDNAV.' }
   Write-Host "Reusing ready $name on port $port (verify its checkout if another MEDNAV instance is running)."
   return
 }
 $proc=Start-Process -FilePath $file -ArgumentList $arguments -WorkingDirectory $directory -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $runtime "$name.stdout.log") -RedirectStandardError (Join-Path $runtime "$name.stderr.log")
 $script:entries += @{pid=$proc.Id;started=$proc.StartTime.ToUniversalTime().Ticks.ToString();name=$name}
 ConvertTo-Json -Depth 4 -InputObject @($script:entries) | Set-Content $stateFile
 for($i=0;$i -lt 40;$i++) {
   if($proc.HasExited){throw "$name exited. Inspect .demo-runtime/$name.stderr.log"}
   try { if((Invoke-WebRequest -UseBasicParsing -Uri $url -TimeoutSec 2).StatusCode -eq 200){ Write-Host "$name ready";return } } catch {}
   Start-Sleep -Milliseconds 500
 }
 throw "$name did not become ready. Inspect .demo-runtime logs; use this script -Stop to stop owned processes."
}
Start-CheckedService 8000 'http://127.0.0.1:8000/api/v1/healthz' 'backend' $PythonPath @('-m','uvicorn','app.main:app','--host','127.0.0.1','--port','8000') (Join-Path $project 'backend')
$piperModel = Join-Path $project 'backend/models/piper/en_US-lessac-medium.onnx'
if (Test-Path $piperModel) {
  Start-CheckedService 5000 'http://127.0.0.1:5000/health' 'piper' $PythonPath @('piper_server.py') (Join-Path $project 'backend')
} else {
  Write-Warning 'Piper voice model missing; spoken TTS output disabled.'
}
$node=(Get-Command node.exe).Source
$vite=Join-Path $project 'frontend/node_modules/vite/bin/vite.js'
Start-CheckedService 5173 'http://127.0.0.1:5173/' 'frontend' $node @("`"$vite`"",'--host','127.0.0.1','--port','5173') (Join-Path $project 'frontend')
try { $voice=Invoke-RestMethod 'http://127.0.0.1:8000/api/v1/voice/status'; if (!$voice.available) { Write-Warning 'Voice model unavailable; manual workflow remains available. Install requirements-voice.txt and restart backend.' } } catch { Write-Warning 'Running backend does not expose voice/status. Restart the intended backend checkout.' }
Write-Host 'MEDNAV: http://127.0.0.1:5173/ - open this URL in your browser.'
Write-Host 'Shutdown: scripts/start-mednav-demo.ps1 -Stop. Reused servers must be stopped by their original owner.'

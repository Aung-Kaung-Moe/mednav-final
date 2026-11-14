# Offline Windows TTS creates synthetic test speech, not a transcription stub.
$ErrorActionPreference='Stop'
Add-Type -AssemblyName System.Speech
$target=Join-Path (Split-Path $PSScriptRoot -Parent) '.demo-runtime'
New-Item -ItemType Directory -Force $target | Out-Null
$speaker=New-Object System.Speech.Synthesis.SpeechSynthesizer
try {
 $format=New-Object System.Speech.AudioFormat.SpeechAudioFormatInfo(16000,[System.Speech.AudioFormat.AudioBitsPerSample]::Sixteen,[System.Speech.AudioFormat.AudioChannel]::Mono)
 $speaker.SetOutputToWaveFile((Join-Path $target 'voice-checkin.wav'),$format)
 $speaker.Speak('Heart rate eighty eight. Sleep four hours. I have a headache.')
} finally { $speaker.Dispose() }
Write-Host "Created $target/voice-checkin.wav (synthetic English speech)."

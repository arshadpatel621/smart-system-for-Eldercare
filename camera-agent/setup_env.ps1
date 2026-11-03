# setup_env.ps1 - Sets up the camera-agent Python virtual environment
# VitalCare AI / ElderCare Camera & Person Detection Module

[CmdletBinding()]
param(
    [string]$VenvPath = "",
    [switch]$ForceReinstall
)

$ErrorActionPreference = "Stop"

$scriptDir = if ($PSScriptRoot) { $PSScriptRoot } else { Split-Path -Parent $MyInvocation.MyCommand.Path }
if (-not $scriptDir) { $scriptDir = (Get-Location).Path }
if (-not $VenvPath) { $VenvPath = Join-Path $scriptDir ".venv" }

Write-Host "=== Setting up VitalCare Camera Agent Virtual Environment ===" -ForegroundColor Cyan
Write-Host "Base Directory: $scriptDir" -ForegroundColor Gray
Write-Host "Target Venv:    $VenvPath" -ForegroundColor Gray

# 1. Select compatible Python (Prefer 3.11, then 3.12, then 3.13)
$pythonExec = $null

foreach ($ver in @("-3.11", "-3.12", "-3.13")) {
    try {
        $testOut = & py $ver -c "import sys; print(sys.version.split()[0])" 2>$null
        if ($LASTEXITCODE -eq 0 -and $testOut) {
            $pythonExec = "py $ver"
            Write-Host "Found compatible Python via Launcher ($ver): $testOut" -ForegroundColor Green
            break
        }
    } catch {}
}

if (-not $pythonExec) {
    try {
        $testOut = & python -c "import sys; print(sys.version.split()[0])" 2>$null
        if ($LASTEXITCODE -eq 0 -and $testOut) {
            $pythonExec = "python"
            Write-Host "Using default python executable: $testOut" -ForegroundColor Yellow
        }
    } catch {}
}

if (-not $pythonExec) {
    Write-Error "No compatible Python runtime (3.11, 3.12, or 3.13) was found. Please install Python 3.11 or 3.13."
    exit 1
}

# 2. Create virtual environment if missing or if forced
$venvPython = Join-Path $VenvPath "Scripts\python.exe"

if ($ForceReinstall -and (Test-Path $VenvPath)) {
    Write-Host "Removing existing virtual environment at $VenvPath..." -ForegroundColor Yellow
    Remove-Item -Recurse -Force $VenvPath
}

if (-not (Test-Path $venvPython)) {
    Write-Host "Creating virtual environment at $VenvPath..." -ForegroundColor Cyan
    if ($pythonExec.StartsWith("py ")) {
        $pyArg = $pythonExec.Substring(3)
        & py $pyArg -m venv $VenvPath
    } else {
        & $pythonExec -m venv $VenvPath
    }
}

if (-not (Test-Path $venvPython)) {
    Write-Error "Failed to create virtual environment: $venvPython not found."
    exit 1
}

Write-Host "Virtual environment ready at: $venvPython" -ForegroundColor Green

# 3. Upgrade pip and install requirements
$reqFile = Join-Path $scriptDir "requirements.txt"
if (Test-Path $reqFile) {
    Write-Host "Installing dependencies from $reqFile..." -ForegroundColor Cyan
    & $venvPython -m pip install --upgrade pip --quiet
    & $venvPython -m pip install -r $reqFile
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Failed to install dependencies from requirements.txt"
        exit 1
    }
    Write-Host "Dependencies successfully installed." -ForegroundColor Green
}

# 4. Prepare models directory
$modelsDir = Join-Path $scriptDir "models"
if (-not (Test-Path $modelsDir)) {
    New-Item -ItemType Directory -Path $modelsDir -Force | Out-Null
}

# 5. Verify YOLO model download and loading
Write-Host "Verifying YOLO model and person detection..." -ForegroundColor Cyan
$verifyScript = @"
import os
import sys
import numpy as np
from ultralytics import YOLO

models_dir = os.path.join(r'$scriptDir', 'models')
os.makedirs(models_dir, exist_ok=True)
model_path = os.path.join(models_dir, 'yolo11n.pt')

print('Loading YOLO11n model...')
try:
    if os.path.exists(model_path):
        model = YOLO(model_path)
    else:
        model = YOLO('yolo11n.pt')
        if hasattr(model, 'ckpt_path') and os.path.exists(model.ckpt_path):
            import shutil
            if os.path.abspath(model.ckpt_path) != os.path.abspath(model_path):
                shutil.copyfile(model.ckpt_path, model_path)
except Exception as e:
    print(f'Retrying with yolov8n.pt: {e}')
    model = YOLO('yolov8n.pt')
    model_path = os.path.join(models_dir, 'yolov8n.pt')

print(f'Model loaded successfully from: {model_path}')

# Test inference on a synthetic test image (320x320 RGB)
dummy_img = np.zeros((320, 320, 3), dtype=np.uint8)
results = model(dummy_img, classes=[0], verbose=False)
print('Inference verified: classes filter [0] (person) configured.')
print('YOLO environment is fully operational!')

pose_model_path = os.path.join(models_dir, 'yolo11n-pose.pt')
print('Loading YOLO11n pose model for posture-based fall detection...')
pose_model = YOLO(pose_model_path if os.path.exists(pose_model_path) else 'yolo11n-pose.pt')
if getattr(pose_model, 'task', None) != 'pose':
    raise RuntimeError('The selected YOLO model does not provide pose keypoints.')
if not os.path.exists(pose_model_path):
    import shutil
    cached_path = getattr(pose_model, 'ckpt_path', '')
    if cached_path and os.path.exists(cached_path):
        shutil.copyfile(cached_path, pose_model_path)
pose_results = pose_model.track(dummy_img, persist=True, classes=[0], imgsz=320, verbose=False)
if not pose_results:
    raise RuntimeError('Pose model did not return an inference result.')
print(f'Pose model ready: {pose_model_path}')
"@

& $venvPython -c $verifyScript
if ($LASTEXITCODE -ne 0) {
    Write-Error "YOLO model verification failed."
    exit 1
}

Write-Host "=== Camera Agent Environment Setup Complete ===" -ForegroundColor Green

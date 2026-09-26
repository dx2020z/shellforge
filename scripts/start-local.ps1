# 造物之海 · 本地一键启动（由「启动游戏.cmd」调用）
# 1. 新项目里没有密钥文件时，问你要不要从旧项目「游戏开发项目」复制一份（脚本不会显示里面的内容）
# 2. 关掉占着 3018 / 3020 端口的旧服务
# 3. 第一次运行时安装依赖
# 4. 启动游戏，并自动打开浏览器（正式模式，不带任何参数）
$ErrorActionPreference = 'Continue'
$root = Split-Path $PSScriptRoot -Parent
Set-Location $root
Write-Host ''
Write-Host '==== 造物之海 · 本地启动 ====' -ForegroundColor Yellow

if (-not (Test-Path (Join-Path $root '.env.local'))) {
  $old = Join-Path (Split-Path $root -Parent) '游戏开发项目\.env.local'
  if (Test-Path $old) {
    $ans = Read-Host '新项目里还没有密钥文件 .env.local。要把旧项目「游戏开发项目」里的那份复制过来吗？输入 Y 回车表示同意'
    if ($ans -match '^[Yy]') {
      Copy-Item $old (Join-Path $root '.env.local')
      Write-Host '已复制密钥文件：DeepSeek 和 Tripo 会启用。' -ForegroundColor Green
    } else {
      Write-Host '没有复制：游戏会以离线模式运行（本地规则 + 部件库）。' -ForegroundColor DarkYellow
    }
  } else {
    Write-Host '没有找到密钥文件：游戏会以离线模式运行。' -ForegroundColor DarkYellow
  }
} else {
  Write-Host '已找到密钥文件 .env.local。' -ForegroundColor Green
}

foreach ($port in 3018, 3020) {
  Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue | ForEach-Object {
    Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue
    Write-Host "已关掉占用 $port 端口的旧服务。"
  }
}

if (-not (Test-Path (Join-Path $root 'node_modules'))) {
  Write-Host '第一次运行，正在安装依赖（一两分钟）……'
  npm install
}

Write-Host '正在启动，十几秒后会自动打开浏览器：http://localhost:3020' -ForegroundColor Yellow
Write-Host '玩完了关掉这个窗口即可。'
Start-Process powershell -WindowStyle Hidden -ArgumentList '-NoProfile', '-Command', 'Start-Sleep -Seconds 12; Start-Process "http://localhost:3020"'
npm run dev

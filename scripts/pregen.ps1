# 造物之海 · 预生成模型（由「预生成模型.cmd」调用）
# 调用 Tripo 生成 16 套玩家部件 + 6 套守卫外形（共 66 个部件，会消耗 Tripo 额度）。
# 可以随时关掉窗口，再次运行会接着来，已经生成好的不会重复扣费。
$ErrorActionPreference = 'Continue'
$root = Split-Path $PSScriptRoot -Parent
Set-Location $root
Write-Host ''
Write-Host '==== 造物之海 · 预生成模型 ====' -ForegroundColor Yellow
if (-not (Test-Path (Join-Path $root '.env.local'))) {
  Write-Host '没有找到密钥文件 .env.local。请先双击「启动游戏.cmd」按提示复制一份。' -ForegroundColor Red
  exit 1
}
if (-not (Test-Path (Join-Path $root 'node_modules'))) {
  Write-Host '第一次运行，正在安装依赖……'
  npm install
}
Write-Host '将调用 Tripo 生成还没有的部件（全部生成约 66 次调用，大约 10~20 分钟）。'
$ans = Read-Host '确认开始吗？输入 Y 回车开始'
if ($ans -notmatch '^[Yy]') { Write-Host '已取消。'; exit 0 }
npx tsx scripts/pregen.ts @args
Write-Host ''
Write-Host '结束。生成好的模型在 public\assets\gen\，清单在 src\domain\generated-models.json。' -ForegroundColor Green
Write-Host '回到对话里告诉 Claude「生成好了」，它会检查每个模型的质量。'

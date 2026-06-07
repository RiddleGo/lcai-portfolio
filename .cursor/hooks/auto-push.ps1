# Agent 会话结束时：若本地有未推送 commit，自动 push（最多重试 5 次）
$ErrorActionPreference = 'SilentlyContinue'
$root = git rev-parse --show-toplevel 2>$null
if (-not $root) { exit 0 }
Set-Location $root

$branch = git rev-parse --abbrev-ref HEAD 2>$null
if (-not $branch) { exit 0 }

git fetch origin $branch 2>$null | Out-Null
$ahead = git rev-list --count "origin/$branch..HEAD" 2>$null
if (-not $ahead -or [int]$ahead -le 0) { exit 0 }

for ($i = 1; $i -le 5; $i++) {
  git push origin HEAD 2>&1 | Out-Null
  if ($LASTEXITCODE -eq 0) { exit 0 }
  Start-Sleep -Seconds 10
}
exit 0

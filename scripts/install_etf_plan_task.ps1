# 注册 Windows 计划任务：每个交易日 15:40 检测 ETF 加仓信号
# 用法（管理员 PowerShell）: .\scripts\install_etf_plan_task.ps1

$TaskName = "LCAI-ETF-Plan-Check"
$RepoRoot = Split-Path -Parent $PSScriptRoot
$BatPath = Join-Path $RepoRoot "scripts\run_etf_plan_check.bat"

if (-not (Test-Path $BatPath)) {
    Write-Error "找不到 $BatPath"
    exit 1
}

$Action = New-ScheduledTaskAction -Execute $BatPath -WorkingDirectory $RepoRoot
# 周一到周五 15:40（收盘后）
$Trigger = New-ScheduledTaskTrigger -Weekly -DaysOfWeek Monday,Tuesday,Wednesday,Thursday,Friday -At "15:40"
$Settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries

Register-ScheduledTask -TaskName $TaskName -Action $Action -Trigger $Trigger -Settings $Settings -Force | Out-Null
Write-Host "已注册计划任务: $TaskName"
Write-Host "每天 15:40 运行检测，完成后打开 bat 窗口查看结果"
Write-Host "网页: 资产总览.html#etf"

# Upload ShivaSakti to Oracle Cloud (or any VPS) from Windows
# Usage:
#   .\scripts\upload-to-server.ps1 -ServerIp 132.145.xxx.xxx -User ubuntu
#   .\scripts\upload-to-server.ps1 -ServerIp 132.145.xxx.xxx -User ubuntu -SshKey "$env:USERPROFILE\.ssh\oracle-shivshakti.key"

param(
  [Parameter(Mandatory = $true)]
  [string]$ServerIp,

  [string]$User = 'ubuntu',
  [string]$RemotePath = '/opt/shiva-sakti',
  [string]$SshKey = ''
)

$ErrorActionPreference = 'Stop'
$ProjectRoot = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)

$sshArgs = @()
$scpArgs = @()
if ($SshKey -ne '') {
  $sshArgs = @('-i', $SshKey)
  $scpArgs = @('-i', $SshKey)
}

Write-Host "==> Creating remote folder $RemotePath ..."
ssh @sshArgs "${User}@${ServerIp}" "sudo mkdir -p $RemotePath && sudo chown ${User}:${User} $RemotePath"

Write-Host "==> Uploading project (may take several minutes) ..."
scp @scpArgs -r `
  "$ProjectRoot\apps" `
  "$ProjectRoot\packages" `
  "$ProjectRoot\docker" `
  "$ProjectRoot\deploy" `
  "$ProjectRoot\scripts" `
  "$ProjectRoot\docs" `
  "$ProjectRoot\package.json" `
  "$ProjectRoot\package-lock.json" `
  "${User}@${ServerIp}:${RemotePath}/"

Write-Host ""
Write-Host "Upload done. SSH in and deploy:"
Write-Host "  ssh $($sshArgs -join ' ') ${User}@${ServerIp}"
Write-Host "  cd $RemotePath"
Write-Host "  bash scripts/server-setup.sh"
Write-Host "  cp deploy/env.production.example .env"
Write-Host "  cp deploy/api.env.production.example apps/api/.env"
Write-Host "  nano .env && nano apps/api/.env"
Write-Host "  bash scripts/deploy-production.sh"
Write-Host ""
Write-Host "Full guide: docs/ORACLE-FREE-DEPLOY.md"

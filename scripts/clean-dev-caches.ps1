# Frees disk space used by local dev caches (safe to delete)
$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)

$targets = @(
  "$root\apps\web\.next",
  "$root\node_modules\@shiva-sakti\web\.next",
  "$root\apps\api\storage\tickets",
  "$root\apps\api\storage\emails",
  "$root\node_modules\.cache"
)

foreach ($path in $targets) {
  if (Test-Path $path) {
    Remove-Item -Recurse -Force $path -ErrorAction SilentlyContinue
    Write-Host "Removed: $path"
  }
}

Write-Host "Done. Also empty Recycle Bin and free space on drive C: if ENOSPC persists."

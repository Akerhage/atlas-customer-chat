$ErrorActionPreference = "Stop"

$Source = "C:\Atlas\tests\kundchatt_runtime_logo_worktree\dist"
$Destination = "C:\Atlas\kundchatt"
$ResolvedSource = (Resolve-Path -LiteralPath $Source).Path
$ResolvedDestination = (Resolve-Path -LiteralPath $Destination).Path

if ($ResolvedSource -ne $Source) {
  throw "Unexpected source path: $ResolvedSource"
}
if ($ResolvedDestination -ne $Destination) {
  throw "Unexpected destination path: $ResolvedDestination"
}

Get-ChildItem -LiteralPath $ResolvedDestination -Force | Remove-Item -Recurse -Force
Copy-Item -LiteralPath "$ResolvedSource\index.html" -Destination $ResolvedDestination -Force
Copy-Item -LiteralPath "$ResolvedSource\favicon.ico" -Destination $ResolvedDestination -Force
Copy-Item -LiteralPath "$ResolvedSource\placeholder.svg" -Destination $ResolvedDestination -Force
Copy-Item -LiteralPath "$ResolvedSource\robots.txt" -Destination $ResolvedDestination -Force
Copy-Item -LiteralPath "$ResolvedSource\assets" -Destination $ResolvedDestination -Recurse -Force

Get-ChildItem -Path $ResolvedDestination -Recurse |
  Select-Object FullName, Length |
  Sort-Object FullName |
  ConvertTo-Json

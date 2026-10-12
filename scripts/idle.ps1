# Prints the environment that is NOT serving users.
. "$PSScriptRoot/common.ps1"
Write-Output (Get-Idle)

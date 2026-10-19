# Shows which environment is live and the last deployment result.
$s = (Invoke-RestMethod "http://localhost:9000/api/state").data
Write-Host "LIVE environment : $($s.live.ToUpper())"
foreach ($e in 'blue','green') {
  $i = $s.envs.$e
  if ($i.up) { Write-Host ("{0,-6}: v{1}, {2} attributes, {3}" -f $e.ToUpper(), $i.version, $i.attributeCount, $i.layout) }
  else { Write-Host ("{0,-6}: NOT RUNNING" -f $e.ToUpper()) }
}
if ($s.history.Count -gt 0) { Write-Host "Last deployment  : $($s.history[0].result) - $($s.history[0].reason)" }

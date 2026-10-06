$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$port = 8765
$listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Any, $port)
$listener.Start()
$ips = Get-NetIPAddress -AddressFamily IPv4 |
  Where-Object { $_.IPAddress -notlike '127.*' } |
  ForEach-Object { $_.IPAddress }
Write-Output "serving $root"
Write-Output "phone: http://$($ips[0]):$port/"
foreach ($ip in $ips) { Write-Output "http://${ip}:$port/" }

function Send-Response($stream, $status, $ctype, $bytes) {
  $header = "HTTP/1.1 $status`r`nContent-Type: $ctype`r`nContent-Length: $($bytes.Length)`r`nConnection: close`r`nAccess-Control-Allow-Origin: *`r`n`r`n"
  $headBytes = [Text.Encoding]::ASCII.GetBytes($header)
  $stream.Write($headBytes, 0, $headBytes.Length)
  if ($bytes.Length -gt 0) { $stream.Write($bytes, 0, $bytes.Length) }
}

while ($true) {
  $client = $listener.AcceptTcpClient()
  try {
    $stream = $client.GetStream()
    $stream.ReadTimeout = 5000
    $buffer = New-Object byte[] 4096
    $read = $stream.Read($buffer, 0, $buffer.Length)
    $request = [Text.Encoding]::ASCII.GetString($buffer, 0, [Math]::Max(0, $read))
    $line = ($request -split "`r`n")[0]
    $path = "/"
    if ($line -match '^[A-Z]+ (\S+)') {
      $path = [Uri]::UnescapeDataString(($Matches[1] -split '\?')[0])
    }
    if ($path -eq '/') { $path = '/index.html' }
    $file = Join-Path $root ($path.TrimStart('/') -replace '/', [IO.Path]::DirectorySeparatorChar)
    $full = [IO.Path]::GetFullPath($file)
    if (-not $full.StartsWith([IO.Path]::GetFullPath($root))) {
      Send-Response $stream '403 Forbidden' 'text/plain' ([Text.Encoding]::UTF8.GetBytes('forbidden'))
    } elseif (Test-Path $full -PathType Leaf) {
      $ext = [IO.Path]::GetExtension($full).ToLower()
      $ctype = switch ($ext) {
        '.html' { 'text/html; charset=utf-8' }
        '.css' { 'text/css; charset=utf-8' }
        '.js' { 'text/javascript; charset=utf-8' }
        default { 'application/octet-stream' }
      }
      Send-Response $stream '200 OK' $ctype ([IO.File]::ReadAllBytes($full))
    } else {
      Send-Response $stream '404 Not Found' 'text/plain' ([Text.Encoding]::UTF8.GetBytes('not found'))
    }
  } catch {
    # ignore dropped phones / incomplete requests
  } finally {
    $client.Close()
  }
}

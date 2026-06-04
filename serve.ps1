param([int]$Port = 4173)
# 零依赖静态文件服务器（仅用于本地预览/验证；产品本身可直接双击 index.html 打开）
$ErrorActionPreference = 'Stop'
$root = $PSScriptRoot
if ([string]::IsNullOrEmpty($root)) { $root = Split-Path -Parent $MyInvocation.MyCommand.Definition }
if ([string]::IsNullOrEmpty($root)) { $root = (Get-Location).Path }

$mime = @{
  ".html" = "text/html; charset=utf-8"
  ".js"   = "application/javascript; charset=utf-8"
  ".css"  = "text/css; charset=utf-8"
  ".json" = "application/json; charset=utf-8"
  ".png"  = "image/png"; ".jpg" = "image/jpeg"; ".svg" = "image/svg+xml"; ".ico" = "image/x-icon"
}

$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$Port/")
$listener.Start()
Write-Host "Serving '$root' on http://localhost:$Port/"

while ($listener.IsListening) {
  $ctx = $null
  try { $ctx = $listener.GetContext() } catch { continue }
  $res = $ctx.Response
  try {
    $rel = [System.Uri]::UnescapeDataString($ctx.Request.Url.AbsolutePath)
    if ([string]::IsNullOrEmpty($rel) -or $rel -eq "/") { $rel = "/index.html" }
    $path = Join-Path $root ($rel.TrimStart("/").Replace("/", "\"))
    if (Test-Path -LiteralPath $path -PathType Leaf) {
      $bytes = [System.IO.File]::ReadAllBytes($path)
      $ext = [System.IO.Path]::GetExtension($path).ToLower()
      if ($mime.ContainsKey($ext)) { $res.ContentType = $mime[$ext] }
      $res.StatusCode = 200
      $res.ContentLength64 = $bytes.Length
      $res.OutputStream.Write($bytes, 0, $bytes.Length)
    }
    else {
      $res.StatusCode = 404
      $msg = [System.Text.Encoding]::UTF8.GetBytes("404 Not Found: $rel")
      $res.OutputStream.Write($msg, 0, $msg.Length)
    }
  }
  catch {
    try {
      $res.StatusCode = 500
      $e = [System.Text.Encoding]::UTF8.GetBytes("500 Server Error: " + $_.Exception.Message)
      $res.OutputStream.Write($e, 0, $e.Length)
    }
    catch { }
  }
  finally {
    try { $res.OutputStream.Close() } catch { }
    try { $res.Close() } catch { }
  }
}

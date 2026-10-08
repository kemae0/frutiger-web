Add-Type -AssemblyName System.Drawing
foreach ($size in 16,32,48,128) {
  $bitmap = New-Object System.Drawing.Bitmap $size,$size
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $graphics.Clear([System.Drawing.Color]::Transparent)
  $margin = [single]($size * .035)
  $circle = New-Object System.Drawing.RectangleF $margin,$margin,([single]($size - 2*$margin)),([single]($size - 2*$margin))
  $brush = New-Object System.Drawing.Drawing2D.LinearGradientBrush $circle,([System.Drawing.Color]::FromArgb(255,131,223,245)),([System.Drawing.Color]::FromArgb(255,10,120,176)),([single]90)
  $graphics.FillEllipse($brush,$circle)
  $pen = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(255,83,160,185)),([single][Math]::Max(1,$size*.012))
  $graphics.DrawEllipse($pen,$circle)
  $shine = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(112,255,255,255))
  $graphics.FillEllipse($shine,([single]($size*.14)),([single]($size*.08)),([single]($size*.7)),([single]($size*.4)))
  $green = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255,139,207,83))
  $graphics.FillEllipse($green,([single]($size*.08)),([single]($size*.68)),([single]($size*.84)),([single]($size*.22)))
  $white = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::White)
  $points = [System.Drawing.PointF[]]@((New-Object System.Drawing.PointF ([single]($size*.4)),([single]($size*.3))), (New-Object System.Drawing.PointF ([single]($size*.4)),([single]($size*.69))), (New-Object System.Drawing.PointF ([single]($size*.7)),([single]($size*.49))))
  $graphics.FillPolygon($white,$points)
  $bitmap.Save((Join-Path (Get-Location) "frutiger-web/icons/icon-$size.png"),[System.Drawing.Imaging.ImageFormat]::Png)
  $brush.Dispose(); $pen.Dispose(); $shine.Dispose(); $green.Dispose(); $white.Dispose(); $graphics.Dispose(); $bitmap.Dispose()
}

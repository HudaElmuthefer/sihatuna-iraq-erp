Add-Type -AssemblyName System.Drawing

# Removes the solid dark ambient backdrop from each of the 4 stat-tile icon
# PNGs (glass plate itself stays opaque — only the empty product-photo
# background around it becomes transparent), via a luminance ramp:
#   luminance <= LOW  -> fully transparent
#   luminance >= HIGH -> fully opaque (original alpha kept)
#   in between        -> linear fade (feathered edge, no jagged cutout)
# Thresholds picked from real sampled pixels earlier this session: pure
# ambient backdrop ~11-27 avg, glass plate fill ~55-90+ avg.
$LOW = 24
$HIGH = 52

function Make-Transparent($srcPath, $dstPath) {
  # Source PNGs have no alpha channel at all (24bpp) — LockBits only gives
  # correct ARGB byte layout when the Bitmap's *actual* native format is
  # already 32bppArgb, not merely the format requested in LockBits itself
  # (requesting a different format than native silently no-ops on some
  # .NET/GDI+ builds instead of converting). Force a real conversion first
  # by drawing the source onto a fresh 32bppArgb bitmap.
  $orig = [System.Drawing.Bitmap]::FromFile($srcPath)
  $bmp = New-Object System.Drawing.Bitmap($orig.Width, $orig.Height, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $gfx = [System.Drawing.Graphics]::FromImage($bmp)
  $gfx.DrawImage($orig, 0, 0, $orig.Width, $orig.Height)
  $gfx.Dispose()
  $orig.Dispose()

  $rect = New-Object System.Drawing.Rectangle(0, 0, $bmp.Width, $bmp.Height)
  $data = $bmp.LockBits($rect, [System.Drawing.Imaging.ImageLockMode]::ReadWrite, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $bytes = $data.Stride * $bmp.Height
  $buffer = New-Object byte[] $bytes
  [System.Runtime.InteropServices.Marshal]::Copy($data.Scan0, $buffer, 0, $bytes)

  for ($i = 0; $i -lt $bytes; $i += 4) {
    $b = $buffer[$i]; $g = $buffer[$i+1]; $r = $buffer[$i+2]; $a = $buffer[$i+3]
    $lum = ($r + $g + $b) / 3.0
    if ($lum -le $LOW) {
      $newAlpha = 0
    } elseif ($lum -ge $HIGH) {
      $newAlpha = $a
    } else {
      $t = ($lum - $LOW) / ($HIGH - $LOW)
      $newAlpha = [Math]::Round($a * $t)
    }
    $buffer[$i+3] = [byte]$newAlpha
  }

  [System.Runtime.InteropServices.Marshal]::Copy($buffer, 0, $data.Scan0, $bytes)
  $bmp.UnlockBits($data)
  $bmp.Save($dstPath, [System.Drawing.Imaging.ImageFormat]::Png)
  $bmp.Dispose()
  Write-Output "OK: $dstPath"
}

$dir = 'C:\Users\Eng.Huda Elmuthefer\Documents\huda-portfolio\sihatuna-iraq-erp\frontend\src\assets\dark'
Make-Transparent "$dir\icon-documents.png" "$dir\icon-documents-transparent.png"
Make-Transparent "$dir\icon-projects.png"  "$dir\icon-projects-transparent.png"
Make-Transparent "$dir\icon-calendar.png"  "$dir\icon-calendar-transparent.png"
Make-Transparent "$dir\icon-warehouse.png" "$dir\icon-warehouse-transparent.png"

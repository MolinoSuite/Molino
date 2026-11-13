# Checks the Molino PDF app as people get it, from its Microsoft Store package:
# opens a small PDF and waits until the window has drawn its page, with the
# document engine running sandboxed. Used by the GitHub build on Windows x64 and
# on Windows 11 on Arm, where the x64 app runs under emulation.
#
#   pwsh -File scripts\app-check.ps1 -Msix dist\MolinoPDF.appx [-Screenshot app.png] [-ExpectEmulated]
#
# It signs the package with a throwaway certificate trusted only on that machine
# (the Store signs the real one), installs it, opens the PDF through its
# command-line alias, checks that the data went to the package's own folder, and
# uninstalls it. It changes the system, so it only runs on GitHub's build
# machines, which are thrown away after each build.
# -Screenshot captures only the Molino PDF window (PrintWindow), never the rest of
# the screen. Everything started here is closed and deleted at the end.
# ASCII only: Windows PowerShell 5.1 reads scripts without a BOM as ANSI.
param(
    [Parameter(Mandatory = $true)]
    [string] $Msix,
    [string] $Screenshot,
    [switch] $ExpectEmulated,
    [int] $TimeoutSeconds = 180
)
$ErrorActionPreference = 'Stop'

function Get-FullPath([string] $path) {
    $ExecutionContext.SessionState.Path.GetUnresolvedProviderPathFromPSPath($path)
}

# A one-page PDF written here, so the check needs no sample files.
function New-TestPdf([string] $path) {
    $content = 'BT /F1 32 Tf 72 740 Td (Molino PDF app check) Tj ET'
    $objects = @(
        '<< /Type /Catalog /Pages 2 0 R >>',
        '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
        '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
        '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
        "<< /Length $($content.Length) >>`nstream`n$content`nendstream"
    )
    $text = [System.Text.StringBuilder]::new("%PDF-1.7`n")
    $offsets = @()
    for ($i = 0; $i -lt $objects.Count; $i++) {
        $offsets += $text.Length  # ASCII: one character is one byte
        [void]$text.Append("$($i + 1) 0 obj`n$($objects[$i])`nendobj`n")
    }
    $xref = $text.Length
    [void]$text.Append("xref`n0 $($objects.Count + 1)`n0000000000 65535 f`r`n")
    foreach ($offset in $offsets) { [void]$text.Append(('{0:D10} 00000 n' -f $offset) + "`r`n") }
    [void]$text.Append("trailer`n<< /Size $($objects.Count + 1) /Root 1 0 R >>`nstartxref`n$xref`n%%EOF`n")
    [System.IO.File]::WriteAllText($path, $text.ToString(), [System.Text.Encoding]::ASCII)
}

function Read-Log([string] $path) {
    if (Test-Path $path) { Get-Content $path -Raw -Encoding utf8 } else { '' }
}

# Captures the Molino PDF window alone and fails if it is blank (one flat colour):
# that is how a window looks when the app runs but nothing is painted.
function Save-WindowShot([System.Diagnostics.Process] $process, [string] $path) {
    Add-Type -AssemblyName System.Drawing
    if (-not ('MolinoCheck.Native' -as [type])) {
        Add-Type -Namespace MolinoCheck -Name Native -MemberDefinition @'
[System.Runtime.InteropServices.StructLayout(System.Runtime.InteropServices.LayoutKind.Sequential)]
public struct Rect { public int Left, Top, Right, Bottom; }
[System.Runtime.InteropServices.DllImport("user32.dll")]
public static extern bool GetWindowRect(System.IntPtr window, out Rect rect);
[System.Runtime.InteropServices.DllImport("user32.dll")]
public static extern bool PrintWindow(System.IntPtr window, System.IntPtr hdc, uint flags);
'@
    }
    $process.Refresh()
    $window = $process.MainWindowHandle
    if ($window -eq [System.IntPtr]::Zero) { throw 'Molino PDF has no window.' }
    $rect = New-Object MolinoCheck.Native+Rect
    if (-not [MolinoCheck.Native]::GetWindowRect($window, [ref] $rect)) { throw 'Could not read the window size.' }
    $width = $rect.Right - $rect.Left
    $height = $rect.Bottom - $rect.Top
    if ($width -lt 200 -or $height -lt 200) { throw "The window is too small ($width x $height)." }
    $bitmap = New-Object System.Drawing.Bitmap $width, $height
    try {
        $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
        $hdc = $graphics.GetHdc()
        # 2 = PW_RENDERFULLCONTENT, needed for windows drawn by the GPU (Chromium).
        $printed = [MolinoCheck.Native]::PrintWindow($window, $hdc, 2)
        $graphics.ReleaseHdc($hdc)
        $graphics.Dispose()
        if (-not $printed) { throw 'Could not capture the window.' }
        $bitmap.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
        $colours = New-Object 'System.Collections.Generic.HashSet[int]'
        for ($x = 0; $x -lt 24; $x++) {
            for ($y = 0; $y -lt 24; $y++) {
                [void]$colours.Add($bitmap.GetPixel([int](($x + 0.5) * $width / 24), [int](($y + 0.5) * $height / 24)).ToArgb())
            }
        }
    }
    finally { $bitmap.Dispose() }
    "window: $width x $height, $($colours.Count) colours sampled, saved to $path"
    if ($colours.Count -lt 3) { throw 'The Molino PDF window is blank.' }
}

function Stop-Molino([System.Diagnostics.Process] $process) {
    if ($process -and -not $process.HasExited) {
        # Only the processes started here: Molino PDF and the ones it launched.
        Get-CimInstance Win32_Process | Where-Object { $_.ParentProcessId -eq $process.Id } |
            ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
        Stop-Process -Id $process.Id -Force -ErrorAction SilentlyContinue
    }
    Start-Sleep -Milliseconds 800
}

# Starts Molino PDF with the PDF, waits for the page and checks the log. -Arguments
# go before the PDF (for example a temporary profile). With $store, $exe is the
# package's command-line alias and the app is the Molino.exe that Windows starts
# from the package folder.
function Test-Molino([string] $exe, [string] $pdf, [string] $log, [string[]] $arguments, [bool] $store = $false) {
    $started = Get-Date
    $process = Start-Process -FilePath $exe -ArgumentList (@($arguments) + @("`"$pdf`"")) -PassThru
    if ($store) {
        $deadline = $started.AddSeconds(60)
        do {
            Start-Sleep -Milliseconds 500
            # Electron runs several Molino.exe (window, GPU...): the main one is the
            # one whose parent is not another Molino.exe.
            $all = @(Get-CimInstance Win32_Process -Filter "Name = 'Molino.exe'" | Where-Object { $_.ExecutablePath -like '*\WindowsApps\*' })
            $ids = @($all | ForEach-Object { $_.ProcessId })
            $main = $all | Where-Object { $ids -notcontains $_.ParentProcessId } | Select-Object -First 1
            $packaged = if ($main) { Get-Process -Id $main.ProcessId -ErrorAction SilentlyContinue } else { $null }
        } while (-not $packaged -and (Get-Date) -lt $deadline)
        if (-not $packaged) { throw 'The Store package did not start Molino PDF.' }
        $process = $packaged
    }
    try {
        $deadline = $started.AddSeconds($TimeoutSeconds)
        while ((Get-Date) -lt $deadline -and -not $process.HasExited) {
            Start-Sleep -Milliseconds 700
            if ((Read-Log $log) -match 'primera p.gina dibujada') { break }
        }
        $seconds = [int]((Get-Date) - $started).TotalSeconds
        $text = Read-Log $log
        $text -split "`r?`n" | Where-Object { $_ } | ForEach-Object { "  $_" }

        if ($process.HasExited) { throw "Molino PDF closed by itself (exit code $($process.ExitCode))." }
        if ($text -notmatch 'iniciado') { throw 'Molino PDF did not start.' }
        if ($text -match 'funciona sin aislamiento') { throw 'The document engine is not sandboxed.' }
        if ($text -notmatch 'documento abierto \(1 p') { throw "The PDF did not open within $TimeoutSeconds s." }
        if ($text -notmatch 'primera p.gina dibujada') { throw "The window did not draw the page within $TimeoutSeconds s." }
        $engine = Get-CimInstance Win32_Process -Filter "Name = 'molino-engine.exe'" | Where-Object { $_.ParentProcessId -eq $process.Id }
        if (-not $engine) { throw 'The document engine is not running.' }
        if ($ExpectEmulated -and $text -notmatch 'emulado') { throw 'The engine did not report x64 emulation on Arm.' }
        if ($Screenshot) {
            Start-Sleep -Seconds 3  # let the page finish painting
            Save-WindowShot $process $Screenshot
        }
        "app: started, PDF opened and page drawn in $seconds s, engine sandboxed"
    }
    finally { Stop-Molino $process }
}

if ($env:GITHUB_ACTIONS -ne 'true') {
    throw 'The check installs Molino PDF for the current user: it only runs on GitHub build machines.'
}
if ($Screenshot) { $Screenshot = Get-FullPath $Screenshot }

$folder = Join-Path ([System.IO.Path]::GetTempPath()) ('molino-app-check-' + [System.Guid]::NewGuid().ToString('N').Substring(0, 8))
New-Item -ItemType Directory -Path $folder | Out-Null
try {
    $pdf = Join-Path $folder 'check.pdf'
    New-TestPdf $pdf
    if ($Msix) {
        $Msix = Get-FullPath $Msix
        if (-not (Test-Path $Msix)) { throw "No Store package at $Msix." }
        # The identity comes from the package itself: the test certificate must carry its publisher.
        Add-Type -AssemblyName System.IO.Compression.FileSystem
        $archive = [System.IO.Compression.ZipFile]::OpenRead($Msix)
        try {
            $reader = New-Object System.IO.StreamReader ($archive.GetEntry('AppxManifest.xml').Open())
            [xml] $manifest = $reader.ReadToEnd()
            $reader.Dispose()
        }
        finally { $archive.Dispose() }
        $identity = $manifest.Package.Identity
        "store package: $($identity.Name) $($identity.Version), publisher $($identity.Publisher)"
        $cert = New-SelfSignedCertificate -Type Custom -Subject $identity.Publisher -KeyUsage DigitalSignature `
            -FriendlyName 'Molino Store package check (throwaway)' -CertStoreLocation 'Cert:\CurrentUser\My' `
            -TextExtension @('2.5.29.37={text}1.3.6.1.5.5.7.3.3', '2.5.29.19={text}')
        $trusted = $null
        $data = $null
        $signed = Join-Path $folder 'MolinoPDF.appx'
        Copy-Item $Msix $signed
        try {
            $signtool = Get-ChildItem "${env:ProgramFiles(x86)}\Windows Kits\10\bin\*\x64\signtool.exe" -ErrorAction SilentlyContinue |
                Sort-Object FullName -Descending | Select-Object -First 1
            if (-not $signtool) { throw 'No signtool.exe (Windows SDK) on this machine.' }
            & $signtool.FullName sign /q /fd SHA256 /sha1 $cert.Thumbprint /s My $signed
            if ($LASTEXITCODE -ne 0) { throw 'Could not sign the test package.' }
            $cer = Join-Path $folder 'check.cer'
            Export-Certificate -Cert $cert -FilePath $cer | Out-Null
            $trusted = Import-Certificate -FilePath $cer -CertStoreLocation 'Cert:\LocalMachine\TrustedPeople'
            Add-AppxPackage -Path $signed
            $package = Get-AppxPackage -Name $identity.Name
            if (-not $package) { throw 'The Store package was not installed.' }
            $data = Join-Path $env:LOCALAPPDATA "Packages\$($package.PackageFamilyName)\LocalState"
            $alias = Join-Path $env:LOCALAPPDATA 'Microsoft\WindowsApps\molino-pdf.exe'
            if (-not (Test-Path $alias)) { throw 'The package did not register its command-line alias (molino-pdf).' }
            "store package: installed as $($package.PackageFamilyName)"
            # Who may read the engine inside the package (the sandboxed engine must).
            & "$env:SystemRoot\System32\icacls.exe" (Join-Path $package.InstallLocation 'app\resources\engine') | ForEach-Object { "  acl: $_" }
            $usual = Join-Path $env:LOCALAPPDATA 'Molino'
            $hadUsual = Test-Path $usual
            $log = Join-Path $data 'logs\molino.log'
            Test-Molino $alias $pdf $log @() $true
            if ((Read-Log $log) -notmatch 'iniciado \(Microsoft Store\)') { throw 'Molino PDF did not start as the Store version.' }
            if (-not $hadUsual -and (Test-Path $usual)) { throw 'The Store version wrote to %LOCALAPPDATA%\Molino instead of its package folder.' }
            'store package: data in the package folder'
        }
        finally {
            Get-Process Molino -ErrorAction SilentlyContinue | Where-Object { $_.Path -like '*\WindowsApps\*' } | Stop-Process -Force -ErrorAction SilentlyContinue
            Start-Sleep -Seconds 1
            Get-AppxPackage -Name $identity.Name | Remove-AppxPackage -ErrorAction SilentlyContinue
            if ($trusted) { Remove-Item -Path "Cert:\LocalMachine\TrustedPeople\$($trusted.Thumbprint)" -ErrorAction SilentlyContinue }
            Remove-Item -Path "Cert:\CurrentUser\My\$($cert.Thumbprint)" -ErrorAction SilentlyContinue
        }
        if (Get-AppxPackage -Name $identity.Name) { throw 'The Store package is still installed after removing it.' }
        if ($data -and (Test-Path $data)) { throw 'Windows left the package data folder after uninstalling.' }
        'store package: uninstalled, its data folder removed'
    }
}
finally {
    Remove-Item -Recurse -Force $folder -ErrorAction SilentlyContinue
}

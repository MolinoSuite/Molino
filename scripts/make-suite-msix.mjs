// El paquete de la Microsoft Store (MSIX) de Molino Suite: todas las apps
// (Molino, PDF, Documentos, Hojas y Presentaciones) y el motor de oficina
// dentro, sin descargar nada. npm run dist:suite.
//
// 1. Compila Molino con la versión de la suite (package.json, suiteVersion) en
//    dist-suite\win-unpacked (electron-builder --win dir).
// 2. Monta el paquete en dist-suite\layout: el programa en app\, la pieza de
//    oficina en app\resources\office (la arma office\build.py en dist-office),
//    los iconos de las apps y las plantillas, las imágenes y el manifiesto
//    (build\suite) y resources.pri (makepri).
// 3. Deja dist-suite\MolinoSuite.msix (makeappx), sin firmar: la Store lo firma.
//
// --prepackaged: no vuelve a compilar (usa dist-suite\win-unpacked tal cual).
// --layout: solo monta el paquete (para probarlo en este equipo con el modo de
// desarrollador: Add-AppxPackage -Register dist-suite\layout\AppxManifest.xml).
import { execFileSync } from 'node:child_process'
import { cpSync, existsSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const out = join(root, 'dist-suite')
const unpacked = join(out, 'win-unpacked')
const layout = join(out, 'layout')
const args = new Set(process.argv.slice(2))

const fail = (message) => {
  console.error(`make-suite-msix: ${message}`)
  process.exit(1)
}

// La versión de Molino Suite (la de Molino PDF es la de "version").
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
const version = pkg.suiteVersion
if (!/^\d+\.\d+\.\d+$/.test(version ?? '')) fail('falta suiteVersion (x.y.z) en package.json')

// La pieza de oficina de esta versión de Molino (src/main/office.ts, OFFICE_PIECE).
const pieceVersion = /export const OFFICE_PIECE[^{]*\{\s*version:\s*'([^']+)'/.exec(readFileSync(join(root, 'src', 'main', 'office.ts'), 'utf8'))?.[1]
if (!pieceVersion) fail('no se encontró la versión de la pieza en src/main/office.ts')
const piece = join(root, 'dist-office', `MolinoOffice-${pieceVersion}`)
try {
  const manifest = JSON.parse(readFileSync(join(piece, 'manifest.json'), 'utf8'))
  if (manifest.piece !== 'office' || manifest.version !== pieceVersion) throw new Error()
} catch {
  fail(`falta la pieza de oficina ${pieceVersion} en ${piece} (python office\\build.py)`)
}

// Las herramientas del SDK de Windows (la versión más nueva que haya).
function sdkTool(name) {
  const base = join(process.env['ProgramFiles(x86)'] ?? 'C:\\Program Files (x86)', 'Windows Kits', '10', 'bin')
  const versions = existsSync(base) ? readdirSync(base).filter((v) => /^10\.\d+\.\d+\.\d+$/.test(v)) : []
  versions.sort((a, b) => a.localeCompare(b, 'en', { numeric: true }))
  for (const v of versions.reverse()) {
    const tool = join(base, v, 'x64', name)
    if (existsSync(tool)) return tool
  }
  fail(`no está ${name} (instala el SDK de Windows)`)
}

const run = (command, commandArgs, options = {}) => execFileSync(command, commandArgs, { stdio: 'inherit', cwd: root, ...options })

/** Una herramienta del SDK: su salida solo si falla (cuenta cada archivo que procesa). */
function sdk(name, toolArgs) {
  try {
    execFileSync(sdkTool(name), toolArgs, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 256 * 1024 * 1024 })
  } catch (error) {
    const said = [error.stdout ?? '', error.stderr ?? ''].join('\n').split(/\r?\n/).filter((line) => line.trim() && !/^Processing /.test(line))
    console.error(said.slice(-25).join('\n'))
    fail(`${name} falló`)
  }
}

// 1. Compilar.
if (!args.has('--prepackaged')) {
  // El propio Node con la orden de electron-builder: sin shell de por medio.
  run(process.execPath, [
    join(root, 'node_modules', 'electron-builder', 'cli.js'), '--win', 'dir', '--x64', '--publish', 'never',
    `-c.extraMetadata.version=${version}`, '-c.directories.output=dist-suite'
  ])
}
if (!existsSync(join(unpacked, 'Molino.exe'))) fail(`no está ${join(unpacked, 'Molino.exe')}`)

/**
 * Copia una carpeta. Copias de verdad, no enlaces duros: al registrar el paquete
 * (modo de desarrollador) Windows cambia los permisos de sus archivos, y con
 * enlaces cambiarían también los de los originales (la pieza de dist-office).
 */
const copyTree = (from, to) => cpSync(from, to, { recursive: true })

// 2. Montar el paquete.
rmSync(layout, { recursive: true, force: true })
copyTree(unpacked, join(layout, 'app'))
copyTree(piece, join(layout, 'app', 'resources', 'office'))
// Lo demás de Documentos, Hojas y Presentaciones: los iconos de sus ventanas y las plantillas para empezar.
copyTree(join(root, 'build', 'icons'), join(layout, 'app', 'resources', 'icons'))
copyTree(join(root, 'resources', 'templates'), join(layout, 'app', 'resources', 'templates'))
// Inter, la letra predeterminada de los documentos nuevos (scripts/make-default-font.py; officeconfig.ts).
copyTree(join(root, 'resources', 'fonts'), join(layout, 'app', 'resources', 'fonts'))
copyTree(join(root, 'build', 'suite', 'assets'), join(layout, 'assets'))
const windowsVersion = `${version}.0`
const manifest = readFileSync(join(root, 'build', 'suite', 'AppxManifest.xml'), 'utf8')
if (!manifest.includes('Version="{version}"')) fail('el manifiesto no tiene Version="{version}"')
writeFileSync(join(layout, 'AppxManifest.xml'), manifest.replace('Version="{version}"', `Version="${windowsVersion}"`))

// resources.pri: las imágenes (con sus escalas y tamaños) y los textos de cada
// idioma. Se indexa una carpeta aparte con solo eso, no el programa entero.
const pri = join(out, 'pri')
rmSync(pri, { recursive: true, force: true })
copyTree(join(root, 'build', 'suite', 'assets'), join(pri, 'assets'))
copyTree(join(root, 'build', 'suite', 'strings'), join(pri, 'strings'))
sdk('makepri.exe', [
  'new', '/Overwrite', '/ProjectRoot', pri, '/ConfigXml', join(root, 'build', 'suite', 'priconfig.xml'),
  '/Manifest', join(layout, 'AppxManifest.xml'), '/OutputFile', join(layout, 'resources.pri')
])
rmSync(pri, { recursive: true, force: true })

const size = (dir) => readdirSync(dir, { withFileTypes: true, recursive: true }).reduce((sum, e) => sum + (e.isFile() ? statSync(join(e.parentPath, e.name)).size : 0), 0)
console.log(`Molino Suite ${windowsVersion}: ${relative(root, layout)} (${(size(layout) / 1e6).toFixed(0)} MB)`)
if (args.has('--layout')) process.exit(0)

// 3. Empaquetar.
const msix = join(out, 'MolinoSuite.msix')
sdk('makeappx.exe', ['pack', '/o', '/h', 'SHA256', '/d', layout, '/p', msix])
console.log(`${relative(root, msix)} (${(statSync(msix).size / 1e6).toFixed(0)} MB)`)

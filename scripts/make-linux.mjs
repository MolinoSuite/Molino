// Los paquetes de Linux de Molino PDF o de Molino Suite (.deb, .rpm y AppImage)
// para la arquitectura de este equipo (x64 o ARM64). Se arman en Linux:
//
//   node scripts/make-linux.mjs --pdf     (o --suite)   [--deb] [--rpm] [--appimage]
//
// Sin elegir formato, los tres. Antes: npm run build, el motor empaquetado
// (bash scripts/build-engine.sh) y, para la Suite, la pieza de oficina de esta
// arquitectura (python -I office/build.py) y los diccionarios
// (scripts/fetch-dictionaries.py). Deja los paquetes en dist-linux/<pdf|suite>.
//
// Es la configuración de siempre (electron-builder.yml) con lo de Linux:
// - Molino PDF en /opt/molino-pdf, que se abre con «molino-pdf»; Molino Suite en
//   /opt/molino-suite, con «molino-suite», y su entrada principal es «Molino» (el
//   inicio común) más las de Molino PDF, Documentos, Hojas y Presentaciones
//   (build/linux/apps), con sus iconos y sus tipos de archivo.
// - El comando «molino» de la línea de órdenes en los dos (build/linux/after-install.tpl).
// - El .deb trae el perfil de AppArmor que necesita Electron en Ubuntu 24.04; la
//   AppImage solo apaga el aislamiento de Chromium si el sistema no lo permite.
// - Lo necesario para la actualización automática (latest-linux*.yml), con los
//   paquetes en GitHub Releases.
import { createRequire } from 'node:module'
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { arch as hostArch } from 'node:os'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const args = new Set(process.argv.slice(2))
const fail = (message) => {
  console.error(`make-linux: ${message}`)
  process.exit(1)
}

if (process.platform !== 'linux') fail('los paquetes de Linux se arman en Linux (en este equipo, scripts/linux-dev)')
const suite = args.has('--suite')
if (suite === args.has('--pdf')) fail('di cuál: --pdf o --suite')
const product = suite ? 'suite' : 'pdf'
const arch = hostArch() === 'arm64' ? 'arm64' : 'x64'
const formats = ['deb', 'rpm', 'appimage'].filter((f) => args.has(`--${f}`))
const targets = (formats.length > 0 ? formats : ['deb', 'rpm', 'appimage']).map((f) => (f === 'appimage' ? 'AppImage' : f))

const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
const version = suite ? pkg.suiteVersion : pkg.version
if (!/^\d+\.\d+\.\d+$/.test(version ?? '')) fail('versión no válida en package.json')
const productName = suite ? 'Molino Suite' : 'Molino PDF'
const executableName = suite ? 'molino-suite' : 'molino-pdf'

// Lo que tiene que estar hecho antes.
if (!existsSync(join(root, 'out', 'main', 'index.js'))) fail('falta compilar la app: npm run build')
const engine = join(root, 'dist-engine', 'molino-engine', 'molino-engine')
if (!existsSync(engine)) fail('falta el motor empaquetado: bash scripts/build-engine.sh')
let piece = null
if (suite) {
  const pieceVersion = /export const OFFICE_PIECE[^{]*\{\s*version:\s*'([^']+)'/.exec(readFileSync(join(root, 'src', 'main', 'office.ts'), 'utf8'))?.[1]
  if (!pieceVersion) fail('no se encontró la versión de la pieza en src/main/office.ts')
  piece = join(root, 'dist-office', `MolinoOffice-${pieceVersion}-linux-${arch}`)
  try {
    const manifest = JSON.parse(readFileSync(join(piece, 'manifest.json'), 'utf8'))
    if (manifest.piece !== 'office' || manifest.version !== pieceVersion || manifest.platform !== `linux-${arch}`) throw new Error()
  } catch {
    fail(`falta la pieza de oficina ${pieceVersion} para Linux ${arch} en ${relative(root, piece)} (python -I office/build.py)`)
  }
  if (!existsSync(join(root, 'resources', 'dictionaries', 'es_MX', 'es_MX.dic'))) fail('faltan los diccionarios (python -I scripts/fetch-dictionaries.py)')
}

// Los iconos: el de la app principal como lo pide electron-builder (una carpeta con
// 16x16.png, 32x32.png…; los instala con el nombre del programa) y, en la Suite, los
// de sus otras apps en /usr/share/icons. El de Molino PDF de la Suite se llama
// distinto que el de Molino PDF suelto: los dos paquetes se pueden instalar a la vez.
const work = join(root, 'build-linux', product)
rmSync(work, { recursive: true, force: true })
const hicolor = join(root, 'build', 'linux', 'hicolor')
const sizes = readdirSync(hicolor).filter((d) => /^\d+x\d+$/.test(d))
const iconDir = join(work, 'icon')
mkdirSync(iconDir, { recursive: true })
for (const size of sizes) cpSync(join(hicolor, size, 'apps', `${suite ? 'molino' : 'molino-pdf'}.png`), join(iconDir, `${size}.png`))
const fpm = []
if (suite) {
  const extra = { 'molino-pdf': 'molino-suite-pdf', 'molino-documentos': 'molino-documentos', 'molino-hojas': 'molino-hojas', 'molino-presentaciones': 'molino-presentaciones' }
  for (const size of sizes) {
    for (const [from, to] of Object.entries(extra)) {
      const target = join(work, 'icons', size, `${to}.png`)
      mkdirSync(dirname(target), { recursive: true })
      cpSync(join(hicolor, size, 'apps', `${from}.png`), target)
      fpm.push(`${target}=/usr/share/icons/hicolor/${size}/apps/${to}.png`)
    }
  }
  for (const app of ['pdf', 'docs', 'sheets', 'slides']) {
    fpm.push(`${join(root, 'build', 'linux', 'apps', `molino-suite-${app}.desktop`)}=/usr/share/applications/molino-suite-${app}.desktop`)
  }
}

// La configuración de siempre, con lo de Linux encima.
const yaml = require('js-yaml')
const base = yaml.load(readFileSync(join(root, 'electron-builder.yml'), 'utf8'))
const scripts = { afterInstall: join(root, 'build', 'linux', 'after-install.tpl'), afterRemove: join(root, 'build', 'linux', 'after-remove.tpl') }
const config = {
  ...base,
  // Sin espacios: es la carpeta de /opt (y Chromium no lanza bien sus procesos
  // desde una ruta con espacios). El nombre que se ve lo ponen los .desktop y Molino.
  productName: executableName,
  directories: { output: `dist-linux/${product}`, buildResources: 'build' },
  // El nombre del paquete y el de la ventana (Wayland y X11 la asocian con su .desktop).
  extraMetadata: { name: executableName, version, desktopName: `${executableName}.desktop` },
  // El motor no va aquí: lo copia afterPack (más abajo), con sus enlaces simbólicos.
  extraResources: [
    ...base.extraResources.filter((r) => r.from !== 'dist-engine/molino-engine'),
    // Los iconos de las apps, para los accesos que pone la AppImage (src/main/appimage.ts).
    { from: 'build/linux/hicolor', to: 'linux-icons', filter: ['*/apps/*.png'] },
    ...(suite
      ? [
          { from: relative(root, piece), to: 'office' },
          { from: 'build/icons', to: 'icons' },
          { from: 'resources/templates', to: 'templates' },
          { from: 'resources/dictionaries', to: 'dictionaries' }
        ]
      : [])
  ],
  linux: {
    target: targets,
    executableName,
    syncDesktopName: true,
    icon: iconDir,
    category: 'Office',
    synopsis: suite ? 'Suite ofimática libre: PDF, documentos, hojas y presentaciones' : 'Visor y editor de PDF libre',
    description: suite
      ? 'Molino Suite: Molino PDF, Documentos, Hojas y Presentaciones, en tu equipo y sin cuenta.'
      : 'Molino PDF: abre, rellena, firma y edita PDF, en tu equipo y sin cuenta.',
    // La Suite abre «Molino», el inicio común; Molino PDF, el PDF.
    ...(suite ? { executableArgs: ['--molino-app=home'] } : { mimeTypes: ['application/pdf'] }),
    desktop: {
      entry: suite
        ? { Name: 'Molino', GenericName: 'Suite ofimática', 'GenericName[en]': 'Office suite', Keywords: 'oficina;documentos;pdf;office;' }
        : { Name: productName, GenericName: 'Visor y editor de PDF', 'GenericName[en]': 'PDF viewer and editor', Keywords: 'pdf;firmar;formulario;sign;form;' }
    },
    vendor: 'CuevasTech',
    maintainer: 'CuevasTech <info@molinosuite.org>',
    artifactName: `${executableName}-\${version}-\${arch}.\${ext}`
  },
  deb: {
    ...scripts,
    packageName: executableName,
    // Las de electron-builder y lo que Electron necesita y un sistema mínimo no
    // trae (el sonido y la memoria gráfica).
    depends: [
      'libgtk-3-0', 'libnotify4', 'libnss3', 'libxss1', 'libxtst6', 'xdg-utils', 'libatspi2.0-0', 'libuuid1', 'libsecret-1-0',
      'libasound2t64 | libasound2', 'libgbm1', 'libdrm2', 'libxkbcommon0'
    ],
    // Lo que usa si está: la primera capa del aislamiento del motor, el escáner
    // (también los de red), la impresora predeterminada y las fuentes con las
    // medidas de las de Microsoft.
    recommends: ['bubblewrap', 'sane-utils', 'sane-airscan', 'cups-client', 'fonts-liberation', 'fonts-crosextra-carlito', 'fonts-crosextra-caladea'],
    fpm,
    artifactName: `${executableName}_\${version}_\${arch}.\${ext}`
  },
  rpm: {
    ...scripts,
    packageName: executableName,
    // Las de electron-builder y bubblewrap, la primera capa del aislamiento del motor
    // (Fedora y openSUSE lo traen; rpm no tiene «recomendados» con fpm).
    depends: ['gtk3', 'libnotify', 'nss', 'libXScrnSaver', '(libXtst or libXtst6)', 'xdg-utils', 'at-spi2-core', '(libuuid or libuuid1)', 'bubblewrap'],
    fpm,
    artifactName: `${executableName}-\${version}.\${arch}.\${ext}`
  },
  appImage: { artifactName: `${executableName}-\${version}-\${arch}.\${ext}` },
  // AppRun nuevo: solo apaga el aislamiento de Chromium si el sistema no deja usarlo.
  toolsets: { appimage: '1.0.3' },
  // Los yml de la actualización automática (los paquetes van en GitHub Releases).
  publish: { provider: 'generic', url: `https://molinosuite.org/linux/${product}` }
}
delete config.win
delete config.appx
if (!base.extraResources.some((r) => r.from === 'dist-engine/molino-engine' && r.to === 'engine')) fail('electron-builder.yml ya no copia el motor a resources/engine')
// El motor, tal cual: PyInstaller deja en Linux enlaces simbólicos entre sus
// bibliotecas (pillow.libs, numpy.libs…) que electron-builder no copia bien, y
// cambiarlos por copias lo haría 150 MB más grande. Se copia antes de armar los
// paquetes, con los enlaces (todos relativos y dentro del motor).
config.afterPack = async (context) => {
  const target = join(context.appOutDir, 'resources', 'engine')
  rmSync(target, { recursive: true, force: true }) // el de una vez anterior
  cpSync(join(root, 'dist-engine', 'molino-engine'), target, { recursive: true, verbatimSymlinks: true })
}

const { build, Platform, Arch } = require('electron-builder')
await build({ targets: Platform.LINUX.createTarget(targets, arch === 'arm64' ? Arch.arm64 : Arch.x64), config, publish: 'never' })

const out = join(root, 'dist-linux', product)
for (const name of readdirSync(out).filter((n) => /\.(deb|rpm|AppImage|yml)$/.test(n))) {
  console.log(`${relative(root, join(out, name))} (${(statSync(join(out, name)).size / 1e6).toFixed(0)} MB)`)
}

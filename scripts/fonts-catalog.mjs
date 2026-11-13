// Catálogo de fuentes libres para «Fuentes que faltan»: node scripts/fonts-catalog.mjs [revisión]
//
// Lee de GitHub, en una sola consulta, el árbol de google/fonts en una revisión
// fija y escribe src/main/fonts-catalog.json: cada familia (por su carpeta, que
// es su nombre en minúsculas y sin espacios), su licencia y sus archivos con
// tamaño y la huella con la que Git guarda cada uno (SHA-1 de «blob <tamaño>\0
// <contenido>»). Molino descarga un archivo solo de esa revisión y lo da por
// bueno solo si su tamaño y su huella coinciden (src/main/fontcatalog.ts). Nada
// del catálogo viene de fuera al usarlo: va dentro de Molino.
//
// De cada familia se toman las fuentes fijas (carpeta static/) si las hay, que
// el conversor de los editores trata mejor que las variables; si no, las de la
// carpeta de la familia. Solo TTF y OTF.
import { writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')

const REPO = 'google/fonts'
const LICENSES = { ofl: 'OFL.txt', apache: 'LICENSE.txt', ufl: 'UFL.txt' }

async function github(path) {
  const response = await fetch(`https://api.github.com/repos/${REPO}/${path}`, {
    headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'molino-fonts-catalog' }
  })
  if (!response.ok) throw new Error(`GitHub ${response.status} en ${path}`)
  return response.json()
}

const commit = process.argv[2] ?? (await github('commits/main')).sha
if (!/^[0-9a-f]{40}$/.test(commit)) throw new Error('revisión no válida')
const tree = await github(`git/trees/${commit}?recursive=1`)
if (tree.truncated) throw new Error('el árbol llega cortado')

const byFamily = new Map()
for (const entry of tree.tree) {
  if (entry.type !== 'blob') continue
  const parts = entry.path.split('/')
  if (!(parts[0] in LICENSES) || parts.length < 3) continue
  const key = `${parts[0]}/${parts[1]}`
  if (!byFamily.has(key)) byFamily.set(key, { license: parts[0], dir: key, root: [], static: [], licenseFile: null })
  const family = byFamily.get(key)
  const rest = parts.slice(2).join('/')
  if (rest === LICENSES[parts[0]]) family.licenseFile = [rest, entry.size, entry.sha]
  if (!/\.(ttf|otf)$/i.test(rest) || !/^(static\/)?[A-Za-z0-9_\-[\],.]+$/.test(rest)) continue
  ;(rest.startsWith('static/') ? family.static : family.root).push([rest, entry.size, entry.sha])
}

const families = {}
for (const family of byFamily.values()) {
  const files = family.static.length ? family.static : family.root
  if (!files.length || !family.licenseFile) continue
  const name = family.dir.split('/')[1]
  // Si una familia está con dos licencias (no debería), se queda la OFL.
  if (families[name] && families[name].license === 'ofl') continue
  families[name] = { dir: family.dir, license: family.license, licenseFile: family.licenseFile, files: files.sort((a, b) => a[0].localeCompare(b[0])) }
}

const catalog = { v: 1, repo: REPO, commit, families }
const target = join(root, 'src', 'main', 'fonts-catalog.json')
writeFileSync(target, `${JSON.stringify(catalog)}\n`)
const count = Object.values(families).reduce((n, f) => n + f.files.length, 0)
console.log(`${Object.keys(families).length} familias, ${count} archivos; revisión ${commit}`)
console.log(target)

import { join } from 'node:path'
import type { EngineClient } from './engine'
import { log } from './log'
import { type OfficePiece, pieceVersion } from './office'
import { cleanFontIndex, fontFingerprint, fontFolders, loadFontIndex, ownFontsDir, saveFontIndex } from './officefonts'

/** Lo que queda listo para abrir documentos de oficina: la pieza y su índice de fuentes. */
export interface OfficeSetup {
  piece: string
  allFonts: string
  listed: Set<string>
  /** Las familias del índice, en minúsculas. */
  families: Set<string>
  folders: string[]
}

/**
 * Configura el motor con la pieza de oficina y su índice de fuentes (lo crea
 * si hace falta). null si este Molino no trae la pieza (Molino PDF). Lo usan
 * las ventanas de Documentos, Hojas y Presentaciones (officewin.ts) y la línea
 * de órdenes (cli.ts). Puede lanzar si el motor falla.
 */
export async function configureOffice(engine: EngineClient, piece: OfficePiece): Promise<OfficeSetup | null> {
  const dir = await piece.ready()
  if (!dir) {
    await engine.request('office.configure', {}, { priority: 9 })
    return null
  }
  const version = pieceVersion()
  const own = ownFontsDir(piece.root)
  const fingerprint = await fontFingerprint(version, own)
  let index = await loadFontIndex(piece.root, fingerprint)
  if (!index) {
    await engine.request('office.configure', { piece: version }, { priority: 9 })
    const { result, binary } = await engine.request<{ allFonts?: unknown }>('office.fonts', {}, { priority: 9 })
    index = cleanFontIndex(typeof result.allFonts === 'string' ? result.allFonts : '')
    if (!binary?.length) throw new Error('índice de fuentes sin font_selection.bin')
    await saveFontIndex(piece.root, fingerprint, index.text, binary)
    log.info(`oficina: índice de fuentes creado (${index.files.length} archivos)`)
  }
  await engine.request('office.configure', { piece: version, fonts: fingerprint }, { priority: 9 })
  return {
    piece: dir,
    allFonts: index.text,
    listed: new Set(index.files.map((f) => f.toLowerCase())),
    families: new Set(index.families.map((f) => f.toLowerCase())),
    folders: [...fontFolders(own), join(dir, 'fonts')]
  }
}

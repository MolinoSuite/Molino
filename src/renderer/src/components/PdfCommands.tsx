import { L } from '@/i18n'
import { viewerOf } from '@/lib/viewerControl'
import { closeDoc, imagesToPdf, mergeFiles, newBlank, openWithDialog, redo, saveDoc, saveDocAs, setMode, setTool, undo } from '@/state/actions'
import { type DocView, type Mode, useApp } from '@/state/app'
import { printDoc } from '@/state/print'
import { openSearch } from '@/state/search'
import { CommandPalette, type PaletteItem } from './CommandPalette'
import { registerDialog } from './Dialogs'
import { openScan } from './ScanDialog'

/**
 * «¿Qué quieres hacer?» en Molino PDF: todas sus funciones (abrir y crear,
 * cada modo con sus herramientas, «Más herramientas», páginas y ayuda) en el
 * buscador común (CommandPalette.tsx). Se abre con Alt+Q o desde la barra de título.
 */

interface PdfCommand extends PaletteItem {
  run: () => void
}

const C = L.shell.commands
const G = C.groups
const K = C.keywords

function commands(doc: DocView | undefined, aiOn: boolean): PdfCommand[] {
  const state = useApp.getState()
  const out: PdfCommand[] = []
  const add = (key: string, label: string, group: string, keywords: string, run: () => void): void => {
    out.push({ key, label, group, keywords, run })
  }
  const T = L.shell.titleBar
  add('open', T.create.open, G.file, K.open, () => void openWithDialog())
  add('blank', T.create.blank, G.file, K.blank, () => void newBlank())
  add('merge', T.create.merge, G.file, K.merge, () => void mergeFiles())
  add('images', T.create.images, G.file, K.images, () => void imagesToPdf())
  add('scan', T.create.scan, G.file, K.scan, openScan)

  if (doc) {
    const id = doc.id
    const go = (mode: Mode, tool?: string) => (): void => {
      setMode(id, mode)
      if (tool) setTool(id, tool)
    }
    const dialog = (dialogId: string) => (): void => {
      setMode(id, 'tools')
      state.openDialog({ type: 'custom', id: dialogId, doc: id })
    }
    add('save', L.common.save, G.file, K.save, () => void saveDoc(id))
    add('saveAs', L.common.saveAs, G.file, K.saveAs, () => void saveDocAs(id))
    add('print', T.menu.print, G.file, K.print, () => void printDoc(id))
    add('properties', T.menu.properties, G.file, K.properties, () => state.openDialog({ type: 'properties', doc: id }))
    if (doc.state.path) add('folder', T.menu.showInFolder, G.file, K.showInFolder, () => void window.molino.files.showInFolder(id))
    add('close', C.labels.close, G.file, K.close, () => void closeDoc(id))

    add('find', C.labels.find, G.view, K.find, () => openSearch(id))
    add('undo', C.labels.undo, G.view, K.undo, () => void undo(id))
    add('redo', C.labels.redo, G.view, K.redo, () => void redo(id))
    add('zoomIn', C.labels.zoomIn, G.view, K.zoom, () => viewerOf(id)?.zoomStep(1))
    add('zoomOut', C.labels.zoomOut, G.view, K.zoom, () => viewerOf(id)?.zoomStep(-1))
    add('fitWidth', C.labels.fitWidth, G.view, K.zoom, () => state.patchDoc(id, { zoom: { kind: 'fit-width', scale: doc.zoom.scale } }))

    const R = L.shell.rail
    for (const mode of ['view', 'edit', 'annotate', 'form', 'sign', 'pages', 'tools'] as const) {
      add(`mode:${mode}`, R[mode].label, G.modes, R[mode].hint, go(mode))
    }
    if (aiOn) add('mode:ai', L.ai.rail.label, G.modes, `${L.ai.rail.hint} ${K.ai}`, go('ai'))

    const A = L.annotate.tools
    add('highlight', A.highlight, G.annotate, K.highlight, go('annotate', 'highlight'))
    add('underline', A.underline, G.annotate, K.underline, go('annotate', 'underline'))
    add('strikeout', A.strikeout, G.annotate, K.strikeout, go('annotate', 'strikeout'))
    add('note', A.note, G.annotate, K.note, go('annotate', 'note'))
    add('ink', A.ink, G.annotate, K.ink, go('annotate', 'ink'))
    add('a-rect', L.modes.shapes.rect, G.annotate, K.shape, go('annotate', 'a-rect'))
    add('a-ellipse', L.modes.shapes.ellipse, G.annotate, K.shape, go('annotate', 'a-ellipse'))
    add('a-line', L.modes.shapes.line, G.annotate, K.shape, go('annotate', 'a-line'))
    add('a-arrow', A.arrow, G.annotate, K.shape, go('annotate', 'a-arrow'))

    const E = L.edit.tools
    add('e-text', E.textTip, G.edit, K.text, go('edit', 'text'))
    add('e-image', E.imageTip, G.edit, K.image, go('edit'))
    add('e-whiteout', E.whiteoutTip, G.edit, K.whiteout, go('edit', 'whiteout'))
    add('e-content', E.content, G.edit, K.content, go('edit', 'edit-content'))
    add('e-rect', `${L.modes.shapes.rect} · ${E.shapeTip}`, G.edit, K.shape, go('edit', 'rect'))
    add('e-ellipse', `${L.modes.shapes.ellipse} · ${E.shapeTip}`, G.edit, K.shape, go('edit', 'ellipse'))
    add('e-line', `${L.modes.shapes.line} · ${E.shapeTip}`, G.edit, K.shape, go('edit', 'line'))

    add('fill', C.labels.fillForm, G.form, K.field, go('form'))
    add('design', C.labels.designForm, G.form, K.field, go('form', 'design'))
    const F = L.form.create
    add('f-text', F.text.label, G.form, K.field, go('form', 'f-text'))
    add('f-check', F.checkbox.label, G.form, K.field, go('form', 'f-check'))
    add('f-radio', F.radio.label, G.form, K.field, go('form', 'f-radio'))
    add('f-combo', F.combo.label, G.form, K.field, go('form', 'f-combo'))
    add('f-list', F.list.label, G.form, K.field, go('form', 'f-list'))
    add('f-sign', F.signature.label, G.form, `${K.field} ${K.signature}`, go('form', 'f-sign'))

    const S = L.sign.tools
    add('s-signature', S.signatureTip, G.sign, K.signature, go('sign', 'sig-place'))
    add('s-text', S.textTip, G.sign, K.fillText, go('sign', 'fill-text'))
    add('s-check', S.check, G.sign, K.check, go('sign', 'check'))
    add('s-cross', S.cross, G.sign, K.cross, go('sign', 'cross'))
    add('s-date', S.date, G.sign, K.date, go('sign', 'date'))
    add('s-cert', S.certTip, G.sign, K.cert, go('sign', 'cert-rect'))
    add('s-verify', S.signaturesTip, G.sign, K.verify, go('sign'))

    const P = C.labels
    add('p-rotate', P.rotatePages, G.pages, K.pages, go('pages'))
    add('p-delete', P.deletePages, G.pages, K.pages, go('pages'))
    add('p-insert', P.insertPages, G.pages, K.pages, go('pages'))
    add('p-extract', P.extractPages, G.pages, K.pages, go('pages'))
    add('p-split', P.splitPdf, G.pages, K.pages, go('pages'))
    add('p-reorder', P.reorderPages, G.pages, K.pages, go('pages'))
    add('p-duplicate', P.duplicatePages, G.pages, K.pages, go('pages'))

    const X = L.tools
    add('t-ocr', X.ocr.title, G.tools, K.ocr, dialog('ocr'))
    add('t-redact', X.redact.title, G.tools, K.redact, go('tools', 'redact'))
    add('t-sanitize', X.sanitize.title, G.tools, K.sanitize, dialog('sanitize'))
    add('t-protect', X.protect.title, G.tools, K.protect, dialog('protect'))
    add('t-unprotect', X.unprotect.title, G.tools, K.unprotect, go('tools'))
    add('t-optimize', X.optimize.title, G.tools, K.optimize, dialog('optimize'))
    add('t-images', X.images.title, G.tools, K.exportImages, dialog('images'))
    add('t-word', X.word.title, G.tools, K.word, go('tools'))
    add('t-text', X.text.title, G.tools, K.exportText, go('tools'))
    add('t-crop', X.crop.title, G.tools, K.crop, go('tools', 'crop'))
    add('t-watermark', X.watermark.title, G.tools, K.watermark, dialog('watermark'))
    add('t-headerFooter', X.headerFooter.title, G.tools, K.headerFooter, dialog('headerFooter'))
    add('t-pageNumbers', X.pageNumbers.title, G.tools, K.pageNumbers, dialog('pageNumbers'))
    add('t-removeAdded', X.removeAdded.title, G.tools, K.removeAdded, dialog('removeAdded'))
    add('t-flatten', X.flatten.title, G.tools, K.flatten, go('tools'))
  }

  const M = L.shell.titleBar.menu
  add('settings', M.settings, G.help, K.settings, () => state.openDialog({ type: 'settings' }))
  add('shortcuts', M.shortcuts, G.help, K.shortcuts, () => state.openDialog({ type: 'shortcuts' }))
  add('feedback', M.feedback, G.help, K.feedback, () => state.openDialog({ type: 'custom', id: 'feedback' }))
  add('sponsor', M.sponsor, G.help, K.sponsor, () => void window.molino.about.open('sponsors'))
  add('about', M.about, G.help, K.about, () => state.openDialog({ type: 'about' }))
  return out
}

/** Abre el buscador de órdenes (Alt+Q o el botón de la barra de título). */
export function openCommands(): void {
  useApp.getState().openDialog({ type: 'custom', id: 'commands' })
}

function PdfPalette() {
  const close = useApp((s) => s.closeDialog)
  const doc = useApp((s) => (s.active ? s.docs[s.active] : undefined))
  const aiOn = useApp((s) => s.settings.aiTier !== 'off')
  return <CommandPalette entries={commands(doc, aiOn)} onChoose={(entry) => entry.run()} onClose={close} />
}

registerDialog('commands', PdfPalette)

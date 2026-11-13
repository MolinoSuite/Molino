import type { home as es } from '../es/home'

/** «Molino», the suite's shared home (renderer/src/home). */
export const home: typeof es = {
  pdfApart: {
    title: 'Molino PDF is already inside Molino Suite',
    text: 'You had the Molino PDF app installed separately. Molino Suite already includes it and has brought your settings, recent files, signatures and AI. Uninstall the other one so you don’t have two “Molino PDF” entries in the Start menu.',
    textSeparate: 'You had the Molino PDF app installed separately. Molino Suite already includes it: uninstall the other one so you don’t have two “Molino PDF” entries in the Start menu.',
    remove: 'Uninstall the other one',
    removing: 'Uninstalling…',
    later: 'Not now',
    removed: 'Done: only the Molino PDF inside Molino Suite is left.',
    running: 'Close the separate Molino PDF app and click “Uninstall the other one” again.',
    retired: 'Molino PDF is now part of Molino Suite: we brought over your settings and removed the separate app.',
    settings: 'Windows Settings is open: press “Uninstall” on the Molino PDF page.'
  },
  title: 'What shall we do today?',
  search: 'Search your recent files',
  clearSearch: 'Clear search',
  sections: 'Sections',
  open: 'Open a file…',
  apps: 'The apps',
  names: { word: 'Docs', cell: 'Sheets', slide: 'Slides', pdf: 'PDF' },
  create: 'Create something new',
  cards: {
    word: { title: 'Document', sub: 'Letters, reports, essays' },
    cell: { title: 'Spreadsheet', sub: 'Budgets, lists, tables' },
    slide: { title: 'Presentation', sub: 'To share an idea' },
    pdf: { title: 'Open a PDF', sub: 'Fill in, sign, organize' }
  },
  recent: 'Recent',
  noRecent: 'The files you open, in every app, will appear here.',
  noMatch: 'No recent file matches “{query}”.',
  remove: 'Remove “{name}” from recent files'
}

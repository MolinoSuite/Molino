import type { home as es } from '../es/home'

/** «Molino», the suite's shared home (renderer/src/home). */
export const home: typeof es = {
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

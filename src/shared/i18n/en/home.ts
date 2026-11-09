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
  local: {
    title: 'All on your computer',
    text: 'Your files aren’t uploaded anywhere. You don’t even need the Internet.'
  },
  create: 'Create something new',
  cards: {
    word: { title: 'Document', sub: 'Letters, reports, essays' },
    cell: { title: 'Spreadsheet', sub: 'Budgets, lists, tables' },
    slide: { title: 'Presentation', sub: 'To share an idea' },
    pdf: { title: 'Open a PDF', sub: 'Fill in, sign, organize' }
  },
  addApps: 'To write documents, work with numbers or make presentations, add Docs, Sheets and Slides from Molino PDF: Settings → Apps.',
  recent: 'Recent',
  noRecent: 'The files you open, in every app, will appear here.',
  noMatch: 'No recent file matches “{query}”.',
  remove: 'Remove “{name}” from recent files'
}

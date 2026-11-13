import type { officeWord as source } from '../es/officeWord'

export const officeWord: typeof source = {
  groups: {
    toc: 'Table of contents',
    references: 'Captions and references',
    headerFooter: 'Options and fields',
    chart: 'Chart',
    tableStyle: 'Table style',
    language: 'Language',
    compare: 'Compare',
    hfOptions: 'Options',
    hfGo: 'Go to',
    hfInsert: 'Insert',
    hfClose: 'Close',
    chartType: 'Type',
    chartTitle: 'Title',
    mailMerge: 'Mailings'
  },

  keywords: {
    updateFields: 'update fields date page references',
    docLang: 'language proofing spelling document',
    bookmarks: 'bookmark bookmarks go to',
    navigation: 'navigation headings outline pane'
  },

  toc: {
    update: 'Update table',
    all: 'Entire table',
    pages: 'Page numbers only',
    remove: 'Remove table',
    missing: 'The document has no table of contents.'
  },
  nav: {
    button: 'Navigation',
    title: 'Navigation',
    empty: 'No headings. Paragraphs with the “Heading 1”, “Heading 2”… styles show up here.',
    beginning: 'Beginning of document'
  },

  hf: {
    tab: 'Header & footer',
    options: 'Header options',
    first: 'Different first page',
    oddEven: 'Different odd & even pages',
    link: 'Link to previous section',
    removeHeader: 'Remove header',
    removeFooter: 'Remove footer',
    close: 'Close',
    goHeader: 'Go to header',
    goFooter: 'Go to footer'
  },

  fields: {
    menu: 'Fields',
    pageOfPages: 'Page X of Y (in the footer)',
    page: 'Page number',
    pages: 'Number of pages',
    date: 'Date',
    dateLong: 'Long date',
    time: 'Time',
    update: 'Update fields',
    pageWord: 'Page ',
    ofWord: ' of '
  },

  tableStyles: {
    menu: 'Table styles',
    shading: 'Shading',
    loading: 'Preparing styles…',
    plain: 'Plain',
    grid: 'Grid',
    list: 'List',
    lined: 'Bordered and lined',
    custom: 'From the document',
    other: 'Other',
    names: {
      'Table Grid': 'Table Grid',
      'Plain Table': 'Plain Table',
      'Grid Table': 'Grid Table',
      'List Table': 'List Table',
      Light: 'Light',
      Dark: 'Dark',
      Colorful: 'Colorful',
      Accent: 'Accent',
      'Bordered & Lined': 'Bordered & Lined',
      Bordered: 'Bordered',
      Lined: 'Lined'
    }
  },

  bookmarks: {
    button: 'Bookmark',
    title: 'Bookmarks',
    name: 'Bookmark name',
    nameHint: 'Starts with a letter; letters, numbers and “_” only, no spaces.',
    add: 'Add',
    go: 'Go to',
    remove: 'Delete',
    list: 'Bookmarks in the document',
    empty: 'No bookmarks yet.',
    invalid: 'That name can’t be used for a bookmark.',
    exists: 'There is already a bookmark with that name: “Add” moves it here.'
  },
  crossRef: {
    button: 'Cross-reference',
    title: 'Insert a cross-reference',
    type: 'Reference type',
    types: { heading: 'Heading', bookmark: 'Bookmark', footnote: 'Footnote', endnote: 'Endnote', caption: 'Table or figure caption' },
    label: 'Label',
    insert: 'Insert',
    what: 'Insert reference to',
    refs: {
      text: 'Text',
      page: 'Page number',
      number: 'Number',
      noteNumber: 'Note number',
      aboveBelow: '“above” or “below”',
      labelNumber: 'Only label and number',
      captionText: 'Only caption text'
    },
    link: 'Insert as hyperlink (Ctrl+click goes there)',
    which: 'For which',
    empty: 'There is nothing of this type in the document.'
  },
  caption: {
    button: 'Insert caption',
    title: 'Insert a caption',
    intro: 'Captions are numbered automatically (“Table 1”, “Table 2”…) and can be used in cross-references.',
    label: 'Label',
    labels: { table: 'Table', figure: 'Figure', equation: 'Equation' },
    text: 'Text (optional)',
    position: 'Position',
    above: 'Above',
    below: 'Below'
  },

  lang: {
    menu: 'Language',
    selection: 'Selected text',
    documentAsk: 'Document language…',
    documentTitle: 'Document language',
    documentIntro: 'The spelling checker checks all the text in this language (including what is already written).',
    language: 'Language',
    names: {
      'es-ES': 'Spanish (Spain)',
      'ca-ES': 'Catalan',
      'ca-ES-valencia': 'Valencian',
      'gl-ES': 'Galician',
      'eu-ES': 'Basque',
      'en-GB': 'English (United Kingdom)',
      'en-US': 'English (United States)',
      'fr-FR': 'French',
      'pt-PT': 'Portuguese (Portugal)',
      'pt-BR': 'Portuguese (Brazil)',
      'de-DE': 'German',
      'it-IT': 'Italian'
    }
  },

  compare: {
    menu: 'Compare',
    compare: 'Compare with another document…',
    combine: 'Combine with another document…',
    compareTitle: 'Compare documents',
    combineTitle: 'Combine documents',
    compareIntro: 'The differences in the other document show up here as tracked changes, to accept or reject.',
    combineIntro: 'The tracked changes and comments of the other document are merged with this one’s.',
    other: 'The other document',
    otherHint: 'Open it first in Documents (Ctrl+O): it shows up in this list.',
    none: 'No other document is open. Open it in Documents (Ctrl+O) and come back.',
    words: 'Compare whole words (otherwise, character by character)',
    go: 'Compare',
    goCombine: 'Combine',
    failed: 'The other document could not be read.'
  },

  chart: {
    insert: 'Chart',
    types: { column: 'Column', bar: 'Bar', line: 'Line', pie: 'Pie', area: 'Area', doughnut: 'Doughnut' },
    tab: 'Chart',
    type: 'Chart type',
    title: 'Title',
    titleAsk: 'Chart title',
    titleLabel: 'Title',
    legend: 'Legend',
    legends: { bottom: 'Bottom', right: 'Right', top: 'Top', none: 'No legend' },
    sample: {
      title: 'Chart title',
      series: ['Series 1', 'Series 2', 'Series 3'],
      categories: ['Category 1', 'Category 2', 'Category 3', 'Category 4']
    }
  },

  mailMerge: {
    button: 'Mail merge',
    title: 'Mail merge',
    intro: 'Write the letter once and Documents fills each copy with one row of the list (a CSV with the column names in the first row).',
    pick: 'Choose the list (CSV)…',
    paste: 'Or paste the list here',
    pasteHint: 'One row per line, separated by “;”, “,” or tabs; the first one with the names.',
    use: 'Use this list',
    rows: '{n} rows',
    fields: 'Fields: click one to insert it at the cursor',
    preview: 'Preview results',
    previewOff: 'Show fields',
    highlight: 'Highlight fields',
    record: 'Row {n} of {total}',
    prev: 'Previous',
    next: 'Next',
    finish: 'Creating the copies (one per row) needs Molino to save the merged document: not available yet.',
    bad: 'The list could not be read: it needs a row of names and at least one row of data.',
    tooBig: 'The list is too big (at most {n} rows).'
  }
}

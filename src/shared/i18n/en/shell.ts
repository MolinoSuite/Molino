import type { shell as source } from '../es/shell'

export const shell: typeof source = {
  percent: '{n}%',
  dismiss: 'Dismiss',
  app: {
    dropToOpen: 'Drop to open'
  },
  commands: {
    button: 'What do you want to do?',
    placeholder: 'Type what you want to do: “create a table”, “add a photo”…',
    empty: 'Nothing found. Try other words.',
    groups: {
      file: 'File',
      view: 'View',
      modes: 'Go to',
      annotate: 'Annotate',
      edit: 'Edit',
      form: 'Forms',
      sign: 'Sign',
      pages: 'Pages',
      tools: 'Tools',
      help: 'Help'
    },
    labels: {
      find: 'Find in the document',
      close: 'Close the document',
      undo: 'Undo',
      redo: 'Redo',
      zoomIn: 'Zoom in',
      zoomOut: 'Zoom out',
      fitWidth: 'Fit width',
      rotatePages: 'Rotate pages',
      deletePages: 'Delete pages',
      insertPages: 'Insert pages',
      extractPages: 'Extract pages to a new PDF',
      splitPdf: 'Split the PDF',
      reorderPages: 'Reorder pages',
      duplicatePages: 'Duplicate pages',
      fillForm: 'Fill in the form',
      designForm: 'Design the form',
      exportFormData: 'Export the form data'
    },
    keywords: {
      open: 'open file document pdf load',
      blank: 'new blank empty pdf document',
      merge: 'merge combine join several pdf files',
      images: 'images photos jpg png convert to pdf',
      scan: 'scan scanner paper',
      save: 'save changes',
      saveAs: 'save as copy another name',
      print: 'print printer paper',
      properties: 'properties title author information',
      showInFolder: 'folder explorer where',
      find: 'find search word text',
      close: 'close tab',
      undo: 'undo back',
      redo: 'redo',
      zoom: 'zoom size view',
      highlight: 'highlight marker colour text',
      underline: 'underline text line',
      strikeout: 'strike strikethrough text',
      note: 'note comment sticky',
      ink: 'draw pen freehand',
      shape: 'shape figure draw',
      text: 'text write add box',
      image: 'image photo logo insert picture',
      whiteout: 'white out cover hide erase',
      content: 'edit change existing text modify fix',
      field: 'field form fillable create',
      formData: 'export form data json csv spreadsheet',
      signature: 'signature handwritten sign',
      fillText: 'text write fill',
      check: 'check tick box',
      cross: 'cross x',
      date: 'date today',
      cert: 'digital signature certificate electronic',
      verify: 'verify check valid signatures',
      pages: 'pages organize',
      ocr: 'ocr recognize text scanned search copy',
      redact: 'redact hide private data remove',
      sanitize: 'sanitize clean metadata hidden privacy',
      protect: 'protect password encrypt',
      unprotect: 'remove password unprotect',
      optimize: 'compress reduce size optimize',
      exportImages: 'export images jpg png',
      word: 'export convert word docx editable',
      exportText: 'export text txt',
      crop: 'crop margins',
      watermark: 'watermark stamp confidential',
      headerFooter: 'header footer',
      pageNumbers: 'page numbers numbering',
      removeAdded: 'remove watermark header numbers',
      flatten: 'flatten annotations form',
      settings: 'settings preferences options theme dark',
      shortcuts: 'keyboard shortcuts',
      feedback: 'feedback suggestion bug error opinion',
      sponsor: 'coffee donate support',
      about: 'about version license',
      ai: 'ai artificial intelligence summarize ask assistant'
    }
  },
  titleBar: {
    unsaved: 'Unsaved changes',
    closeTab: 'Close {name}',
    openOrCreate: 'Open or create',
    isolation: {
      tip: 'Reduced protection',
      label: 'Reduced protection: the document engine isn’t isolated',
      warning:
        'Windows didn’t allow Molino PDF to isolate the engine that reads PDFs. Molino PDF works normally, but a malicious PDF would have more room to cause harm: only open documents you trust.'
    },
    undoAction: 'Undo: {action}',
    redoAction: 'Redo: {action}',
    save: 'Save (Ctrl+S)',
    noChanges: 'No unsaved changes',
    more: 'More',
    printTip: 'Print (Ctrl+P)',
    menuTip: 'Menu',
    create: {
      open: 'Open…',
      blank: 'Blank document…',
      merge: 'Combine files…',
      images: 'Images to PDF…',
      scan: 'Scan document…'
    },
    menu: {
      saveAsKbd: 'Ctrl+Shift+S',
      print: 'Print…',
      showInFolder: 'Show in folder',
      properties: 'Document properties',
      settings: 'Settings',
      shortcuts: 'Keyboard shortcuts',
      feedback: 'Send feedback…',
      sponsor: 'Buy me a coffee',
      about: 'About Molino PDF'
    }
  },
  rail: {
    label: 'Modes',
    settings: 'Settings',
    view: { label: 'View', hint: 'Read, search, and copy' },
    edit: { label: 'Edit', hint: 'Text, images, and content' },
    annotate: { label: 'Annotate', hint: 'Highlight, notes, and drawing' },
    form: { label: 'Form', hint: 'Fill in and prepare fields' },
    sign: { label: 'Sign', hint: 'Handwritten and certificate signatures' },
    pages: { label: 'Pages', hint: 'Reorder, rotate, insert, and extract' },
    tools: { label: 'More', hint: 'OCR, protect, compress, convert…' }
  },
  toolbar: {
    label: 'Tools',
    select: 'Select',
    selectTip: 'Select and copy text',
    hand: 'Hand',
    handTip: 'Drag to scroll',
    search: 'Search',
    searchTip: 'Search (Ctrl+F)'
  },
  findBar: {
    placeholder: 'Search in document',
    searching: 'Searching…',
    noResults: 'No results',
    count: '{n} of {total}',
    countMore: '{n} of {total}+',
    matchCase: 'Match case',
    wholeWord: 'Whole words',
    previous: 'Previous',
    next: 'Next'
  },
  dock: {
    sidePanel: 'Sidebar',
    previousPage: 'Previous page',
    nextPage: 'Next page',
    ofTotal: 'of {total}',
    zoomOut: 'Zoom out',
    zoomIn: 'Zoom in',
    fitWidth: 'Fit width',
    fitPage: 'Fit page'
  },
  sidePanel: {
    outline: 'Bookmarks',
    noOutline: 'This document has no bookmarks.'
  },
  banner: {
    locked: 'This document is signed and locked: it can be viewed, printed, and exported, but not changed.',
    lockedForm: 'This document is signed: the signer only allows filling in the form and signing.',
    lockedComments: 'This document is signed: the signer only allows filling in, signing, and adding comments.',
    signed: 'This document is digitally signed.',
    invalidated: 'This document had digital signatures that the changes have invalidated.',
    restricted: 'The author of this PDF has restricted what can be done with it.',
    viewSignatures: 'View signatures',
    unlock: 'Unlock'
  },
  busy: {
    working: 'Working…'
  },
  update: {
    available: 'A new version of {app} is available',
    availableVersion: 'A new version of {app} is available ({version})',
    hint: 'It updates from the Microsoft Store.',
    update: 'Update',
    notNow: 'Not now'
  },
  recovery: {
    title: 'Recover documents',
    discardAll: 'Discard all',
    later: 'Later',
    text: 'Molino PDF closed before saving the changes to these documents. You can recover them and save them wherever you like.',
    password: 'Document password',
    discard: 'Discard',
    recover: 'Recover'
  }
}

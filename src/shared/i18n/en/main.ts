import type { main as source } from '../es/main'

export const main: typeof source = {
  engine: {
    stopped: 'The document engine has stopped.',
    failed: 'Document engine error.',
    tooLarge: 'The request is too large.',
    cancelled: 'Operation canceled.'
  },
  errors: {
    unexpected: 'An unexpected error occurred.',
    forbiddenOrigin: 'Origin not allowed.',
    invalidParams: 'Invalid parameters.',
    noWindow: 'The window isn’t available.',
    docClosed: 'The document is no longer open.',
    forbiddenOperation: 'This operation isn’t allowed from the interface.',
    recentGone: 'That file is no longer in the recent list.',
    openExpired: 'The request to open the file has expired.',
    imageTooLarge: 'The image is too large.',
    mergeTwo: 'Choose at least two files to combine.',
    tooManyPhotos: 'Choose up to 100 photos at a time; you can add more later.',
    compressedSameName: 'Save the compressed copy with a different name to keep the original.',
    pickPfxAgain: 'Choose the certificate file again.',
    printNotAllowed: 'The author of this PDF doesn’t allow it to be printed.',
    pickFileAgain: 'Choose the file again.',
    noFormData: 'This document has no form fields to export.',
    writeFailed: 'Couldn’t save the file.'
  },
  dialogs: {
    savePdf: 'Save PDF',
    pickImage: 'Choose image',
    pickMerge: 'Choose the files to combine',
    pickImages: 'Choose images',
    pickPhotos: 'Choose the photos of the document',
    insertPages: 'Insert pages from another file',
    extractPages: 'Extract pages to a new PDF',
    filesFolder: 'Folder to save the files in',
    imagesFolder: 'Folder to save the images in',
    saveCompressed: 'Save compressed copy',
    exportText: 'Export to text',
    exportWord: 'Export to Word',
    pickPfx: 'Choose certificate file',
    exportFormData: 'Export form data'
  },
  filters: {
    pdfAndImages: 'PDFs and images',
    images: 'Images',
    photos: 'Photos and images',
    text: 'Text',
    certificate: 'Certificate'
  },
  fileNames: {
    extract: '{name}-extract.pdf',
    compressedSuffix: '-compressed',
    formData: '{name}-data'
  },
  link: {
    title: 'Open link',
    mail: 'Write an email to this address?',
    web: 'Open this link to {host} in the browser?'
  },
  feedback: {
    failed: 'Couldn’t send your feedback. Check your internet connection and try again.',
    viaGithub: 'Feedback is sent through GitHub.',
    wait: 'Wait a few seconds before sending more feedback.'
  },
  print: {
    cancelled: 'Printing canceled.',
    printerGone: 'That printer is no longer available. Choose another one.',
    noPages: 'There are no pages to print.',
    tooManySheets: 'That would be more than {max} sheets. Lower the enlargement or print fewer pages.',
    failed: 'Couldn’t print. Make sure the printer is on and connected, and try again.'
  },
  scanner: {
    testDevice: 'Test scanner',
    unnamed: 'Scanner',
    cancelled: 'Canceled.',
    failed: 'The scanner couldn’t scan. Make sure it’s on and try again.',
    notFound: 'That scanner is no longer available. Make sure it’s on and connected.',
    paperJam: 'The paper is jammed in the scanner.',
    noPaper: 'There’s no paper in the feeder.',
    paperProblem: 'There’s a problem with the paper in the scanner.',
    notResponding: 'The scanner isn’t responding. Make sure it’s on and connected.',
    busy: 'The scanner is busy. Wait a moment and try again.',
    warmingUp: 'The scanner is getting ready. Try again in a few seconds.',
    userAction: 'The scanner needs you to do something: check its screen.',
    noConnection: 'Can’t communicate with the scanner. Make sure it’s on and connected.',
    locked: 'The scanner is locked or another program is using it.',
    coverOpen: 'The scanner lid is open.',
    lampOff: 'The scanner lamp is off.'
  },
  office: {
    /** Presenter view in Slides (officepresenter.ts). */
    presenter: {
      title: 'Presenter view',
      screen: 'Display {n} · {width} × {height}',
      primary: 'Display {n} (main) · {width} × {height}',
      simulated: 'Display {n} (simulated)'
    },
    media: {
      pickVideo: 'Insert a video',
      pickAudio: 'Insert an audio file',
      videos: 'Videos',
      audios: 'Audio',
      tooBig: 'That file is too big (300 MB at most).'
    },
    password: {
      title: 'Password-protected document',
      message: '“{name}” is password-protected. Type the password to open it.',
      wrong: 'That isn’t the password for “{name}”. Try again.',
      label: 'Password',
      open: 'Open'
    },
    apps: { word: 'Molino Docs', cell: 'Molino Sheets', slide: 'Molino Slides' },
    notInstalled: 'Molino PDF only opens PDFs and images. Word, Excel and PowerPoint documents open with Molino Suite, which brings Docs, Sheets and Slides.',
    seeSuite: 'See Molino Suite in the Store',
    preparing: 'Docs, Sheets and Slides are getting ready. Try again in a moment.',
    openFailed: 'Couldn’t open “{name}”.',
    saveFailed: 'Couldn’t save “{name}”.',
    unsaved: 'Save the changes to “{name}”?',
    unsavedDetail: 'If you don’t save them, they’ll be lost.',
    save: 'Save',
    dontSave: 'Don’t save',
    cancel: 'Cancel',
    /** Nombre de los documentos nuevos hechos con una plantilla. */
    templates: {
      letter: 'Letter',
      resume: 'Resume',
      request: 'Request',
      authorization: 'Authorization',
      complaint: 'Complaint',
      withdrawal: 'Withdrawal',
      cancellation: 'Cancellation',
      services: 'Service agreement',
      invoice: 'Invoice',
      quote: 'Quote',
      ledger: 'Income and expenses',
      budget: 'Household budget',
      presentation: 'Presentation'
    },
    filters: { word: 'Document', cell: 'Spreadsheet', slide: 'Presentation', pdf: 'PDF', pdfa: 'PDF/A', images: 'Images' },
    /** «Firmar…»: dónde se guarda el PDF que se abre en Molino PDF para firmarlo. */
    signSave: 'Save the PDF to sign it',
    formats: {
      '.docx': 'Word document',
      '.odt': 'OpenDocument text',
      '.rtf': 'Rich text (RTF)',
      '.txt': 'Plain text',
      '.html': 'Web page',
      '.epub': 'E-book (EPUB)',
      '.xlsx': 'Excel workbook',
      '.ods': 'OpenDocument spreadsheet',
      '.csv': 'CSV (comma separated)',
      '.pptx': 'PowerPoint presentation',
      '.odp': 'OpenDocument presentation',
      '.ppsx': 'PowerPoint show'
    },
    recoveredName: '{stem} (recovered){suffix}',
    recentMissing: 'Can’t find “{name}”: it may have been moved or deleted. It’s been removed from your recent files.',
    merge: {
      folder: 'Folder for the copies',
      saveAll: 'Save all the copies',
      combinedName: '{stem} (merged)',
      exists: 'That folder already has {n} files with the same names.',
      existsOne: 'That folder already has a file with the same name.',
      existsDetail: 'For example: {names}',
      keep: 'Save with another name',
      replace: 'Replace'
    },
    compare: {
      pick: 'Choose the other document',
      failed: 'Couldn’t read “{name}”.'
    },
    descriptions: {
      word: 'Write and edit Word and OpenDocument documents.',
      cell: 'Work with numbers and tables in Excel and OpenDocument spreadsheets.',
      slide: 'Create and present PowerPoint and OpenDocument slides.'
    },
    fileTypes: { word: 'Document', cell: 'Spreadsheet', slide: 'Presentation' }
  },
  home: {
    description: 'All the Molino apps, what’s new and what’s recent.',
    allFiles: 'All files Molino opens'
  }
}

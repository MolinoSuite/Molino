import type { dialogs as source } from '../es/dialogs'

export const dialogs: typeof source = {
  password: {
    title: 'Protected document',
    message: '“{name}” needs a password to open.',
    label: 'Password',
    wrong: 'That password isn’t correct. Please try again.'
  },
  unlock: {
    title: 'This PDF has restrictions',
    message: 'Its author has limited what can be done with it. To modify it, enter the owner password.',
    label: 'Owner password',
    action: 'Unlock',
    wrong: 'That isn’t the owner password.'
  },
  settings: {
    title: 'Settings',
    done: 'Done',
    sections: 'Settings sections',
    tabs: {
      general: 'General',
      appearance: 'Appearance',
      apps: 'Apps',
      documents: 'Documents',
      signature: 'Signature'
    },
    language: {
      label: 'Language',
      auto: 'Automatic (same as Windows)',
      es: 'Español',
      en: 'English',
      hint: 'Takes effect the next time you open Molino PDF.'
    },
    theme: {
      label: 'Theme',
      system: 'System',
      light: 'Light',
      dark: 'Dark'
    },
    accent: {
      label: 'Accent color',
      color: 'Color {color}'
    },
    zoom: {
      label: 'Zoom when opening a document',
      fitWidth: 'Fit width',
      fitPage: 'Fit page',
      actual: '100%'
    },
    sidebarOpen: 'Show the pages panel when opening a document',
    highlightFields: 'Highlight form fields you can fill in',
    author: {
      label: 'Name for comments',
      hint: 'Saved as the author of the notes and annotations you add.'
    },
    signLevel: {
      label: 'Certificate signature type',
      hint: 'The one selected when you sign. You can change it for each signature, and Molino PDF remembers the last one you used.',
      basic: 'Basic',
      timestamp: 'With timestamp',
      longTerm: 'Long-term'
    },
    timestamp: {
      label: 'Timestamp service',
      hint: 'Certifies the date and time of your certificate signatures. It only receives a fingerprint of the signature, never the document.',
      urlPlaceholder: 'RFC 3161 address, for example https://…',
      urlLabel: 'Timestamp service address'
    },
    dateStyle: {
      label: '“Today’s date” format',
      hint: 'The date written by the “Today’s date” tool when you sign.'
    },
    defaultApp: {
      label: 'Default PDF app',
      isDefault: 'PDFs open with Molino PDF.',
      use: 'Use Molino PDF to open PDFs',
      confirmHint: 'Windows will ask you to confirm it in Settings.',
      ask: 'Suggest it when Molino PDF opens'
    },
    closeMany: {
      label: 'When closing with several files open',
      ask: 'Ask',
      all: 'Close all',
      current: 'Current only'
    },
    updates: {
      label: 'New versions',
      check: 'Let me know when Molino opens if a new version is available',
      checkNow: 'Check now',
      openStore: 'Update in the Store',
      store: 'New versions are installed from the Microsoft Store; Windows also does it on its own.',
      unavailable: 'This copy of Molino doesn’t check for new versions.',
      checking: 'Checking…',
      current: 'You have the latest version.',
      available: 'A new version is available.',
      availableVersion: 'A new version is available: {version}.'
    },
    apps: {
      title: 'Docs, Sheets and Slides',
      intro: 'They come with Molino Suite. With “Default…” you choose in Windows to open their files with a double click.',
      home: '“Molino”: the home with all the apps',
      names: { word: 'Molino Docs', cell: 'Molino Sheets', slide: 'Molino Slides' },
      open: 'Open',
      defaultApps: 'Default…',
      dictionary: 'Personal dictionary',
      dictionaryHint: 'The words you add with “Add to dictionary” while spellchecking: the spellchecker accepts them in all your documents.',
      dictionaryCount: '{n} words.',
      dictionaryOne: '1 word.',
      dictionaryEmpty: 'You haven’t added any yet.',
      dictionaryRemove: 'Remove “{word}” from the dictionary',
      defaultAppsTip: 'To open its files with a double click: opens the page for {name} in Windows “Default apps”.',
      basedOn: 'They use the ONLYOFFICE engine (AGPL-3.0) with Molino’s changes.'
    }
  },
  about: {
    title: 'About Molino PDF',
    tagline: 'Everything you need to do with a PDF, in one place.',
    built: 'Built on {date}',
    license:
      'Molino PDF is free software: you can redistribute it and modify it under the terms of the GNU Affero General Public License (AGPL), version 3 or later. It is provided WITHOUT ANY WARRANTY, not even the implied warranty of merchantability or fitness for a particular purpose.',
    licenseButton: 'License',
    source: 'Source code',
    notices: 'Third-party components',
    officeTitle: 'Docs, Sheets and Slides',
    officeText: 'They use a modified version of the ONLYOFFICE editors (AGPL-3.0, with the additional terms of its §7).',
    officeNotice: 'Molino’s changes',
    officeLicense: 'ONLYOFFICE license',
    officeSource: 'Engine source code',
    officeTrademark: 'ONLYOFFICE is a trademark of Ascensio System SIA. Molino is not affiliated with or endorsed by Ascensio System SIA.',
    support: 'Molino PDF is free and always will be. If you find it useful, you can buy me a coffee on GitHub Sponsors.',
    coffee: 'Buy me a coffee'
  },
  properties: {
    title: 'Document properties',
    saveChanges: 'Save changes',
    fields: {
      title: 'Title',
      author: 'Author',
      subject: 'Subject',
      keywords: 'Keywords'
    },
    rows: {
      file: 'File',
      size: 'Size',
      format: 'Format',
      created: 'Created',
      modified: 'Modified',
      creator: 'Application',
      producer: 'Produced with',
      protection: 'Protection',
      signatures: 'Digital signatures'
    },
    notSaved: 'Not saved yet',
    encrypted: 'Encrypted',
    notEncrypted: 'Not encrypted'
  },
  shortcuts: {
    title: 'Keyboard shortcuts',
    keys: {
      saveAs: 'Ctrl + Shift + S',
      wheel: 'Ctrl + mouse wheel',
      delete: 'Del',
      arrows: 'Arrow keys',
      escape: 'Esc'
    },
    saveAs: 'Save as',
    print: 'Print',
    closeDoc: 'Close the document',
    nextDoc: 'Next document',
    undoRedo: 'Undo / Redo',
    find: 'Find',
    zoom: 'Zoom in or out',
    fit: 'Fit width / 100%',
    deleteSelection: 'Delete the selection',
    moveSelection: 'Move the selection',
    escape: 'Exit the tool or clear the selection'
  }
}

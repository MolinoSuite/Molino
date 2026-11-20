import type { linux as source } from '../es/linux'

export const linux: typeof source = {
  shell: {
    titleBar: {
      isolation: {
        warning:
          'This computer didn’t allow Molino PDF to isolate the engine that reads PDFs (it needs bubblewrap or a kernel with Landlock). Molino PDF works normally, but a malicious PDF would have more room to cause harm: only open documents you trust.'
      }
    }
  },
  dialogs: {
    settings: {
      language: { auto: 'Automatic (same as the system)' },
      theme: { system: 'System' },
      author: {
        hint: 'It signs your PDF notes and the comments and changes in your documents. Empty: your user name on this computer.'
      }
    }
  },
  print: {
    moreSettingsTip: 'Opens the system print dialog (tray, quality…)'
  },
  scan: {
    scanner: {
      none: 'No scanner was found. Check that it is on and connected (if it is a network scanner, on the same network as this computer). Molino uses SANE: the sane-utils package and, for network scanners, sane-airscan.'
    }
  }
}

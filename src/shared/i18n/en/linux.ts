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
      },
      defaultApp: { confirmHint: 'It changes right away, for your user.' },
      apps: { defaultAppsTip: 'To open its files with a double click: makes {name} the default program for them.' }
    }
  },
  main: {
    office: { seeSuite: 'See Molino Suite on the website' }
  },
  cli: {
    noCertificates: 'You have no certificates that can sign, neither on a card or DNIe in the reader nor in Firefox.'
  },
  print: {
    moreSettingsTip: 'Opens the system print dialog (tray, quality…)'
  },
  scan: {
    scanner: {
      none: 'No scanner was found. Check that it is on and connected (if it is a network scanner, on the same network as this computer). Molino uses SANE: the sane-utils package and, for network scanners, sane-airscan.'
    }
  },
  sign: {
    saved: {
      privacy: 'Signatures are stored encrypted with your session keyring and never leave this computer. Without a keyring, they only last while Molino is open.'
    },
    cert: {
      none: 'No certificates to sign with were found, neither on a card or DNIe in the reader nor in Firefox. Cards and the DNIe need OpenSC and pcscd. You can also use a .pfx or .p12 file.'
    }
  }
}

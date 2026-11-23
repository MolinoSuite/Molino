import type { Messages, Overlay } from '../index'

/**
 * Lo que cambia en Linux: los textos que en Windows nombran Windows. Al abrir
 * Molino en Linux van encima de los de cada zona (i18n/index.ts); el resto es
 * igual. El inglés (en/linux.ts) tiene las mismas claves.
 */
export const linux = {
  shell: {
    titleBar: {
      isolation: {
        warning:
          'Este equipo no ha permitido aislar el motor que lee los PDF (hace falta bubblewrap o un núcleo con Landlock). Molino PDF funciona con normalidad, pero un PDF malicioso tendría más margen: abre solo documentos de confianza.'
      }
    }
  },
  dialogs: {
    settings: {
      language: { auto: 'Automático (como el sistema)' },
      theme: { system: 'Como el sistema' },
      author: {
        hint: 'Firma las notas de los PDF y los comentarios y cambios de los documentos. Vacío: el de tu usuario del equipo.'
      },
      defaultApp: { confirmHint: 'Se cambia al momento, para tu usuario.' },
      apps: { defaultAppsTip: 'Para abrir sus archivos con doble clic: hace de {name} el programa predeterminado para ellos.' }
    }
  },
  main: {
    office: { seeSuite: 'Ver Molino Suite en la web' }
  },
  cli: {
    noCertificates: 'No tienes certificados con los que firmar: ni en una tarjeta o DNIe metido en el lector, ni en Firefox.'
  },
  print: {
    moreSettingsTip: 'Abre el cuadro de impresión del sistema (bandeja, calidad…)'
  },
  scan: {
    scanner: {
      none: 'No se ha encontrado ningún escáner. Comprueba que está encendido y conectado (si es de red, en la misma red que este equipo). Molino usa SANE: los paquetes sane-utils y, para los de red, sane-airscan.'
    }
  },
  sign: {
    saved: {
      privacy: 'Las firmas se guardan cifradas con el llavero de tu sesión y no salen de este equipo. Sin llavero, solo duran mientras Molino está abierto.'
    },
    cert: {
      none: 'No se encuentran certificados con los que firmar, ni en una tarjeta o DNIe metido en el lector ni en Firefox. Para el DNIe y las tarjetas hacen falta OpenSC y pcscd. También puedes usar un archivo .pfx o .p12.'
    }
  }
} satisfies Overlay<Messages>

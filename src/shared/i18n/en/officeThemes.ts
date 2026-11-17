import type { officeThemes as source } from '../es/officeThemes'

/** Document themes (renderer/src/office/features/themes/). */
export const officeThemes: typeof source = {
  tools: {
    themes: 'Themes',
    variants: 'Variants',
    colors: 'Colors',
    fonts: 'Fonts'
  },
  groups: { themes: 'Themes' },
  builtIn: {
    'm-molino': 'Molino',
    'm-clasico': 'Classic',
    'm-moderno': 'Modern',
    'm-sobrio': 'Plain',
    'm-calido': 'Warm',
    'm-fresco': 'Fresh',
    'm-elegante': 'Elegant',
    'm-tecnico': 'Technical'
  },
  menu: {
    molino: 'Molino',
    mine: 'My themes',
    more: 'More color sets',
    create: 'Create a theme…',
    fromDocument: 'Save this document’s theme…',
    manage: 'Manage themes…',
    customFonts: 'Custom fonts…',
    useDefault: 'Use “{name}” for new documents',
    stopDefault: 'Stop using “{name}” for new documents'
  },
  colorNames: {
    dk1: 'Text dark 1',
    lt1: 'Background light 1',
    dk2: 'Text dark 2',
    lt2: 'Background light 2',
    accent1: 'Accent 1',
    accent2: 'Accent 2',
    accent3: 'Accent 3',
    accent4: 'Accent 4',
    accent5: 'Accent 5',
    accent6: 'Accent 6',
    hlink: 'Hyperlink',
    folHlink: 'Followed hyperlink'
  },
  styleNames: { title: 'Title', subtitle: 'Subtitle', heading1: 'Heading 1', heading2: 'Heading 2', heading3: 'Heading 3', quote: 'Quote' },
  editor: {
    newTitle: 'New theme',
    editTitle: 'Edit theme',
    fromDocumentTitle: 'Save this document’s theme',
    name: 'Name',
    defaultName: 'My theme',
    copyName: '{name} (copy)',
    fonts: 'Fonts',
    headingFont: 'Heading font',
    bodyFont: 'Body font',
    size: 'Text size (pt)',
    colors: 'Colors',
    styles: 'Styles',
    stylesHint: 'How headings and quotes look in Documents. In Sheets and Slides, colors and fonts are what count.',
    style: 'Style',
    font: 'Font',
    headingKind: 'Headings',
    bodyKind: 'Body',
    styleSize: 'Size',
    color: 'Color',
    bold: 'Bold',
    italic: 'Italic',
    before: 'Before',
    after: 'After',
    preview: 'Preview',
    sampleTitle: 'Quarterly report',
    sampleSubtitle: 'Summary for the team',
    sampleHeading: 'Highlights',
    sampleText: 'This is how text, headings and colors look in this theme. You can change it whenever you like with',
    sampleLink: 'a link',
    sampleQuote: 'Simple things, done well.',
    sampleHeading2: 'Next steps',
    sampleText2: 'The figures for each month, in the accent colors:',
    sampleTable: ['Month', 'Sales', 'Costs', 'January', '120', '80', 'February', '150', '90'],
    save: 'Save',
    saveApply: 'Save and apply',
    pick: 'Change color “{name}”',
    nameTaken: 'You already have a theme with that name.',
    alwaysFonts: 'On any computer',
    otherFonts: 'On this computer',
    nameRequired: 'Give it a name.'
  },
  manager: {
    title: 'Document themes',
    intro: 'A theme changes fonts, colors and styles. Your themes are saved in Molino and work in Documents, Sheets and Slides.',
    molino: 'Molino',
    mine: 'My themes',
    none: 'You have no themes of your own yet: create one or save a document’s theme.',
    apply: 'Apply',
    edit: 'Edit',
    duplicate: 'Duplicate',
    remove: 'Delete',
    more: 'More actions',
    create: 'Create a theme',
    fromDocument: 'Save this document’s',
    useDefault: 'Use for new documents',
    stopDefault: 'Stop using for new documents',
    isDefault: 'New documents',
    removeAsk: 'Delete “{name}”? Documents that already use it don’t change.',
    close: 'Close'
  },
  toasts: {
    applied: 'Theme “{name}” applied',
    colors: 'Colors of “{name}” applied',
    fonts: 'Fonts of “{name}” applied',
    saved: 'Theme “{name}” saved',
    removed: 'Theme “{name}” deleted',
    full: 'You already have {n} themes: delete one to save another.',
    defaultSet: 'New documents will start with “{name}”',
    defaultOff: 'New documents will start as usual',
    failed: 'The theme couldn’t be applied'
  },
  customFonts: {
    title: 'Custom fonts',
    intro: 'Choose the heading font and the body font for this document.',
    heading: 'Headings',
    body: 'Body'
  },
  settings: {
    label: 'Theme for new documents',
    hint: {
      word: 'Blank documents start with this theme; documents from a template don’t.',
      cell: 'Blank workbooks start with this theme; workbooks from a template don’t.',
      slide: 'Blank presentations start with this theme; presentations from a template don’t.'
    },
    none: 'The usual one'
  },
  scope: {
    word: 'In Documents it changes the theme colors, the fonts and the main styles (Normal, Title, Subtitle, Heading 1 to 3 and Quote).',
    cell: 'In Sheets it changes the theme colors and the font of the cells that use the usual one.',
    slide: 'In Slides it changes the theme colors and fonts without touching the slide design.'
  },
  palette: {
    apply: 'Apply the {name} theme',
    colors: '{name} theme colors',
    fonts: '{name} theme fonts'
  },
  keywords: {
    themes: 'theme themes style styles colors colours fonts look design palette typeface',
    create: 'create new theme customize style styles colors fonts look design',
    fromDocument: 'save theme document copy style styles colors fonts look',
    manage: 'manage themes my themes edit delete duplicate default style colors fonts',
    colors: 'colors colours theme palette color set look design',
    fonts: 'fonts theme typeface headings body look design'
  }
}

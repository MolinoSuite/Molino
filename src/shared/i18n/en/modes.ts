import type { modes as source } from '../es/modes'

export const modes: typeof source = {
  colorPicker: {
    none: 'No color',
    custom: 'Other color…'
  },
  numberField: {
    up: 'Increase',
    down: 'Decrease'
  },
  pageRange: {
    label: 'Pages to use',
    all: 'All ({n})',
    current: 'Current ({n})',
    some: 'These:',
    placeholder: 'For example, 1-3, 5',
    error: 'Pages 1 to {count}, separated by commas: 1-3, 5'
  },
  blankPages: {
    paper: 'Page size',
    papers: {
      same: 'Same as the previous page',
      A4: 'A4 (210 × 297 mm)',
      A3: 'A3 (297 × 420 mm)',
      A5: 'A5 (148 × 210 mm)',
      letter: 'Letter (8.5 × 11 in)',
      legal: 'Legal (8.5 × 14 in)'
    },
    orientation: 'Orientation',
    portrait: 'Portrait',
    landscape: 'Landscape',
    count: 'Number of pages'
  },
  textStyle: {
    font: 'Font',
    size: 'Size',
    bold: 'Bold',
    italic: 'Italic',
    color: 'Text color',
    alignLeft: 'Align left',
    alignCenter: 'Center',
    alignRight: 'Align right',
    justify: 'Justify'
  },
  select: 'Select',
  shape: 'Shape',
  shapes: {
    rect: 'Rectangle',
    ellipse: 'Ellipse',
    line: 'Line'
  },
  color: 'Color',
  fill: 'Fill',
  thickness: 'Thickness',
  deleteTip: 'Delete (Del)',
  deleteKey: 'Del'
}

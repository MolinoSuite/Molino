import type { OfficeKind } from '@shared/officeui'
import { baseFeature } from './base'
import { cellFeature } from './cell'
import type { Feature } from './types'
import { slideFeature } from './slide'
import { cellThemesFeature, slideThemesFeature, wordThemesFeature } from './themes'
import { wordFeature } from './word'

/** Las funciones de cada app (además de lo de siempre de engine.ts y apps.tsx). */
export const FEATURES: Record<OfficeKind, Feature[]> = {
  word: [baseFeature, wordFeature, wordThemesFeature],
  cell: [baseFeature, cellFeature, cellThemesFeature],
  slide: [baseFeature, slideFeature, slideThemesFeature]
}

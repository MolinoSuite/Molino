/// <reference types="vite/client" />
import type { MolinoApi } from '@shared/api'

declare global {
  interface Window {
    molino: MolinoApi
  }
}

export {}

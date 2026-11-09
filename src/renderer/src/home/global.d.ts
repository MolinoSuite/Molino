import type { HomeApi } from '@shared/home'

declare global {
  interface Window {
    /** «Molino», el inicio común (preload/home.ts). */
    molinoHome: HomeApi
  }
}

export {}

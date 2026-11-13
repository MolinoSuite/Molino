import { useEffect, useRef, useState } from 'react'
import type { PageInfo } from '@shared/types'
import { getThumb } from './render'

/** Dibuja en un lienzo la miniatura compartida de una página cuando entra en pantalla. */
export function useThumb(doc: string, page: PageInfo, cssWidth: number) {
  const holder = useRef<HTMLDivElement>(null)
  const canvas = useRef<HTMLCanvasElement>(null)
  const [seen, setSeen] = useState(false)

  useEffect(() => {
    const element = holder.current
    if (!element) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setSeen(true)
          observer.disconnect()
        }
      },
      { rootMargin: '400px' }
    )
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (!seen) return
    let alive = true
    const width = Math.max(40, Math.round(cssWidth * Math.min(2, window.devicePixelRatio || 1)))
    getThumb(doc, page, width)
      .then((bitmap) => {
        const target = canvas.current
        if (!alive || !target) return
        target.width = bitmap.width
        target.height = bitmap.height
        target.getContext('2d')?.drawImage(bitmap, 0, 0)
      })
      .catch(() => undefined)
    return () => {
      alive = false
    }
    // La miniatura depende del contenido (gen) y del tamaño, no de la identidad del objeto.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seen, doc, page.id, page.gen, page.w, page.h, cssWidth])

  return { holder, canvas }
}

/**
 * El hueco de los botones de la ventana (minimizar, maximizar, cerrar) que
 * dibuja el sistema sobre la barra de título (Window Controls Overlay): en
 * Windows, 137 px a la derecha; en Linux, los suyos, y a la izquierda si el
 * escritorio los pone allí. La barra (styles/shell.css) lo deja libre con
 * --window-buttons-right y --window-buttons-left.
 *
 * Se mide una vez, al abrir: el ancho de los botones no cambia, y la medida que
 * da el sistema no siempre se actualiza al cambiar el tamaño de la ventana.
 */
export function measureWindowButtons(): void {
  const overlay = (navigator as Navigator & { windowControlsOverlay?: { visible: boolean; getTitlebarAreaRect(): DOMRect } }).windowControlsOverlay
  if (!overlay?.visible) return
  const area = overlay.getTitlebarAreaRect()
  const right = Math.round(window.innerWidth - area.x - area.width)
  const left = Math.round(area.x)
  const style = document.documentElement.style
  // Solo medidas con sentido (si la ventana aún no tiene su tamaño, se quedan las de Windows).
  if (right >= 0 && right <= 300) style.setProperty('--window-buttons-right', `${right}px`)
  if (left >= 0 && left <= 300) style.setProperty('--window-buttons-left', `${left}px`)
}

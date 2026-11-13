import type { ReactNode } from 'react'
import type { OfficeKind } from '@shared/officeui'
import type { MenuEntry } from '@/components/ui'
import type { Mode, PaletteEntry, Tool } from '../apps'
import type { PromptSpec } from '../dialogs'
import type { EditorSession, EditorState } from '../engine'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Api = any

/**
 * Lo que una función de Molino puede usar del editor (engine.ts lo da): la API
 * de ONLYOFFICE de la pestaña, su ventana y el estado que pinta la interfaz.
 */
export interface FeatureContext {
  /** El editor (Asc.editor) de la pestaña. */
  api: Api
  /** La ventana del editor (Asc, AscCommon…). */
  ew: Api
  state: EditorState
  kind: OfficeKind
  /** Avisa a la interfaz de que el estado ha cambiado (se vuelve a pintar). */
  changed(): void
  /** Un color del editor desde «#rrggbb». */
  color(hex: string): Api
  /**
   * Un valor (objeto, lista) creado en la ventana del editor: algunas órdenes
   * no aceptan los de la de Molino (otro «realm»: instanceof falla y no hacen nada).
   */
  local<T>(value: T): T
  /** Ejecuta código de la API de documentos (Api.GetDocument()…) con datos; true si fue bien. */
  builder(fn: (scope: { molino: Api }) => void, data: unknown): boolean
}

export type Run = (command: string, value?: string) => unknown

/** Lo que recibe un panel lateral de una función (a la derecha, como los comentarios). */
export interface PanelProps {
  session: EditorSession
  state: EditorState
  run: Run
  close: () => void
}

/** Lo que recibe un cuadro propio de una función. */
export interface DialogProps {
  session: EditorSession
  state: EditorState
  run: Run
  /** Lo que se pasó al abrirlo: run('dialog', 'id:valor'). */
  value?: string
  close: () => void
}

/**
 * Una función de Documentos, Hojas o Presentaciones (features/word.tsx…):
 * sus órdenes del editor, sus botones en las pestañas, lo que pregunta antes,
 * su menú del botón derecho, sus paneles y sus cuadros. Todo opcional.
 *
 * - Órdenes: run('miOrden', valor) llega a ``commands``.
 * - Paneles: run('panel', 'id') abre o cierra el panel ``panels.id``.
 * - Cuadros: run('dialog', 'id') o run('dialog', 'id:valor') abre ``dialogs.id``.
 */
export interface Feature {
  commands?: (ctx: FeatureContext) => Record<string, (value?: string) => void>
  /** Escuchar avisos del editor al cargar (on('asc_onAlgo', fn)); el estado propio va en ctx.state.extra. */
  listen?: (ctx: FeatureContext, on: (name: string, fn: (...args: Api[]) => void) => void) => void
  /**
   * Botones que se añaden a las pestañas que ya hay (id de la pestaña →
   * grupos, con su nombre para «Más»; ``at``: en qué posición, si no al final).
   */
  tools?: Record<string, { groups: Tool[][]; names?: string[]; at?: number }>
  /** Pestañas nuevas. */
  modes?: Mode[]
  /** Órdenes que preguntan algo antes (el cuadro de Molino con campos). */
  ask?: (command: string, value: string | undefined, session: EditorSession, run: Run) => PromptSpec | null
  /** Lo que se añade al menú del botón derecho. */
  context?: (state: EditorState, session: EditorSession, run: Run) => MenuEntry[]
  panels?: Record<string, { title: string; render: (props: PanelProps) => ReactNode }>
  dialogs?: Record<string, (props: DialogProps) => ReactNode>
  /** Órdenes del buscador «¿Qué quieres hacer?» además de las de los botones. */
  palette?: PaletteEntry[]
}

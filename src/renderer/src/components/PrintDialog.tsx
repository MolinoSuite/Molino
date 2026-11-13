import { useMemo } from 'react'
import { useApp } from '@/state/app'
import { type CustomDialogProps, registerDialog } from './Dialogs'
import { PrintDialogView } from './Print'

/** Imprimir en Molino PDF: el cuadro común (Print.tsx) con el documento abierto. */
function PrintDialog({ doc: docId, data }: CustomDialogProps) {
  const close = useApp((s) => s.closeDialog)
  const doc = useApp((s) => (docId ? s.docs[docId] : undefined))
  const selectedIds = useMemo(() => (Array.isArray(data?.pages) ? (data.pages as string[]) : null), [data])
  return <PrintDialogView doc={doc} selectedIds={selectedIds} onClose={close} />
}

registerDialog('print', PrintDialog)

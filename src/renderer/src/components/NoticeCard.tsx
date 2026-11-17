import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/cn'

/**
 * Tarjeta discreta abajo a la derecha (versión nueva, novedades tras
 * actualizar): título, una línea y dos botones. Sin window.molino ni textos
 * propios, porque la usan Molino PDF (UpdateCard.tsx) y el inicio de la suite
 * (home/Home.tsx). Van dentro de un .update-cards, que las apila.
 */
export function NoticeCard({
  icon: Icon,
  title,
  text,
  action,
  onAction,
  dismiss,
  onDismiss,
  className
}: {
  icon: LucideIcon
  title: string
  text: string
  action: string
  onAction: () => void
  dismiss: string
  onDismiss: () => void
  className?: string
}) {
  return (
    <div className={cn('update-card', className)} role="status">
      <Icon size={18} className="update-icon" />
      <div className="grow">
        <b>{title}</b>
        <span>{text}</span>
        <div className="update-actions">
          <button className="btn sm primary" onClick={onAction}>
            {action}
          </button>
          <button className="btn sm ghost" onClick={onDismiss}>
            {dismiss}
          </button>
        </div>
      </div>
    </div>
  )
}

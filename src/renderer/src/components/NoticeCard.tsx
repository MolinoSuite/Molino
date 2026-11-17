import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/cn'

/**
 * Tarjeta discreta abajo a la derecha (novedades tras actualizar): título, una
 * línea y dos botones. Sin window.molino ni textos propios, porque la usan
 * Molino PDF (WhatsNewCard.tsx) y el inicio de la suite (home/Home.tsx). Va
 * dentro de un .notice-cards, que la coloca (y apila otras si las hay).
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
    <div className={cn('notice-card', className)} role="status">
      <Icon size={18} className="notice-icon" />
      <div className="grow">
        <b>{title}</b>
        <span>{text}</span>
        <div className="notice-actions">
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

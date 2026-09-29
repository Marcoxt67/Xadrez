import { BookOpen, Check, Star, ThumbsUp, X } from 'lucide-react'
import type { Classification } from '@/lib/analysis'
import { CLASSIFICATION_META } from '@/lib/classifications'
import { cn } from '@/lib/utils'

const ICONS: Partial<Record<Classification, typeof Star>> = {
  best: Star,
  excellent: ThumbsUp,
  good: Check,
  book: BookOpen,
  miss: X,
}

/** Selo redondo com o símbolo da classificação. O nome vai no `aria-label`. */
export function ClassBadge({
  classification,
  className,
  decorative = false,
}: {
  classification: Classification
  className?: string
  decorative?: boolean
}) {
  const meta = CLASSIFICATION_META[classification]
  const Icon = ICONS[classification]
  return (
    <span
      role={decorative ? undefined : 'img'}
      aria-label={decorative ? undefined : meta.label}
      aria-hidden={decorative || undefined}
      className={cn(
        'inline-grid size-5 shrink-0 place-items-center rounded-full font-sans text-[0.7rem] leading-none font-bold text-[#16211f] select-none',
        className,
      )}
      style={{ backgroundColor: meta.color }}
    >
      {Icon ? <Icon className="size-[62%]" strokeWidth={3} fill={classification === 'best' ? 'currentColor' : 'none'} /> : meta.glyph}
    </span>
  )
}

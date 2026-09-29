import { useEffect, useRef } from 'react'
import type { AnalyzedMove } from '@/lib/analysis'
import { CLASSIFICATION_META } from '@/lib/classifications'
import { sanPt } from '@/lib/coach'
import { cn } from '@/lib/utils'
import { ClassBadge } from './ClassBadge'

export function MoveList({ moves, ply, onSelect }: { moves: AnalyzedMove[]; ply: number; onSelect: (ply: number) => void }) {
  const listRef = useRef<HTMLOListElement>(null)

  // Rola só a lista (scrollIntoView rolaria a página inteira junto)
  useEffect(() => {
    const list = listRef.current
    const current = list?.querySelector<HTMLElement>('[aria-current="true"]')
    if (!list || !current) return
    const box = list.getBoundingClientRect()
    const item = current.getBoundingClientRect()
    if (item.top < box.top) list.scrollTop -= box.top - item.top + 4
    else if (item.bottom > box.bottom) list.scrollTop += item.bottom - box.bottom + 4
  }, [ply])

  // Agrupa em pares (brancas, pretas); se a partida começa com as pretas, a primeira casa fica vazia
  const rows: { number: number; white?: AnalyzedMove; black?: AnalyzedMove }[] = []
  for (const m of moves) {
    const last = rows[rows.length - 1]
    if (m.color === 'w' || !last || last.black) rows.push({ number: m.moveNumber, [m.color === 'w' ? 'white' : 'black']: m })
    else last.black = m
  }

  const cell = (m?: AnalyzedMove) =>
    m ? (
      <button
        type="button"
        aria-current={m.ply === ply || undefined}
        aria-label={`${m.moveNumber}${m.color === 'w' ? '.' : '…'} ${sanPt(m.san)}, ${CLASSIFICATION_META[m.classification].label}`}
        onClick={() => onSelect(m.ply)}
        className={cn(
          'flex min-h-9 items-center gap-2 rounded-md px-2 text-left text-[0.95rem] outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring',
          m.ply === ply && 'bg-paper text-ink hover:bg-paper',
        )}
      >
        <ClassBadge decorative classification={m.classification} className="size-[1.1rem] text-[0.6rem]" />
        <span translate="no" className="font-medium">
          {sanPt(m.san)}
        </span>
      </button>
    ) : (
      <span />
    )

  return (
    <ol ref={listRef} className="max-h-[22rem] overflow-y-auto overscroll-contain pr-1 lg:max-h-[min(26rem,40vh)]">
      {rows.map((row) => (
        <li key={row.number} className="grid grid-cols-[2.25rem_1fr_1fr] items-center gap-1 py-px">
          <span className="text-right text-sm text-muted-foreground tabular-nums">{row.number}.</span>
          {cell(row.white)}
          {cell(row.black)}
        </li>
      ))}
    </ol>
  )
}

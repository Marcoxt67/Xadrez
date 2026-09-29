import type { Color } from 'chess.js'
import { CLASSIFICATION_ORDER, playerName, type GameReview } from '@/lib/analysis'
import { CLASSIFICATION_META } from '@/lib/classifications'
import { cn } from '@/lib/utils'
import { ClassBadge } from './ClassBadge'

const pct = (v: number) => v.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })

export function Summary({ review, playerColor }: { review: GameReview; playerColor: Color }) {
  const colors: Color[] = ['w', 'b']
  return (
    <div className="space-y-5">
      <dl className="grid grid-cols-2 gap-3">
        {colors.map((c) => (
          <div key={c} className={cn('rounded-md px-3 py-2.5', c === playerColor ? 'bg-muted' : 'ring-1 ring-border')}>
            <dt className="flex min-w-0 items-center gap-2 text-sm text-muted-foreground">
              <span
                aria-hidden
                className={cn('size-3 shrink-0 rounded-[2px] ring-1 ring-paper/40', c === 'w' ? 'bg-paper' : 'bg-[#0c1d1b]')}
              />
              <span className="truncate" translate="no">
                {playerName(review, c)}
              </span>
              {c === playerColor && <span className="shrink-0 text-paper">(você)</span>}
            </dt>
            <dd className="mt-1.5 text-[1.75rem] leading-none font-semibold tabular-nums">
              {pct(review.accuracy[c])}%
              <span className="mt-1 block text-sm font-normal text-muted-foreground">de precisão</span>
            </dd>
          </div>
        ))}
      </dl>

      {review.opening && (
        <p className="text-sm text-muted-foreground">
          Abertura: <span className="text-paper">{review.opening}</span>
        </p>
      )}

      <table className="w-full text-[0.95rem]">
        <caption className="sr-only">Classificação dos lances de cada jogador</caption>
        <thead>
          <tr className="text-sm text-muted-foreground">
            <th scope="col" className="pb-2 text-left font-normal">
              Lances
            </th>
            <th scope="col" className="w-20 pb-2 text-right font-normal">
              Brancas
            </th>
            <th scope="col" className="w-20 pb-2 text-right font-normal">
              Pretas
            </th>
          </tr>
        </thead>
        <tbody>
          {CLASSIFICATION_ORDER.map((c) => (
            <tr key={c} className="border-t border-border/60">
              <th scope="row" className="py-1.5 text-left font-normal">
                <span className="flex items-center gap-2.5">
                  <ClassBadge decorative classification={c} />
                  {CLASSIFICATION_META[c].label}
                </span>
              </th>
              {colors.map((color) => {
                const count = review.counts[color][c]
                return (
                  <td key={color} className={cn('text-right tabular-nums', count === 0 ? 'text-muted-foreground/60' : 'font-semibold')}>
                    {count}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

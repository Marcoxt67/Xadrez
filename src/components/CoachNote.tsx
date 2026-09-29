import type { Color } from 'chess.js'
import { defaultPieces } from 'react-chessboard'
import { formatScore, type AnalyzedMove } from '@/lib/analysis'
import { CLASSIFICATION_META } from '@/lib/classifications'
import { coachComment, sanPt } from '@/lib/coach'
import { cn } from '@/lib/utils'
import { ClassBadge } from './ClassBadge'

/** O bilhete da treinadora: papel de súmula com pautas, onde a Beth escreve. */
export function CoachNote({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <section
      aria-label="Comentário da treinadora Beth Harmon"
      className={cn('rounded-[4px] bg-paper p-5 text-ink shadow-[0_18px_40px_-22px_rgb(0_0_0/0.7)] sm:p-6', className)}
    >
      <header className="flex items-center gap-3">
        <span className="grid size-11 shrink-0 place-items-center rounded-full bg-pine p-1.5" aria-hidden>
          {defaultPieces.wQ({ svgStyle: { width: '100%', height: '100%' } })}
        </span>
        <div>
          <p className="font-serif text-lg leading-tight" translate="no">
            Beth Harmon
          </p>
          <p className="text-sm text-ink/65">Sua treinadora</p>
        </div>
      </header>
      <div className="mt-4" aria-live="polite">
        {children}
      </div>
    </section>
  )
}

/** Texto da Beth em serifa, sobre as pautas da súmula */
export function CoachText({
  children,
  className,
  line = 1.75,
}: {
  children: React.ReactNode
  className?: string
  /** Altura da linha em rem; as pautas acompanham */
  line?: number
}) {
  return (
    <p
      className={cn('font-serif text-[1.125rem] text-pretty', className)}
      style={{
        lineHeight: `${line}rem`,
        backgroundImage: `repeating-linear-gradient(to bottom, transparent 0, transparent calc(${line}rem - 1px), rgb(22 33 31 / 0.14) calc(${line}rem - 1px), rgb(22 33 31 / 0.14) ${line}rem)`,
      }}
    >
      {children}
    </p>
  )
}

export function MoveComment({ move, playerColor, showBest }: { move: AnalyzedMove; playerColor: Color; showBest: boolean }) {
  const meta = CLASSIFICATION_META[move.classification]
  return (
    <>
      <div className="mb-3 flex items-center gap-2">
        <ClassBadge classification={move.classification} className="size-6 text-[0.75rem]" />
        <p className="font-semibold">
          <span translate="no">
            {move.moveNumber}
            {move.color === 'w' ? '.' : '…'} {sanPt(move.san)}
          </span>{' '}
          {meta.phrase}
        </p>
        <span className="ml-auto rounded-sm bg-ink px-1.5 py-0.5 text-sm font-semibold text-paper tabular-nums">
          {formatScore(move.whiteScoreAfter)}
        </span>
      </div>
      <CoachText>{coachComment(move, playerColor)}</CoachText>
      {showBest && move.best && (
        <p className="mt-3 text-[0.95rem] text-ink/75">
          Melhor sequência:{' '}
          <span translate="no" className="font-semibold text-ink">
            {move.best.line.map(sanPt).join(' ')}
          </span>
        </p>
      )}
    </>
  )
}

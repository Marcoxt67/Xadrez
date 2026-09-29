import { useRef, useState } from 'react'
import type { AnalyzedMove, Classification } from '@/lib/analysis'
import { formatScore } from '@/lib/analysis'
import { CLASSIFICATION_META } from '@/lib/classifications'
import { sanPt } from '@/lib/coach'

const MARKED: Classification[] = ['brilliant', 'great', 'miss', 'mistake', 'blunder']
const W = 600
const H = 88

/** Gráfico da vantagem ao longo da partida. Área clara = brancas, fundo escuro = pretas. */
export function EvalGraph({
  moves,
  startWhiteWin,
  ply,
  onSelect,
}: {
  moves: AnalyzedMove[]
  startWhiteWin: number
  ply: number
  onSelect: (ply: number) => void
}) {
  const ref = useRef<SVGSVGElement>(null)
  const [hover, setHover] = useState<number | null>(null)

  const values = [startWhiteWin, ...moves.map((m) => m.whiteWinAfter)]
  const n = values.length - 1 || 1
  const x = (i: number) => (i / n) * W
  const y = (v: number) => (1 - v) * H
  const curve = values.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' L')
  const area = `M0,${H} L${curve} L${W},${H} Z`

  const plyFromPointer = (clientX: number) => {
    const rect = ref.current!.getBoundingClientRect()
    return Math.round(Math.min(1, Math.max(0, (clientX - rect.left) / rect.width)) * n)
  }

  const hovered = hover !== null && hover > 0 ? moves[hover - 1] : null

  return (
    <div className="relative select-none">
      <svg
        ref={ref}
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        className="block h-[72px] w-full cursor-pointer overflow-visible rounded-[3px] bg-[#0c1d1b] touch-pan-y"
        role="img"
        aria-label="Gráfico da vantagem ao longo da partida. Use a lista de lances para navegar pelo teclado."
        onPointerMove={(e) => setHover(plyFromPointer(e.clientX))}
        onPointerLeave={() => setHover(null)}
        onClick={(e) => onSelect(plyFromPointer(e.clientX))}
      >
        <path d={area} fill="var(--paper)" />
        <line x1={0} x2={W} y1={H / 2} y2={H / 2} stroke="var(--sage)" strokeOpacity={0.45} strokeWidth={1} vectorEffect="non-scaling-stroke" />
        <line x1={x(ply)} x2={x(ply)} y1={0} y2={H} stroke="#e9be3f" strokeWidth={2} vectorEffect="non-scaling-stroke" />
        {hover !== null && hover !== ply && (
          <line x1={x(hover)} x2={x(hover)} y1={0} y2={H} stroke="var(--sage)" strokeWidth={1} vectorEffect="non-scaling-stroke" />
        )}
      </svg>
      {/* Marcadores em HTML para não serem distorcidos pelo preserveAspectRatio */}
      <div className="pointer-events-none absolute inset-0">
        {moves.map((m) =>
          MARKED.includes(m.classification) ? (
            <span
              key={m.ply}
              className="absolute size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-[#0c1d1b]"
              style={{
                left: `${(m.ply / n) * 100}%`,
                top: `${(1 - m.whiteWinAfter) * 100}%`,
                backgroundColor: CLASSIFICATION_META[m.classification].color,
              }}
            />
          ) : null,
        )}
      </div>
      {hovered && (
        <div
          className="pointer-events-none absolute bottom-full z-20 mb-2 -translate-x-1/2 rounded-md bg-popover px-2.5 py-1.5 whitespace-nowrap shadow-lg ring-1 ring-border"
          style={{ left: `clamp(3rem, ${(hovered.ply / n) * 100}%, calc(100% - 3rem))` }}
        >
          <div className="text-sm font-semibold tabular-nums">{formatScore(hovered.whiteScoreAfter)}</div>
          <div className="text-xs text-muted-foreground" translate="no">
            {hovered.moveNumber}
            {hovered.color === 'w' ? '.' : '…'} {sanPt(hovered.san)}
          </div>
        </div>
      )}
    </div>
  )
}

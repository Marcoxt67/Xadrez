import type { Color, Square } from 'chess.js'
import { Chessboard } from 'react-chessboard'
import type { Score } from '@/lib/engine'
import type { Classification } from '@/lib/analysis'
import { formatScore } from '@/lib/analysis'
import { CLASSIFICATION_META } from '@/lib/classifications'
import { ClassBadge } from './ClassBadge'

type Props = {
  fen: string
  orientation: Color
  lastMove?: { from: Square; to: Square; classification: Classification } | null
  bestMove?: { from: Square; to: Square } | null
  /** Chance de vitória das brancas (0–1); sem valor, a barra fica oculta */
  whiteWin?: number
  whiteScore?: Score
  /** Descrição da posição para leitores de tela */
  label: string
}

export function ReviewBoard({ fen, orientation, lastMove, bestMove, whiteWin, whiteScore, label }: Props) {
  const tint = lastMove ? CLASSIFICATION_META[lastMove.classification].color : null
  const highlight: Record<string, React.CSSProperties> = {}
  if (lastMove && tint) {
    highlight[lastMove.from] = { backgroundColor: `${tint}73` }
    highlight[lastMove.to] = { backgroundColor: `${tint}99` }
  }

  return (
    <div className="flex w-full items-stretch gap-2 sm:gap-3">
      {whiteWin !== undefined && (
        <EvalBar whiteWin={whiteWin} whiteScore={whiteScore} orientation={orientation} />
      )}
      {/* O tabuleiro é só para ver: inert tira as 32 peças "arrastáveis" do Tab e do leitor de tela */}
      <div
        role="img"
        aria-label={label}
        className="aspect-square min-w-0 flex-1 overflow-hidden rounded-[3px] shadow-[0_18px_40px_-18px_rgb(0_0_0/0.6)]"
      >
        <div inert className="size-full">
        <Chessboard
          options={{
            id: 'review-board',
            position: fen,
            boardOrientation: orientation === 'w' ? 'white' : 'black',
            allowDragging: false,
            allowDrawingArrows: false,
            animationDurationInMs: 160,
            arrows: bestMove
              ? [{ startSquare: bestMove.from, endSquare: bestMove.to, color: 'rgb(134 184 62 / 0.85)' }]
              : [],
            darkSquareStyle: { backgroundColor: 'var(--board-dark)' },
            lightSquareStyle: { backgroundColor: 'var(--board-light)' },
            darkSquareNotationStyle: { color: 'var(--board-light)', fontWeight: 600 },
            lightSquareNotationStyle: { color: 'var(--board-dark)', fontWeight: 600 },
            squareRenderer: ({ square, children }) => (
              <div style={{ position: 'relative', width: '100%', height: '100%', ...highlight[square] }}>
                {children}
                {lastMove && square === lastMove.to && (
                  <ClassBadge
                    decorative
                    classification={lastMove.classification}
                    className="pointer-events-none absolute top-[3%] right-[3%] z-10 size-[36%] text-[clamp(0.55rem,1.6vw,0.95rem)] shadow-[0_1px_3px_rgb(0_0_0/0.45)]"
                  />
                )}
              </div>
            ),
          }}
        />
        </div>
      </div>
    </div>
  )
}

function EvalBar({ whiteWin, whiteScore, orientation }: { whiteWin: number; whiteScore?: Score; orientation: Color }) {
  const whitePct = Math.round(whiteWin * 1000) / 10
  const whiteAhead = whiteWin >= 0.5
  const label = whiteScore ? formatScore(whiteScore).replace('−', '') : ''
  // Com o tabuleiro invertido, a parte branca da barra fica no topo
  const flipped = orientation === 'b'
  return (
    <div
      className="relative w-4 shrink-0 overflow-hidden rounded-[3px] bg-[#0c1d1b] sm:w-6"
      role="meter"
      aria-label="Vantagem das brancas"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={whitePct}
      aria-valuetext={whiteScore ? `Avaliação ${formatScore(whiteScore)}` : undefined}
    >
      <div
        className="absolute inset-0 bg-paper transition-transform duration-300 ease-out"
        style={{ transform: `scaleY(${whitePct / 100})`, transformOrigin: flipped ? 'top' : 'bottom' }}
      />
      <span
        className="absolute inset-x-0 text-center text-[0.55rem] font-semibold tabular-nums sm:text-[0.65rem]"
        style={{
          [whiteAhead !== flipped ? 'bottom' : 'top']: 4,
          color: whiteAhead ? 'var(--ink)' : 'var(--paper)',
        }}
      >
        {label}
      </span>
    </div>
  )
}

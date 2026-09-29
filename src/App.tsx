import type { Color } from 'chess.js'
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Repeat2 } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { CoachNote, CoachText, MoveComment } from '@/components/CoachNote'
import { EvalGraph } from '@/components/EvalGraph'
import { ImportPanel } from '@/components/ImportPanel'
import { MoveList } from '@/components/MoveList'
import { ReviewBoard } from '@/components/ReviewBoard'
import { Summary } from '@/components/Summary'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { playerName, reviewGame, type Classification, type GameReview } from '@/lib/analysis'
import { decisiveMove, sanPt, summaryComment } from '@/lib/coach'
import { cn } from '@/lib/utils'

const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
const DEPTH = 14
// Nessas classificações não faz sentido mostrar "o melhor era…"
const GOOD_ENOUGH: Classification[] = ['best', 'book', 'brilliant', 'great']

type Stage =
  | { kind: 'import'; error?: string }
  | { kind: 'analyzing'; done: number; total: number; fen: string; playerColor: Color }
  | { kind: 'review'; review: GameReview; playerColor: Color }

export default function App() {
  const [stage, setStage] = useState<Stage>({ kind: 'import' })
  // A última revisão fica guardada: "Nova partida" não joga fora um minuto de análise
  const [previous, setPrevious] = useState<Extract<Stage, { kind: 'review' }> | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  const analyze = useCallback(async (pgn: string, playerColor: Color) => {
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    setStage({ kind: 'analyzing', done: 0, total: 1, fen: START_FEN, playerColor })
    try {
      const review = await reviewGame(pgn, {
        depth: DEPTH,
        signal: controller.signal,
        onProgress: (done, total, fen) =>
          !controller.signal.aborted && setStage({ kind: 'analyzing', done, total, fen, playerColor }),
      })
      if (!controller.signal.aborted) setStage({ kind: 'review', review, playerColor })
    } catch (err) {
      if (controller.signal.aborted) return
      setStage({ kind: 'import', error: err instanceof Error ? err.message : 'A análise falhou. Tente de novo.' })
    }
  }, [])

  const reset = () => {
    abortRef.current?.abort()
    if (stage.kind === 'review') setPrevious(stage)
    setStage({ kind: 'import' })
  }

  useEffect(() => {
    document.title =
      stage.kind === 'review'
        ? `${playerName(stage.review, 'w')} x ${playerName(stage.review, 'b')}, revisão | Beth Harmon`
        : 'Beth Harmon, sua treinadora de xadrez'
  }, [stage])

  return (
    <div className="min-h-dvh pb-12">
      <a
        href="#conteudo"
        className="sr-only rounded-md bg-paper px-3 py-2 text-ink focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-50"
      >
        Pular para o conteúdo
      </a>
      <header className="mx-auto flex max-w-[1200px] items-center justify-between gap-4 px-4 pt-5 pb-6 sm:px-8 sm:pt-7">
        <div>
          <h1 className="font-serif text-[1.65rem] leading-none font-normal sm:text-[2rem]" translate="no">
            Beth Harmon
          </h1>
          <p className="mt-1 text-[0.95rem] text-muted-foreground">Revisão de partidas com a sua treinadora</p>
        </div>
        {stage.kind !== 'import' && (
          <Button variant="outline" size="lg" className="h-10 px-4 text-[0.95rem]" onClick={reset}>
            Nova partida
          </Button>
        )}
      </header>

      <main id="conteudo" className="mx-auto max-w-[1200px] px-4 sm:px-8">
        {stage.kind === 'review' ? (
          <ReviewScreen key={stage.review.startFen + stage.review.moves.length} review={stage.review} playerColor={stage.playerColor} />
        ) : (
          <Layout
            board={<ReviewBoard
                label={stage.kind === 'analyzing' ? 'Tabuleiro acompanhando a análise' : 'Tabuleiro na posição inicial'}
                fen={stage.kind === 'analyzing' ? stage.fen : START_FEN}
                orientation={stage.kind === 'analyzing' ? stage.playerColor : 'w'}
              />}
            side={
              stage.kind === 'analyzing' ? (
                <CoachNote>
                  <CoachText>
                    {stage.done === 0
                      ? 'Preparando o tabuleiro de análise…'
                      : stage.done < stage.total
                        ? `Estou olhando a posição ${stage.done} de ${stage.total}…`
                        : 'Pronto. Organizando os comentários…'}
                  </CoachText>
                  <Progress
                    value={Math.round((stage.done / stage.total) * 100)}
                    aria-label="Progresso da análise"
                    className="mt-5 [&_[data-slot=progress-indicator]]:bg-ink [&_[data-slot=progress-track]]:h-1.5 [&_[data-slot=progress-track]]:bg-ink/15"
                  />
                  <p className="mt-3 text-sm text-ink/65">
                    A análise roda aqui no seu navegador, com o Stockfish. Partidas longas levam cerca de um minuto.
                  </p>
                  <Button variant="ghost" className="mt-3 -ml-2.5 text-ink hover:bg-ink/8" onClick={reset}>
                    Cancelar análise
                  </Button>
                </CoachNote>
              ) : (
                <CoachNote>
                  <CoachText line={2.25} className="text-[1.45rem] sm:text-[1.6rem]">
                    Me mostre a sua partida. Eu te digo onde ela foi ganha e onde foi perdida.
                  </CoachText>
                  {stage.error && (
                    <p role="alert" className="mt-4 rounded-md bg-[#d9463c]/15 px-3 py-2 text-[0.95rem] font-medium text-[#7a1d16]">
                      {stage.error}
                    </p>
                  )}
                  {previous && (
                    <Button
                      variant="outline"
                      size="lg"
                      className="mt-5 h-auto min-h-11 w-full border-ink/25 bg-transparent py-2 text-[0.95rem] whitespace-normal text-ink hover:bg-ink/6 dark:bg-transparent dark:hover:bg-ink/6"
                      onClick={() => setStage(previous)}
                    >
                      Voltar para a revisão de {playerName(previous.review, 'w')} x {playerName(previous.review, 'b')}
                    </Button>
                  )}
                  <div className="mt-6">
                    <ImportPanel onAnalyze={analyze} />
                  </div>
                </CoachNote>
              )
            }
          />
        )}
      </main>
    </div>
  )
}

/** Tabuleiro à esquerda e treinadora à direita; no celular, o que vem primeiro depende da etapa. */
function Layout({ board, side, boardFirst = false }: { board: React.ReactNode; side: React.ReactNode; boardFirst?: boolean }) {
  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(340px,400px)] lg:gap-10">
      <div className={cn('mx-auto w-full max-w-[min(100%,calc(100dvh-7rem))] lg:order-1', boardFirst ? 'order-1' : 'order-2')}>{board}</div>
      <div className={cn('lg:order-2', boardFirst ? 'order-2' : 'order-1')}>{side}</div>
    </div>
  )
}

function ReviewScreen({ review, playerColor }: { review: GameReview; playerColor: Color }) {
  const [ply, setPly] = useState(0)
  const [orientation, setOrientation] = useState<Color>(playerColor)
  const [tab, setTab] = useState<string>('summary')
  const last = review.moves.length

  const go = useCallback(
    (to: number | ((p: number) => number)) =>
      setPly((p) => Math.max(0, Math.min(last, typeof to === 'function' ? to(p) : to))),
    [last],
  )

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      if (target.closest('input, textarea, [role="tab"]') || e.altKey || e.ctrlKey || e.metaKey) return
      const step: Record<string, (p: number) => number> = {
        ArrowLeft: (p) => p - 1,
        ArrowRight: (p) => p + 1,
        Home: () => 0,
        End: () => last,
      }
      if (!step[e.key]) return
      e.preventDefault()
      go(step[e.key])
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [last, go])

  const move = ply > 0 ? review.moves[ply - 1] : null
  const fen = move ? move.fenAfter : review.startFen
  const showBest = move && move.best && !GOOD_ENOUGH.includes(move.classification)

  const top: Color = orientation === 'w' ? 'b' : 'w'

  const decisive = decisiveMove(review, playerColor)

  return (
    <Layout
      boardFirst
      board={
        <div className="space-y-2.5">
          <PlayerStrip review={review} color={top} playerColor={playerColor} />
          <ReviewBoard
            label={
              move
                ? `Tabuleiro depois de ${move.moveNumber}${move.color === 'w' ? '.' : '…'} ${sanPt(move.san)}`
                : 'Tabuleiro na posição inicial da partida'
            }
            fen={fen}
            orientation={orientation}
            lastMove={move ? { from: move.from, to: move.to, classification: move.classification } : null}
            bestMove={showBest ? { from: move.best!.from, to: move.best!.to } : null}
            whiteWin={move ? move.whiteWinAfter : review.startWhiteWin}
            whiteScore={move ? move.whiteScoreAfter : review.startWhiteScore}
          />
          <PlayerStrip review={review} color={orientation} playerColor={playerColor} />
          <div className="pt-3">
            <EvalGraph moves={review.moves} startWhiteWin={review.startWhiteWin} ply={ply} onSelect={go} />
          </div>
          <nav aria-label="Navegar pelos lances" className="flex items-center justify-center gap-1.5 pt-2">
            <NavButton label="Início da partida" onClick={() => go(0)} disabled={ply === 0}>
              <ChevronsLeft />
            </NavButton>
            <NavButton label="Lance anterior" onClick={() => go((p) => p - 1)} disabled={ply === 0}>
              <ChevronLeft />
            </NavButton>
            <NavButton label="Próximo lance" onClick={() => go((p) => p + 1)} disabled={ply === last} primary>
              <ChevronRight />
            </NavButton>
            <NavButton label="Fim da partida" onClick={() => go(last)} disabled={ply === last}>
              <ChevronsRight />
            </NavButton>
            <NavButton label="Virar o tabuleiro" onClick={() => setOrientation((o) => (o === 'w' ? 'b' : 'w'))} className="ml-3">
              <Repeat2 />
            </NavButton>
          </nav>
        </div>
      }
      side={
        <div className="space-y-6">
          <CoachNote>
            {move ? (
              <MoveComment move={move} playerColor={playerColor} showBest={!!showBest} />
            ) : (
              <>
                <CoachText>{summaryComment(review, playerColor)}</CoachText>
                <Button
                  size="lg"
                  className="mt-5 h-11 w-full bg-ink text-base text-paper hover:bg-ink/85"
                  onClick={() => {
                    go(1)
                    setTab('moves')
                  }}
                >
                  Começar a revisão
                </Button>
                {decisive && (
                  <Button
                    variant="ghost"
                    size="lg"
                    className="mt-2 h-11 w-full text-base text-ink hover:bg-ink/8"
                    onClick={() => {
                      go(decisive.ply)
                      setTab('moves')
                    }}
                  >
                    Ver o momento decisivo ({decisive.moveNumber}
                    {decisive.color === 'w' ? '.' : '…'} {sanPt(decisive.san)})
                  </Button>
                )}
              </>
            )}
          </CoachNote>

          <Tabs value={tab} onValueChange={(v) => setTab(String(v))} className="gap-3">
            <TabsList className="h-10 w-full bg-felt">
              <TabsTrigger value="summary" className="text-[0.95rem] text-sage data-active:bg-paper data-active:text-ink">
                Resumo
              </TabsTrigger>
              <TabsTrigger value="moves" className="text-[0.95rem] text-sage data-active:bg-paper data-active:text-ink">
                Lances
              </TabsTrigger>
            </TabsList>
            <TabsContent value="summary">
              <Summary review={review} playerColor={playerColor} />
            </TabsContent>
            <TabsContent value="moves">
              <MoveList moves={review.moves} ply={ply} onSelect={go} />
            </TabsContent>
          </Tabs>
        </div>
      }
    />
  )
}

function PlayerStrip({ review, color, playerColor }: { review: GameReview; color: Color; playerColor: Color }) {
  const rating = review.headers[color === 'w' ? 'WhiteElo' : 'BlackElo']
  return (
    <div className="flex items-center gap-2 text-[0.95rem]">
      <span aria-hidden className={cn('size-3.5 rounded-[3px] ring-1 ring-paper/40', color === 'w' ? 'bg-paper' : 'bg-[#0c1d1b]')} />
      <span className="truncate font-medium" translate="no">
        {playerName(review, color)}
      </span>
      {rating && rating !== '?' && <span className="text-muted-foreground tabular-nums">({rating})</span>}
      {color === playerColor && <span className="text-muted-foreground">você</span>}
    </div>
  )
}

function NavButton({
  label,
  children,
  primary,
  className,
  ...props
}: React.ComponentProps<'button'> & { label: string; primary?: boolean }) {
  return (
    <Button
      variant={primary ? 'default' : 'secondary'}
      size="icon-lg"
      aria-label={label}
      title={label}
      className={cn('size-11 [&_svg:not([class*=size-])]:size-5', primary && 'w-16', className)}
      {...props}
    >
      {children}
    </Button>
  )
}

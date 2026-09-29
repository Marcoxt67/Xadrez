import { Chess, type Color, type Move, type PieceSymbol, type Square } from 'chess.js'
import { Engine, type EngineLine, type Score } from './engine'

export type Classification =
  | 'brilliant'
  | 'great'
  | 'best'
  | 'excellent'
  | 'good'
  | 'book'
  | 'inaccuracy'
  | 'mistake'
  | 'miss'
  | 'blunder'

export const CLASSIFICATION_ORDER: Classification[] = [
  'brilliant',
  'great',
  'best',
  'excellent',
  'good',
  'book',
  'inaccuracy',
  'mistake',
  'miss',
  'blunder',
]

type PositionEval = {
  fen: string
  lines: EngineLine[]
  terminal: 'checkmate' | 'draw' | null
  /** Chance de vitória das brancas (0–1) */
  whiteWin: number
  /** Avaliação do ponto de vista das brancas, para exibir */
  whiteScore: Score
}

export type AnalyzedMove = {
  ply: number
  color: Color
  moveNumber: number
  san: string
  uci: string
  from: Square
  to: Square
  fenBefore: string
  fenAfter: string
  classification: Classification
  forced: boolean
  /** Melhor lance segundo o motor, se diferente do jogado */
  best: { san: string; from: Square; to: Square; line: string[] } | null
  /** Chance de vitória de quem jogou, antes (com o melhor lance) e depois do lance */
  winBefore: number
  winAfter: number
  accuracy: number
  whiteScoreAfter: Score
  whiteWinAfter: number
  /** Mate disponível para quem jogou antes do lance (em lances), se houver */
  mateAvailable: number | null
  /** Mate que o adversário ganhou depois do lance, se houver */
  mateAllowed: number | null
  sacrifice: PieceSymbol | null
  opening: string | null
}

export type GameReview = {
  headers: Record<string, string>
  startFen: string
  startWhiteWin: number
  startWhiteScore: Score
  moves: AnalyzedMove[]
  opening: string | null
  accuracy: Record<Color, number>
  counts: Record<Color, Record<Classification, number>>
  result: string
}

const PIECE_VALUE: Record<PieceSymbol, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 }

export function winChance(score: Score): number {
  if (score.type === 'mate') return score.value > 0 ? 1 : 0
  return 1 / (1 + Math.exp(-0.00368208 * score.value))
}

const flip = (score: Score): Score => ({ type: score.type, value: -score.value })

// Precisão por lance (fórmula do Lichess, baseada na perda de chance de vitória)
function moveAccuracy(winLoss: number) {
  const raw = 103.1668 * Math.exp(-0.04354 * winLoss * 100) - 3.1669
  return Math.min(100, Math.max(0, raw))
}

function gameAccuracy(values: number[]) {
  if (values.length === 0) return 100
  const mean = values.reduce((a, b) => a + b, 0) / values.length
  const harmonic = values.length / values.reduce((a, v) => a + 1 / Math.max(v, 1), 0)
  return (mean + harmonic) / 2
}

const epd = (fen: string) => fen.split(' ').slice(0, 4).join(' ')

/**
 * Troca estática (SEE): quanto material o lado atacante ganha capturando em uma casa,
 * com as duas partes recapturando sempre com a peça mais barata e podendo parar a qualquer momento.
 */
function staticExchange(target: number, attackers: number[], defenders: number[]) {
  const sides = [[...attackers].sort((a, b) => a - b), [...defenders].sort((a, b) => a - b)]
  const gain = [target]
  let capturer = sides[0].shift()
  let side = 1
  let d = 0
  while (capturer !== undefined) {
    d++
    gain[d] = capturer - gain[d - 1]
    if (Math.max(-gain[d - 1], gain[d]) < 0) break
    capturer = sides[side].shift()
    side ^= 1
  }
  while (--d > 0) gain[d - 1] = -Math.max(-gain[d - 1], gain[d])
  return Math.max(0, gain[0])
}

// O rei entra na troca por último: só captura se não houver mais nada defendendo
const exchangeValue = (type: PieceSymbol) => (type === 'k' ? 50 : PIECE_VALUE[type])

/** Maior material que `color` pode perder em uma troca na posição (peças de 3+ pontos). */
function hangingMaterial(chess: Chess, color: Color) {
  const enemy: Color = color === 'w' ? 'b' : 'w'
  let worst = 0
  let piece: PieceSymbol | null = null
  for (const row of chess.board()) {
    for (const cell of row) {
      if (!cell || cell.color !== color || PIECE_VALUE[cell.type] < 3) continue
      const attackers = chess.attackers(cell.square, enemy).map((sq) => exchangeValue(chess.get(sq)!.type))
      if (attackers.length === 0) continue
      const defenders = chess.attackers(cell.square, color).map((sq) => exchangeValue(chess.get(sq)!.type))
      const loss = staticExchange(PIECE_VALUE[cell.type], attackers, defenders)
      if (loss > worst) {
        worst = loss
        piece = cell.type
      }
    }
  }
  return { value: worst, piece }
}

/** Uma peça (3+ pontos) fica entregue depois do lance, valendo mais do que o que foi capturado. */
function detectSacrifice(move: Move): PieceSymbol | null {
  const before = hangingMaterial(new Chess(move.before), move.color)
  const after = hangingMaterial(new Chess(move.after), move.color)
  const captured = move.captured ? PIECE_VALUE[move.captured] : 0
  if (after.value > before.value && after.value - captured >= 1) return after.piece
  return null
}

function uciToSanLine(fen: string, pv: string[], max = 5) {
  const chess = new Chess(fen)
  const out: string[] = []
  for (const uci of pv.slice(0, max)) {
    try {
      out.push(chess.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] }).san)
    } catch {
      break
    }
  }
  return out
}

const uciOf = (m: Move) => m.from + m.to + (m.promotion ?? '')

export async function reviewGame(
  pgn: string,
  opts: { depth: number; onProgress?: (done: number, total: number, fen: string) => void; signal?: AbortSignal },
): Promise<GameReview> {
  const game = new Chess()
  try {
    game.loadPgn(pgn.trim())
  } catch {
    throw new Error('Não consegui ler esse PGN. Confira se você colou a partida inteira, com os lances.')
  }
  const moves = game.history({ verbose: true })
  if (moves.length === 0) throw new Error('Esse PGN não tem lances. Cole uma partida com pelo menos um lance.')

  const headers = game.getHeaders() as Record<string, string>
  const startFen = moves[0].before

  // Estado terminal de cada posição (precisa do histórico para detectar repetição)
  const replay = new Chess(startFen)
  const terminal: PositionEval['terminal'][] = [null]
  for (const m of moves) {
    replay.move(m.san)
    terminal.push(replay.isCheckmate() ? 'checkmate' : replay.isDraw() ? 'draw' : null)
  }

  const fens = [startFen, ...moves.map((m) => m.after)]
  const engine = new Engine()
  const abort = () => engine.terminate()
  opts.signal?.addEventListener('abort', abort)

  const openingsPromise = import('@/data/openings.json').then((m) => m.default as Record<string, string>)

  const evals: PositionEval[] = []
  try {
    for (let i = 0; i < fens.length; i++) {
      const fen = fens[i]
      const turn = fen.split(' ')[1] as Color
      let lines: EngineLine[] = []
      let whiteScore: Score
      if (terminal[i] === 'checkmate') {
        whiteScore = { type: 'mate', value: 0 }
      } else if (terminal[i] === 'draw') {
        whiteScore = { type: 'cp', value: 0 }
      } else {
        lines = await engine.analyze(fen, opts.depth, 2)
        const s = lines[0]?.score ?? { type: 'cp', value: 0 }
        whiteScore = turn === 'w' ? s : flip(s)
      }
      const whiteWin =
        terminal[i] === 'checkmate' ? (turn === 'w' ? 0 : 1) : terminal[i] === 'draw' ? 0.5 : winChance(whiteScore)
      evals.push({ fen, lines, terminal: terminal[i], whiteWin, whiteScore })
      opts.onProgress?.(i + 1, fens.length, fen)
    }
  } finally {
    opts.signal?.removeEventListener('abort', abort)
    engine.terminate()
  }

  const openings = await openingsPromise
  let inBook = true
  let opening: string | null = null
  let prevLoss = 0
  const analyzed: AnalyzedMove[] = []

  moves.forEach((move, i) => {
    const before = evals[i]
    const after = evals[i + 1]
    const uci = uciOf(move)
    const bestLine = before.lines[0]
    const winBefore = bestLine ? winChance(bestLine.score) : 0.5

    const matchIdx = before.lines.findIndex((l) => l.move === uci)
    let winAfter: number
    if (matchIdx >= 0) winAfter = winChance(before.lines[matchIdx].score)
    else if (after.terminal === 'checkmate') winAfter = 1
    else if (after.terminal === 'draw') winAfter = 0.5
    else winAfter = 1 - winChance(after.lines[0].score)

    const loss = Math.max(0, winBefore - winAfter)
    const legalCount = new Chess(move.before).moves().length
    const forced = legalCount === 1

    const key = epd(move.after)
    inBook = inBook && key in openings
    if (inBook && openings[key]) opening = openings[key]

    const mateAvailable = bestLine?.score.type === 'mate' && bestLine.score.value > 0 ? bestLine.score.value : null
    const afterScore = after.lines[0]?.score
    const mateAllowed = afterScore?.type === 'mate' && afterScore.value > 0 ? afterScore.value : null
    const keepsMate =
      after.terminal === 'checkmate' ||
      (afterScore?.type === 'mate' && afterScore.value < 0) ||
      (matchIdx >= 0 && before.lines[matchIdx].score.type === 'mate' && before.lines[matchIdx].score.value > 0)

    const prev = moves[i - 1]
    const isRecapture = !!prev?.captured && !!move.captured && prev.to === move.to
    const sacrifice = detectSacrifice(move)

    let classification: Classification
    if (inBook) classification = 'book'
    else if (forced) classification = 'best'
    // Em posição já totalmente ganha, sacrifício só é brilhante se leva a mate forçado
    else if (sacrifice && loss <= 0.02 && winAfter >= 0.45 && (winBefore < 0.98 || keepsMate))
      classification = 'brilliant'
    else if (
      matchIdx === 0 &&
      before.lines.length > 1 &&
      winBefore - winChance(before.lines[1].score) >= 0.15 &&
      !isRecapture &&
      winBefore < 0.98
    )
      classification = 'great'
    else if (matchIdx === 0 || loss <= 0.005) classification = 'best'
    else if (mateAvailable !== null && mateAvailable <= 3 && !keepsMate) classification = 'miss'
    else if (loss >= 0.1 && prevLoss >= 0.1 && winBefore >= 0.6 && winAfter >= 0.35) classification = 'miss'
    else if (loss < 0.02) classification = 'excellent'
    else if (loss < 0.05) classification = 'good'
    else if (loss < 0.1) classification = 'inaccuracy'
    else if (loss < 0.2) classification = 'mistake'
    else classification = 'blunder'

    const showBest = bestLine && bestLine.move !== uci
    const bestSan = showBest ? uciToSanLine(move.before, bestLine.pv) : []

    analyzed.push({
      ply: i + 1,
      color: move.color,
      moveNumber: Number(move.before.split(' ')[5]),
      san: move.san,
      uci,
      from: move.from,
      to: move.to,
      fenBefore: move.before,
      fenAfter: move.after,
      classification,
      forced,
      best:
        showBest && bestSan.length > 0
          ? { san: bestSan[0], from: bestLine.move.slice(0, 2) as Square, to: bestLine.move.slice(2, 4) as Square, line: bestSan }
          : null,
      winBefore,
      winAfter,
      accuracy: moveAccuracy(loss),
      whiteScoreAfter: after.whiteScore,
      whiteWinAfter: after.whiteWin,
      mateAvailable,
      mateAllowed,
      sacrifice: classification === 'brilliant' ? sacrifice : null,
      opening: inBook ? opening : null,
    })
    prevLoss = loss
  })

  const emptyCounts = () =>
    Object.fromEntries(CLASSIFICATION_ORDER.map((c) => [c, 0])) as Record<Classification, number>
  const counts = { w: emptyCounts(), b: emptyCounts() }
  analyzed.forEach((m) => counts[m.color][m.classification]++)

  return {
    headers,
    startFen,
    startWhiteWin: evals[0].whiteWin,
    startWhiteScore: evals[0].whiteScore,
    moves: analyzed,
    opening,
    accuracy: {
      w: gameAccuracy(analyzed.filter((m) => m.color === 'w').map((m) => m.accuracy)),
      b: gameAccuracy(analyzed.filter((m) => m.color === 'b').map((m) => m.accuracy)),
    },
    counts,
    result: headers.Result ?? game.getHeaders().Result ?? '*',
  }
}

export function playerName(review: GameReview, color: Color) {
  const name = review.headers[color === 'w' ? 'White' : 'Black']
  return name && name !== '?' ? name : color === 'w' ? 'Brancas' : 'Pretas'
}

/** Texto curto da avaliação do ponto de vista das brancas: "+1,4", "−0,3", "M3", "−M2" */
export function formatScore(score: Score): string {
  if (score.type === 'mate') {
    if (score.value === 0) return '#'
    return `${score.value < 0 ? '−' : ''}M${Math.abs(score.value)}`
  }
  const pawns = score.value / 100
  const text = Math.abs(pawns).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
  if (text === '0,0') return '0,0'
  return `${pawns > 0 ? '+' : '−'}${text}`
}

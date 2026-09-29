// Stockfish 19 (versão "lite single-threaded") rodando num Web Worker.
// Não precisa de cabeçalhos COOP/COEP, então funciona em qualquer hospedagem estática.

export type Score = { type: 'cp' | 'mate'; value: number }

export type EngineLine = {
  /** Lance em notação UCI, ex.: "e2e4" */
  move: string
  /** Avaliação do ponto de vista de quem joga na posição */
  score: Score
  pv: string[]
}

type Job = {
  fen: string
  depth: number
  multiPv: number
  resolve: (lines: EngineLine[]) => void
  reject: (error: Error) => void
}

const ENGINE_URL = '/engine/stockfish-19-lite-single.js'

export class Engine {
  private worker: Worker
  private ready: Promise<void>
  private queue: Job[] = []
  private current: Job | null = null
  private lines = new Map<number, EngineLine>()

  constructor() {
    this.worker = new Worker(ENGINE_URL)
    this.ready = new Promise((resolve, reject) => {
      const onBoot = (event: MessageEvent<string>) => {
        if (event.data === 'uciok') {
          this.worker.removeEventListener('message', onBoot)
          this.worker.addEventListener('message', (e) => this.onMessage(e.data))
          resolve()
        }
      }
      this.worker.addEventListener('message', onBoot)
      this.worker.addEventListener('error', () =>
        reject(new Error('O motor de análise não carregou. Recarregue a página e tente de novo.')),
      )
    })
    this.worker.postMessage('uci')
  }

  analyze(fen: string, depth: number, multiPv = 2): Promise<EngineLine[]> {
    return new Promise((resolve, reject) => {
      this.queue.push({ fen, depth, multiPv, resolve, reject })
      void this.next()
    })
  }

  terminate() {
    this.worker.terminate()
    const error = new Error('Análise cancelada.')
    this.current?.reject(error)
    this.queue.forEach((job) => job.reject(error))
    this.queue = []
    this.current = null
  }

  private async next() {
    if (this.current || this.queue.length === 0) return
    const job = this.queue.shift()!
    this.current = job
    try {
      await this.ready
    } catch (error) {
      this.current = null
      job.reject(error as Error)
      return
    }
    this.lines.clear()
    this.worker.postMessage(`setoption name MultiPV value ${job.multiPv}`)
    this.worker.postMessage(`position fen ${job.fen}`)
    this.worker.postMessage(`go depth ${job.depth}`)
  }

  private onMessage(line: string) {
    if (!this.current) return
    if (line.startsWith('info') && line.includes(' pv ')) {
      const parsed = parseInfo(line)
      if (parsed) this.lines.set(parsed.rank, parsed.line)
    } else if (line.startsWith('bestmove')) {
      const job = this.current
      const ranked = [...this.lines.entries()].sort((a, b) => a[0] - b[0]).map(([, l]) => l)
      this.current = null
      job.resolve(ranked)
      void this.next()
    }
  }
}

function parseInfo(line: string): { rank: number; line: EngineLine } | null {
  const tokens = line.split(' ')
  const at = (key: string) => tokens.indexOf(key)
  const scoreAt = at('score')
  const pvAt = at('pv')
  if (scoreAt < 0 || pvAt < 0) return null
  // Resultados parciais ("lowerbound"/"upperbound") são descartados.
  if (tokens[scoreAt + 3] === 'lowerbound' || tokens[scoreAt + 3] === 'upperbound') return null
  const rank = at('multipv') >= 0 ? Number(tokens[at('multipv') + 1]) : 1
  const pv = tokens.slice(pvAt + 1)
  return {
    rank,
    line: {
      move: pv[0],
      pv,
      score: { type: tokens[scoreAt + 1] as Score['type'], value: Number(tokens[scoreAt + 2]) },
    },
  }
}

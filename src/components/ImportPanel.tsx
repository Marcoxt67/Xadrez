import type { Color } from 'chess.js'
import { useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { fetchRecentGames, resultFor, TIME_CLASS_LABEL, type ChessComGame } from '@/lib/chesscom'
import { cn } from '@/lib/utils'

// A "Partida da Ópera" (Paris, 1858): domínio público e cheia de sacrifícios
const SAMPLE_PGN = `[Event "Paris"]
[Date "1858.??.??"]
[White "Paul Morphy"]
[Black "Duque de Brunswick e Conde Isouard"]
[Result "1-0"]

1. e4 e5 2. Nf3 d6 3. d4 Bg4 4. dxe5 Bxf3 5. Qxf3 dxe5 6. Bc4 Nf6 7. Qb3 Qe7
8. Nc3 c6 9. Bg5 b5 10. Nxb5 cxb5 11. Bxb5+ Nbd7 12. O-O-O Rd8 13. Rxd7 Rxd7
14. Rd1 Qe6 15. Bxd7+ Nxd7 16. Qb8+ Nxb8 17. Rd8# 1-0`

const USER_KEY = 'beth:chesscom-user'

function readUser() {
  try {
    return localStorage.getItem(USER_KEY) ?? ''
  } catch {
    return ''
  }
}

export function ImportPanel({ onAnalyze }: { onAnalyze: (pgn: string, color: Color) => void }) {
  const [tab, setTab] = useState<string>(() => (readUser() ? 'chesscom' : 'pgn'))
  return (
    <Tabs value={tab} onValueChange={(v) => setTab(String(v))} className="gap-4">
      <TabsList className="h-10 w-full bg-ink/8">
        <TabsTrigger value="pgn" className="text-ink/70 hover:text-ink data-active:bg-ink data-active:text-paper">
          Colar PGN
        </TabsTrigger>
        <TabsTrigger value="chesscom" className="text-ink/70 hover:text-ink data-active:bg-ink data-active:text-paper">
          Buscar no Chess.com
        </TabsTrigger>
      </TabsList>
      <TabsContent value="pgn">
        <PgnForm onAnalyze={onAnalyze} />
      </TabsContent>
      <TabsContent value="chesscom">
        <ChessComForm onAnalyze={onAnalyze} />
      </TabsContent>
    </Tabs>
  )
}

const fieldClass =
  'border-ink/25 bg-white/55 text-ink placeholder:text-ink/45 focus-visible:border-ink/60 focus-visible:ring-ink/20 dark:bg-white/55'

function PgnForm({ onAnalyze }: { onAnalyze: (pgn: string, color: Color) => void }) {
  const [pgn, setPgn] = useState('')
  const [color, setColor] = useState<Color>('w')
  const [error, setError] = useState('')
  const fieldRef = useRef<HTMLTextAreaElement>(null)

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault()
        if (!pgn.trim()) {
          setError('Cole o PGN da partida no campo acima.')
          fieldRef.current?.focus()
          return
        }
        setError('')
        onAnalyze(pgn, color)
      }}
    >
      <div className="space-y-1.5">
        <label htmlFor="pgn" className="text-sm font-medium">
          PGN da partida
        </label>
        <Textarea
          ref={fieldRef}
          id="pgn"
          name="pgn"
          value={pgn}
          onChange={(e) => setPgn(e.target.value)}
          rows={6}
          spellCheck={false}
          autoComplete="off"
          translate="no"
          placeholder={'1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 …'}
          aria-invalid={!!error || undefined}
          aria-describedby={error ? 'pgn-error' : 'pgn-help'}
          className={cn('min-h-32 font-mono text-sm', fieldClass)}
        />
        <p id="pgn-help" className="text-sm text-ink/65">
          No Chess.com ou no Lichess, abra a partida e use Compartilhar › PGN.{' '}
          <button
            type="button"
            className="font-medium text-ink underline underline-offset-2 hover:no-underline"
            onClick={() => {
              setPgn(SAMPLE_PGN)
              setColor('w')
              setError('')
            }}
          >
            Usar uma partida de exemplo
          </button>
        </p>
        {error && (
          <p id="pgn-error" role="alert" className="text-sm font-medium text-[#a3281f]">
            {error}
          </p>
        )}
      </div>
      <ColorPicker value={color} onChange={setColor} />
      <Button type="submit" size="lg" className="h-11 w-full bg-ink text-base text-paper hover:bg-ink/85">
        Analisar partida
      </Button>
    </form>
  )
}

function ColorPicker({ value, onChange }: { value: Color; onChange: (c: Color) => void }) {
  return (
    <fieldset>
      <legend className="mb-1.5 text-sm font-medium">Você jogou de</legend>
      <div className="grid grid-cols-2 gap-2">
        {(['w', 'b'] as const).map((c) => (
          <label
            key={c}
            className={cn(
              'flex h-10 cursor-pointer items-center justify-center gap-2 rounded-lg border text-[0.95rem] has-focus-visible:ring-3 has-focus-visible:ring-ink/25',
              value === c ? 'border-ink bg-ink text-paper' : 'border-ink/25 hover:bg-ink/5',
            )}
          >
            <input type="radio" name="color" value={c} checked={value === c} onChange={() => onChange(c)} className="sr-only" />
            <span
              aria-hidden
              className={cn('size-3.5 rounded-[3px] ring-1 ring-ink/40', c === 'w' ? 'bg-white' : 'bg-[#0c1d1b]')}
            />
            {c === 'w' ? 'Brancas' : 'Pretas'}
          </label>
        ))}
      </div>
    </fieldset>
  )
}

function ChessComForm({ onAnalyze }: { onAnalyze: (pgn: string, color: Color) => void }) {
  const [username, setUsername] = useState(readUser)
  const [games, setGames] = useState<ChessComGame[] | null>(null)
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle')
  const [error, setError] = useState('')
  const [searched, setSearched] = useState('')

  const search = async () => {
    const user = username.trim()
    if (!user) {
      setStatus('error')
      setError('Digite o seu nome de usuário do Chess.com.')
      return
    }
    setStatus('loading')
    setError('')
    try {
      const found = await fetchRecentGames(user)
      setGames(found)
      setSearched(user)
      setStatus('idle')
      try {
        localStorage.setItem(USER_KEY, user)
      } catch {
        /* armazenamento indisponível: só não lembra o usuário */
      }
    } catch (err) {
      setStatus('error')
      setError(err instanceof Error ? err.message : 'Não consegui buscar as partidas.')
    }
  }

  const dateFormat = new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'short' })

  return (
    <div className="space-y-4">
      <form
        className="space-y-1.5"
        onSubmit={(e) => {
          e.preventDefault()
          void search()
        }}
      >
        <label htmlFor="chesscom-user" className="text-sm font-medium">
          Usuário do Chess.com
        </label>
        <div className="flex gap-2">
          <Input
            id="chesscom-user"
            name="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            translate="no"
            placeholder="ex.: hikaru…"
            aria-invalid={status === 'error' || undefined}
            aria-describedby={status === 'error' ? 'chesscom-error' : undefined}
            className={cn('h-11 text-base', fieldClass)}
          />
          <Button type="submit" size="lg" disabled={status === 'loading'} className="h-11 bg-ink px-4 text-base text-paper hover:bg-ink/85">
            {status === 'loading' ? 'Buscando…' : 'Buscar'}
          </Button>
        </div>
        {status === 'error' && (
          <p id="chesscom-error" role="alert" className="text-sm font-medium text-[#a3281f]">
            {error}
          </p>
        )}
      </form>

      {games && games.length === 0 && (
        <p className="text-sm text-ink/70">Não achei partidas recentes de xadrez clássico para esse usuário.</p>
      )}

      {games && games.length > 0 && (
        <div>
          <p className="mb-2 text-sm text-ink/65">Escolha a partida para analisar:</p>
          <ul className="-mx-1 max-h-72 overflow-y-auto overscroll-contain px-1">
            {games.map((g) => {
              const meWhite = g.white.username.toLowerCase() === searched.toLowerCase()
              const me = meWhite ? g.white : g.black
              const opp = meWhite ? g.black : g.white
              const result = resultFor(g, searched)
              return (
                <li key={g.url}>
                  <button
                    type="button"
                    onClick={() => onAnalyze(g.pgn, meWhite ? 'w' : 'b')}
                    className="flex min-h-12 w-full items-center gap-3 rounded-md px-2 py-1.5 text-left outline-none hover:bg-ink/6 focus-visible:ring-3 focus-visible:ring-ink/25"
                  >
                    <span
                      aria-hidden
                      className={cn('size-3 shrink-0 rounded-[2px] ring-1 ring-ink/40', meWhite ? 'bg-white' : 'bg-[#0c1d1b]')}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium" translate="no">
                        {opp.username} <span className="font-normal text-ink/60 tabular-nums">({opp.rating})</span>
                      </span>
                      <span className="block text-sm text-ink/60">
                        {TIME_CLASS_LABEL[g.timeClass] ?? g.timeClass}, {dateFormat.format(new Date(g.endTime * 1000))}, seu rating {me.rating}
                      </span>
                    </span>
                    <span
                      className={cn(
                        'shrink-0 rounded-sm px-1.5 py-0.5 text-sm font-medium',
                        result === 'win' && 'bg-[#86b83e]/30',
                        result === 'loss' && 'bg-[#d9463c]/20',
                        result === 'draw' && 'bg-ink/10',
                      )}
                    >
                      {result === 'win' ? 'Vitória' : result === 'loss' ? 'Derrota' : 'Empate'}
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </div>
  )
}

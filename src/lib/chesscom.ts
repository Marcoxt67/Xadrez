// API pública do Chess.com: https://www.chess.com/news/view/published-data-api
export type ChessComGame = {
  url: string
  pgn: string
  endTime: number
  timeClass: string
  white: { username: string; rating: number; result: string }
  black: { username: string; rating: number; result: string }
}

type RawGame = {
  url: string
  pgn?: string
  end_time: number
  time_class: string
  rules: string
  white: { username: string; rating: number; result: string }
  black: { username: string; rating: number; result: string }
}

export async function fetchRecentGames(username: string, limit = 20): Promise<ChessComGame[]> {
  const user = username.trim().toLowerCase()
  const res = await fetch(`https://api.chess.com/pub/player/${encodeURIComponent(user)}/games/archives`)
  if (res.status === 404) throw new Error(`Não encontrei o usuário “${username.trim()}” no Chess.com. Confira a grafia.`)
  if (!res.ok) throw new Error('O Chess.com não respondeu agora. Tente de novo em alguns segundos.')
  const { archives } = (await res.json()) as { archives: string[] }
  if (!archives?.length) throw new Error('Esse usuário ainda não tem partidas públicas no Chess.com.')

  const games: ChessComGame[] = []
  // Os arquivos são mensais; percorre do mês mais recente para trás até juntar o suficiente
  for (const archive of [...archives].reverse().slice(0, 3)) {
    const monthly = (await (await fetch(archive)).json()) as { games: RawGame[] }
    const standard = monthly.games
      .filter((g) => g.rules === 'chess' && g.pgn)
      .map((g) => ({
        url: g.url,
        pgn: g.pgn!,
        endTime: g.end_time,
        timeClass: g.time_class,
        white: g.white,
        black: g.black,
      }))
    games.push(...standard.reverse())
    if (games.length >= limit) break
  }
  return games.slice(0, limit)
}

export const TIME_CLASS_LABEL: Record<string, string> = {
  bullet: 'Bullet',
  blitz: 'Blitz',
  rapid: 'Rápida',
  daily: 'Diária',
  classical: 'Clássica',
}

export function resultFor(game: ChessComGame, username: string): 'win' | 'loss' | 'draw' {
  const me = game.white.username.toLowerCase() === username.trim().toLowerCase() ? game.white : game.black
  if (me.result === 'win') return 'win'
  if (['agreed', 'repetition', 'stalemate', 'insufficient', '50move', 'timevsinsufficient'].includes(me.result)) return 'draw'
  return 'loss'
}

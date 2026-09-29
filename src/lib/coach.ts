// Comentários da treinadora Beth Harmon: diretos, secos e sempre com o lance certo na mão.
import type { Color, PieceSymbol } from 'chess.js'
import { formatScore, type AnalyzedMove, type GameReview } from './analysis'

const PIECE_LETTER: Record<string, string> = { N: 'C', B: 'B', R: 'T', Q: 'D', K: 'R' }

/** Converte SAN inglês para notação brasileira: Nf3 → Cf3, Qxd5 → Dxd5, e8=Q → e8=D */
export function sanPt(san: string) {
  return san.replace(/[NBRQK]/g, (letter) => PIECE_LETTER[letter])
}

const PIECE_NAME: Record<PieceSymbol, string> = {
  p: 'um peão',
  n: 'um cavalo',
  b: 'um bispo',
  r: 'uma torre',
  q: 'a dama',
  k: 'o rei',
}

const pick = <T,>(options: T[], seed: number) => options[seed % options.length]

/** Avaliação do ponto de vista de quem jogou, a partir da chance de vitória */
function moverEval(win: number) {
  if (win >= 0.999) return 'vitória'
  if (win <= 0.001) return 'derrota'
  const cp = Math.log(win / (1 - win)) / 0.00368208
  return formatScore({ type: 'cp', value: Math.round(cp) })
}

function standing(win: number) {
  if (win >= 0.9) return 'ganha'
  if (win >= 0.7) return 'com boa vantagem'
  if (win >= 0.56) return 'um pouco melhor'
  if (win > 0.44) return 'equilibrada'
  if (win > 0.3) return 'um pouco pior'
  if (win > 0.1) return 'difícil'
  return 'perdida'
}

export function coachComment(move: AnalyzedMove, playerColor: Color): string {
  const san = sanPt(move.san)
  const best = move.best ? sanPt(move.best.san) : san
  const before = moverEval(move.winBefore)
  const after = moverEval(move.winAfter)
  const seed = move.ply
  const mine = move.color === playerColor

  if (!mine) return opponentComment(move, san, best, seed)

  switch (move.classification) {
    case 'brilliant':
      return pick(
        [
          `${san}! Você entregou ${PIECE_NAME[move.sacrifice ?? 'n']} e a posição só melhorou. É esse tipo de lance que decide torneios.`,
          `Brilhante. ${san} parece um presente, mas o adversário não pode aceitar sem pagar caro.`,
        ],
        seed,
      )
    case 'great':
      return pick(
        [
          `${san} era o único lance que segurava tudo. Qualquer outro deixava a vantagem escapar.`,
          `Você achou o lance difícil. Aqui só ${san} funcionava.`,
        ],
        seed,
      )
    case 'best':
      if (move.forced) return 'Era o único lance legal. Não havia o que pensar.'
      return pick([`${san} é exatamente o que eu jogaria.`, 'Melhor lance. Nada a acrescentar.', `Preciso. ${san} é a escolha do motor.`], seed)
    case 'excellent':
      return pick(
        [`Muito bom. ${best} era um fio mais preciso, mas a ideia é a mesma.`, `Lance forte. A diferença para ${best} é mínima.`],
        seed,
      )
    case 'good':
      return pick([`Razoável. ${best} mantinha mais pressão.`, `Lance sólido, mas ${best} era mais incisivo.`], seed)
    case 'book':
      return move.opening
        ? `Ainda na teoria: ${move.opening}. Guarde a energia para o meio-jogo.`
        : 'Lance de livro. Nada para corrigir aqui.'
    case 'inaccuracy':
      return pick(
        [
          `Impreciso. ${best} era melhor, e a avaliação caiu de ${before} para ${after}.`,
          `Dá para melhorar. Com ${best} a sua posição ficava mais firme.`,
        ],
        seed,
      )
    case 'mistake':
      return pick(
        [
          `Isso é um erro. O certo era ${best}. Depois de ${san}, a avaliação foi de ${before} para ${after}.`,
          `Aqui a partida escorregou. ${best} mantinha a posição ${standing(move.winBefore)}.`,
        ],
        seed,
      )
    case 'miss':
      if (move.mateAvailable)
        return `Tinha mate em ${move.mateAvailable} começando com ${best}. Olhe primeiro os xeques, as capturas e as ameaças.`
      return `Seu adversário errou no lance anterior e ${san} deixou a chance passar. ${best} era o jeito de punir.`
    case 'blunder':
      if (move.mateAllowed)
        return `Capivarada. Depois de ${san}, o adversário tem mate em ${move.mateAllowed}. Precisava de ${best}.`
      return pick(
        [
          `Capivarada. A avaliação despencou de ${before} para ${after}. ${best} era o lance.`,
          `Esse lance entrega a partida. Antes de jogar, pergunte o que o adversário quer. O certo era ${best}.`,
        ],
        seed,
      )
  }
}

function opponentComment(move: AnalyzedMove, san: string, best: string, seed: number): string {
  switch (move.classification) {
    case 'brilliant':
      return `${san} foi brilhante da parte do seu adversário. Vale estudar essa ideia.`
    case 'great':
      return `Seu adversário achou o único lance bom: ${san}.`
    case 'best':
      return pick([`${san}: lance perfeito do seu adversário.`, `Seu adversário jogou o melhor lance, ${san}.`], seed)
    case 'excellent':
      return `${san}: lance excelente do seu adversário.`
    case 'good':
      return `${san}: lance sólido do seu adversário.`
    case 'book':
      return move.opening ? `Teoria: ${move.opening}.` : `${san} ainda é teoria.`
    case 'inaccuracy':
      return `Seu adversário foi impreciso com ${san}. Para ele, ${best} era melhor.`
    case 'mistake':
      return `${san} é um erro do seu adversário. Havia uma chance de punir no lance seguinte.`
    case 'miss':
      return `Seu adversário deixou passar ${best}. Sorte sua.`
    case 'blunder':
      return `Capivarada do seu adversário. Depois de ${san}, a posição dele ficou ${standing(move.winAfter)}.`
  }
}

/** O lance do jogador que mais custou (perda de pelo menos 10% de chance de vitória) */
export function decisiveMove(review: GameReview, playerColor: Color): AnalyzedMove | null {
  return review.moves
    .filter((m) => m.color === playerColor)
    .reduce<AnalyzedMove | null>((w, m) => (m.winBefore - m.winAfter > (w ? w.winBefore - w.winAfter : 0.1) ? m : w), null)
}

export function summaryComment(review: GameReview, playerColor: Color): string {
  const accuracy = review.accuracy[playerColor]
  const pct = accuracy.toLocaleString('pt-BR', { maximumFractionDigits: 1 })
  const counts = review.counts[playerColor]
  const errors = counts.blunder + counts.mistake + counts.miss

  const parts: string[] = []
  if (accuracy >= 90) parts.push(`Partida muito limpa: ${pct}% de precisão. Poucos jogadores sustentam esse nível.`)
  else if (accuracy >= 80) parts.push(`Boa partida, com ${pct}% de precisão. Os pontos para revisar são poucos.`)
  else if (accuracy >= 65)
    parts.push(`Partida irregular, com ${pct}% de precisão. Você tem boas ideias, mas ${errors === 1 ? 'um lance custou' : `${errors} lances custaram`} caro.`)
  else parts.push(`Foi uma partida difícil: ${pct}% de precisão. Vamos ver com calma onde ela escapou.`)

  const worst = decisiveMove(review, playerColor)
  if (worst)
    parts.push(`O momento decisivo foi o lance ${worst.moveNumber}, ${sanPt(worst.san)}. Comece a revisão por ele.`)

  if (counts.brilliant > 0)
    parts.push(counts.brilliant === 1 ? 'E você achou um lance brilhante.' : `E você achou ${counts.brilliant} lances brilhantes.`)
  else if (counts.great > 0)
    parts.push(counts.great === 1 ? 'Você também encontrou um lance difícil, o único bom da posição.' : `Você encontrou ${counts.great} lances difíceis, os únicos bons da posição.`)

  return parts.join(' ')
}

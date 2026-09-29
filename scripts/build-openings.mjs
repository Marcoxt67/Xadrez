// Gera src/data/openings.json a partir de github.com/lichess-org/chess-openings (CC0).
// Cada posição (FEN sem contadores) de cada linha de abertura vira uma chave;
// o valor é o nome da abertura quando a posição é o fim de uma linha nomeada.
import { writeFileSync } from 'node:fs'
import { Chess } from 'chess.js'

const BASE = 'https://raw.githubusercontent.com/lichess-org/chess-openings/master/'
const names = {}
const prefixes = new Set()

const epd = (chess) => chess.fen().split(' ').slice(0, 4).join(' ')

for (const file of ['a', 'b', 'c', 'd', 'e']) {
  const text = await (await fetch(`${BASE}${file}.tsv`)).text()
  for (const line of text.trim().split('\n').slice(1)) {
    const [eco, name, pgn] = line.split('\t')
    const chess = new Chess()
    for (const token of pgn.split(/\s+/)) {
      if (/^\d+\.$/.test(token)) continue
      chess.move(token)
      prefixes.add(epd(chess))
    }
    const key = epd(chess)
    if (!names[key] || name.length < names[key].name.length) names[key] = { eco, name }
  }
}

const out = {}
for (const key of prefixes) out[key] = names[key] ? `${names[key].eco} ${names[key].name}` : ''
writeFileSync(new URL('../src/data/openings.json', import.meta.url), JSON.stringify(out))
console.log(`${Object.keys(names).length} aberturas nomeadas, ${prefixes.size} posições de teoria`)

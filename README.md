# Beth Harmon, sua treinadora de xadrez

Site simples para revisar partidas de xadrez: cada lance é avaliado pelo Stockfish e classificado
(Brilhante, Ótimo, Melhor, Excelente, Bom, Teoria, Imprecisão, Erro, Chance perdida, Capivarada),
com a precisão de cada jogador e os comentários da treinadora Beth Harmon.

## Como rodar

```bash
npm install
npm run dev
```

Abra http://localhost:5173, cole o PGN de uma partida ou busque suas partidas pelo usuário do Chess.com.

## Como funciona

- **Motor:** Stockfish 19 (versão lite, WebAssembly) roda no navegador, num Web Worker (`public/engine/`).
  Cada posição é analisada na profundidade 14 com as duas melhores linhas (`src/lib/engine.ts`).
- **Classificação:** baseada na perda de chance de vitória do lance jogado em relação ao melhor lance
  (`src/lib/analysis.ts`). Brilhante = sacrifício correto de peça; Ótimo = único lance bom da posição;
  Chance perdida = não punir o erro do adversário ou deixar passar um mate curto.
- **Teoria:** posições da base aberta de aberturas do Lichess (CC0). Para regenerar:
  `node scripts/build-openings.mjs`.
- **Comentários da Beth:** `src/lib/coach.ts`.
- **Chess.com:** usa a API pública (`src/lib/chesscom.ts`), sem login.

## Licenças

O Stockfish.js é GPLv3. Se você publicar o site, publique também o código-fonte.
As peças do tabuleiro vêm do `react-chessboard` (MIT).

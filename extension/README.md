# Knightly browser extension

This folder contains the browser extension UI and board adapter. The extension manifest is at the repository root so engine assets under `public/engine/` can be packaged without duplicating the large files.

## Supported sites
- Chess.com
- Lichess
- WorldChess.com

## Install locally (Chrome / Chromium)
1. Open `chrome://extensions`.
2. Enable **Developer mode**.
3. Choose **Load unpacked** and select the repository root (the folder containing `manifest.json`).
4. Open a supported chess site and reload it.
5. Open the Knightly extension popup.

## Features
- SVG arrows between squares, using board geometry and a flipped-board orientation check.
- Attempts to read a FEN only when a finished game or analysis/review page is detected.
- Manual FEN input for positions that the website does not expose in stable DOM attributes.
- Stockfish UCI worker analysis from the engine assets already in `public/engine/`.
- No automated moves, no page clicks, and no live-game engine suggestions.

## Important engine packaging check
Some engine assets in this repository may be placeholders or deployment-generated files. If Stockfish reports a WASM loading/compile error, inspect `public/engine/stockfish.wasm` and the matching part files; the extension cannot repair missing binaries automatically. Keep all existing engine/license files intact.

## Site compatibility
Chess sites change their DOM frequently. The adapter uses public board elements and FEN attributes when available; where a site's current FEN is not exposed, copy the FEN from the site's review/analysis UI and paste it into the popup. The extension deliberately restricts engine analysis to finished games/review pages to respect fair-play rules.

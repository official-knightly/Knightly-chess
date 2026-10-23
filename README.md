# Knightly Chess Tools

Knightly is being converted from a standalone chess website into a browser extension. The extension adds SVG move arrows and post-game engine analysis on Chess.com, Lichess, and WorldChess.com.

## Preserved engines

Engine files remain in the repository, including Stockfish, Dragon, Rodent, and Andromeda:
- `public/engine/` — Stockfish, Dragon, Rodent, supporting NNUE/WASM files, and opening book
- `src/engine/` — Andromeda and Stockfish integration/source files
- `stockfish-gui/public/engine/` — the existing Stockfish 19 Lite worker asset
- `LICENSE`, `ATTRIBUTIONS`, `.gitattributes`, and `stockfish-gui/LICENSE.md` are retained for licensing and attribution

## Install the extension locally

1. Download/clone this repository and ensure Git LFS is installed.
2. Run `git lfs install` and `git lfs pull` in the repository directory so engine WASM files are actual binaries rather than small LFS pointer text files.
3. Open `chrome://extensions` in Chrome or a Chromium browser.
4. Enable **Developer mode**.
5. Click **Load unpacked** and select the repository root (the folder containing `manifest.json`).
6. Open Chess.com, Lichess, or WorldChess.com and reload the tab.
7. Open the Knightly extension popup.

## Features

- Draw and clear arrows between algebraic squares such as `e2` and `e4`.
- Corrects square coordinates for a detected flipped board.
- Includes Stockfish, Dragon, and Rodent UCI worker choices.
- Attempts to read a FEN from a finished-game/review page when the site exposes one; otherwise paste a full FEN from the site's analysis tools.
- Engine analysis is restricted to pages detected as finished-game/review/study pages. The extension does not make moves or play automatically.

## Testing and limitations

The manifest JSON and extension JavaScript syntax have been checked. This does not equal a live browser test: the extension still needs to be loaded in Chrome and tested against each site's current DOM. The sites may change their board selectors and FEN exposure. Engine runtime testing also requires real Git LFS WASM assets; the GitHub API may display LFS pointer text instead of the binaries.

If an engine reports a WASM compile/load error, verify that `git lfs pull` completed successfully and that the matching `.wasm` files exist beside their engine scripts. Do not remove engine license/copyright notices when redistributing them.

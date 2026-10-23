(() => {
  "use strict";

  const SVG_NS = "http://www.w3.org/2000/svg";
  const OVERLAY_ID = "knightly-chess-arrow-overlay";
  const BOARD_SELECTORS = [
    "chess-board",
    "cg-board",
    "wc-chess-board",
    "[data-board]",
    ".board"
  ];
  const SITE = location.hostname.includes("lichess") ? "lichess"
    : location.hostname.includes("worldchess") ? "worldchess"
    : location.hostname.includes("chess.com") ? "chesscom" : "unknown";

  function getBoardElement() {
    for (const selector of BOARD_SELECTORS) {
      const nodes = document.querySelectorAll(selector);
      for (const node of nodes) {
        const rect = node.getBoundingClientRect();
        if (rect.width > 80 && rect.height > 80 && Math.abs(rect.width - rect.height) < 8) return node;
      }
    }
    return null;
  }

  function getBoardOrientation(board) {
    const classes = String(board.className?.baseVal || board.className || "");
    const parentClasses = String(board.parentElement?.className || "");
    const bodyClasses = String(document.body.className || "");
    const marker = (classes + " " + parentClasses + " " + bodyClasses).toLowerCase();
    if (/(orientation-black|flipped|orientation-bottom-black|board-black)/.test(marker)) return "black";
    if (board.getAttribute("data-orientation") === "black") return "black";
    return "white";
  }

  function squareCenter(board, square) {
    if (!/^[a-h][1-8]$/.test(square)) throw new Error("Square must be like e2 or e4.");
    const rect = board.getBoundingClientRect();
    const size = Math.min(rect.width, rect.height) / 8;
    const file = square.charCodeAt(0) - 97;
    const rank = Number(square[1]) - 1;
    const orientation = getBoardOrientation(board);
    const col = orientation === "black" ? 7 - file : file;
    const row = orientation === "black" ? rank : 7 - rank;
    return { x: col * size + size / 2, y: row * size + size / 2 };
  }

  function ensureOverlay(board) {
    let svg = board.querySelector("#" + OVERLAY_ID);
    if (svg) return svg;
    const computed = getComputedStyle(board);
    if (computed.position === "static") board.style.position = "relative";
    if (!board.style.overflow) board.style.overflow = "visible";
    svg = document.createElementNS(SVG_NS, "svg");
    svg.id = OVERLAY_ID;
    Object.assign(svg.style, {
      position: "absolute", inset: "0", width: "100%", height: "100%",
      pointerEvents: "none", zIndex: "20", overflow: "visible"
    });
    svg.setAttribute("aria-hidden", "true");
    board.appendChild(svg);
    return svg;
  }

  function drawArrow(fromSquare, toSquare, color = "#ff0055") {
    const board = getBoardElement();
    if (!board) return { ok: false, error: "No supported chessboard found." };
    let from, to;
    try {
      from = squareCenter(board, fromSquare);
      to = squareCenter(board, toSquare);
    } catch (error) {
      return { ok: false, error: error.message };
    }

    const rect = board.getBoundingClientRect();
    const size = Math.min(rect.width, rect.height);
    const svg = ensureOverlay(board);
    svg.setAttribute("viewBox", `0 0 ${rect.width} ${rect.height}`);
    svg.replaceChildren();

    const defs = document.createElementNS(SVG_NS, "defs");
    const marker = document.createElementNS(SVG_NS, "marker");
    const markerId = "knightly-arrowhead";
    marker.id = markerId;
    marker.setAttribute("markerWidth", "7");
    marker.setAttribute("markerHeight", "7");
    marker.setAttribute("refX", "5.5");
    marker.setAttribute("refY", "3.5");
    marker.setAttribute("orient", "auto");
    marker.setAttribute("markerUnits", "strokeWidth");
    const head = document.createElementNS(SVG_NS, "path");
    head.setAttribute("d", "M0,0 L7,3.5 L0,7 Z");
    head.setAttribute("fill", color);
    marker.appendChild(head);
    defs.appendChild(marker);
    svg.appendChild(defs);

    const line = document.createElementNS(SVG_NS, "line");
    line.setAttribute("x1", from.x);
    line.setAttribute("y1", from.y);
    line.setAttribute("x2", to.x);
    line.setAttribute("y2", to.y);
    line.setAttribute("stroke", color);
    line.setAttribute("stroke-width", String(Math.max(3, size / 38)));
    line.setAttribute("stroke-linecap", "round");
    line.setAttribute("opacity", "0.82");
    line.setAttribute("marker-end", `url(#${markerId})`);
    svg.appendChild(line);
    return { ok: true, site: SITE };
  }

  function clearArrows() {
    document.getElementById(OVERLAY_ID)?.remove();
    return { ok: true };
  }

  function isPostGameOrAnalysisPage() {
    const url = location.href.toLowerCase();
    const bodyText = (document.body?.innerText || "").slice(0, 12000).toLowerCase();
    const urlLooksAnalysis = /analysis|review|study|game-review|computer-analysis/.test(url);
    const pageLooksFinished = /game over|game finished|analysis board|review game|computer analysis|resignation|draw agreed|checkmate|you won|you lost/.test(bodyText);
    return urlLooksAnalysis || pageLooksFinished;
  }

  function readFenFromPage() {
    const board = getBoardElement();
    if (!board) return { ok: false, error: "No supported chessboard found." };
    if (!isPostGameOrAnalysisPage()) {
      return { ok: false, error: "Engine analysis is disabled during live games. Open a finished game's review/analysis page." };
    }
    const candidates = [
      board.getAttribute("fen"),
      board.getAttribute("data-fen"),
      board.getAttribute("position"),
      document.querySelector("[data-fen]")?.getAttribute("data-fen"),
      document.querySelector("input[name='fen']")?.value
    ].filter(Boolean);
    const fen = candidates.find(value => value.trim().split(/\s+/).length >= 4);
    if (fen) return { ok: true, fen: fen.trim() };
    return {
      ok: false,
      error: "This site's current FEN is not exposed in a stable public DOM attribute. Copy the position's FEN from the site's analysis/review tools and paste it into Knightly."
    };
  }

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (!message || typeof message.type !== "string") return;
    if (message.type === "KNIGHTLY_DRAW_ARROW") {
      sendResponse(drawArrow(message.from, message.to, message.color));
    } else if (message.type === "KNIGHTLY_CLEAR_ARROWS") {
      sendResponse(clearArrows());
    } else if (message.type === "KNIGHTLY_GET_FEN") {
      sendResponse(readFenFromPage());
    } else if (message.type === "KNIGHTLY_BOARD_STATUS") {
      sendResponse({ ok: !!getBoardElement(), site: SITE, postGame: isPostGameOrAnalysisPage() });
    }
    return true;
  });

  window.addEventListener("resize", () => {
    // Keep the SVG aligned after responsive board resizes; remove stale arrows.
    clearArrows();
  }, { passive: true });
})();
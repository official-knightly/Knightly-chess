(() => {
  "use strict";
  const $ = id => document.getElementById(id);
  let engineWorker = null;
  let engineReady = false;
  let searchActive = false;
  let lastBestMove = null;
  let outputBuffer = [];
  let activeTabId = null;

  function setOutput(text) { $("engine-output").textContent = text; }
  function addOutput(line) {
    outputBuffer.push(line);
    if (outputBuffer.length > 35) outputBuffer = outputBuffer.slice(-35);
    setOutput(outputBuffer.join("\n"));
  }

  async function getActiveTab() {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    return tabs[0] || null;
  }

  async function sendToPage(message) {
    const tab = await getActiveTab();
    if (!tab?.id || !/^https:\/\/(www\.)?(chess\.com|lichess\.org|worldchess\.com)\//.test(tab.url || "")) {
      throw new Error("Open Chess.com, Lichess, or WorldChess first.");
    }
    activeTabId = tab.id;
    return chrome.tabs.sendMessage(tab.id, message);
  }

  async function refreshStatus() {
    try {
      const status = await sendToPage({ type: "KNIGHTLY_BOARD_STATUS" });
      $("site-status").textContent = status.ok
        ? `Board detected · ${status.site} · ${status.postGame ? "review/finished page" : "live/unknown game"}`
        : "No supported chessboard detected on this page.";
    } catch (error) {
      $("site-status").textContent = "Open a supported chess site and reload the page if needed.";
    }
  }

  $("draw").addEventListener("click", async () => {
    const from = $("from").value.trim().toLowerCase();
    const to = $("to").value.trim().toLowerCase();
    if (!/^[a-h][1-8]$/.test(from) || !/^[a-h][1-8]$/.test(to)) {
      setOutput("Use valid squares such as e2 and e4.");
      return;
    }
    try {
      const result = await sendToPage({ type: "KNIGHTLY_DRAW_ARROW", from, to, color: "#ff0055" });
      if (!result?.ok) throw new Error(result?.error || "Could not draw arrow.");
      setOutput(`Arrow drawn: ${from} → ${to}`);
    } catch (error) { setOutput(error.message); }
  });

  $("clear").addEventListener("click", async () => {
    try { await sendToPage({ type: "KNIGHTLY_CLEAR_ARROWS" }); setOutput("Arrows cleared."); }
    catch (error) { setOutput(error.message); }
  });

  $("get-fen").addEventListener("click", async () => {
    try {
      const result = await sendToPage({ type: "KNIGHTLY_GET_FEN" });
      if (!result?.ok) throw new Error(result?.error || "FEN unavailable.");
      $("fen").value = result.fen;
      setOutput("Position FEN read from page.");
    } catch (error) { setOutput(error.message); }
  });

  function stopEngine() {
    if (engineWorker) {
      try { engineWorker.postMessage("stop"); } catch (_) {}
      try { engineWorker.terminate(); } catch (_) {}
    }
    engineWorker = null;
    engineReady = false;
    searchActive = false;
    $("analyze").disabled = false;
    $("stop").disabled = true;
  }

  function validFen(fen) {
    const parts = fen.trim().split(/\s+/);
    return parts.length === 6 && /^[prnbqkPRNBQK1-8/]+$/.test(parts[0]) &&
      /^[wb]$/.test(parts[1]) && /^(-|K?Q?k?q?)$/.test(parts[2]) &&
      /^(-|[a-h][36])$/.test(parts[3]) && /^\d+$/.test(parts[4]) && /^\d+$/.test(parts[5]);
  }

  $("analyze").addEventListener("click", async () => {
    let tab;
    try {
      tab = await getActiveTab();
      if (!tab?.id || !/^https:\/\/(www\.)?(chess\.com|lichess\.org|worldchess\.com)\//.test(tab.url || "")) {
        throw new Error("Open a supported chess site first.");
      }
      const pageStatus = await chrome.tabs.sendMessage(tab.id, { type: "KNIGHTLY_BOARD_STATUS" });
      if (!pageStatus?.postGame) {
        throw new Error("For fair play, engine analysis is disabled during live games. Open a finished game's review/analysis page.");
      }
    } catch (error) {
      setOutput(error.message);
      return;
    }

    const fen = $("fen").value.trim();
    if (!validFen(fen)) {
      setOutput("Enter a complete valid-looking FEN (six space-separated fields).");
      return;
    }
    stopEngine();
    outputBuffer = [];
    lastBestMove = null;
    $("analyze").disabled = true;
    $("stop").disabled = false;
    setOutput("Starting Stockfish…");
    try {
      const workerUrl = chrome.runtime.getURL("public/engine/stockfish.js");
      engineWorker = new Worker(workerUrl);
      engineWorker.onerror = event => {
        addOutput("Engine worker error: " + (event.message || "unknown error"));
        stopEngine();
      };
      engineWorker.onmessage = event => {
        const line = typeof event.data === "string" ? event.data : "";
        if (!line) return;
        if (line === "uciok") {
          engineReady = true;
          engineWorker.postMessage("isready");
        } else if (line === "readyok" && engineReady && !searchActive) {
          searchActive = true;
          engineWorker.postMessage("setoption name Threads value 1");
          engineWorker.postMessage("setoption name MultiPV value 1");
          engineWorker.postMessage("position fen " + fen);
          engineWorker.postMessage("go depth " + $("depth").value);
          addOutput("Analysis running…");
        } else if (line.startsWith("info ") && /\bdepth\s+\d+/.test(line)) {
          const depth = (line.match(/\bdepth\s+(\d+)/) || [])[1] || "?";
          const score = line.match(/\bscore\s+(cp|mate)\s+(-?\d+)/);
          const pv = line.match(/\bpv\s+(.+)/);
          if (pv) addOutput(`Depth ${depth} · ${score ? (score[1] === "cp" ? (Number(score[2]) / 100).toFixed(2) : "Mate " + score[2]) : "eval…"} · ${pv[1]}`);
        } else if (line.startsWith("bestmove ")) {
          lastBestMove = line.split(/\s+/)[1];
          addOutput("Best move: " + lastBestMove);
          searchActive = false;
          $("analyze").disabled = false;
          $("stop").disabled = true;
        } else if (/failed to compile|Aborted\(|wasm streaming compile failed/i.test(line)) {
          addOutput("Engine asset failed to load. Check that the engine's matching WASM files are present.");
        }
      };
      engineWorker.postMessage("uci");
    } catch (error) {
      addOutput("Could not start engine: " + error.message);
      stopEngine();
    }
  });

  $("stop").addEventListener("click", () => {
    if (engineWorker) {
      try { engineWorker.postMessage("stop"); } catch (_) {}
    }
    stopEngine();
    addOutput("Engine stopped.");
  });

  chrome.tabs.onActivated.addListener(refreshStatus);
  refreshStatus();
})();
const SIZE = 10;
const SHIPS = [
  { name: "Porta-aviões", size: 5 },
  { name: "Encouraçado", size: 4 },
  { name: "Cruzador", size: 3 },
  { name: "Submarino", size: 3 },
  { name: "Destroyer", size: 2 },
];

// grid: 0 = água, >0 = id do navio
let grid;

// estado do jogo
let shots = 0;
let hits = 0;
let shipsData = []; // {id,name,size,cells:Set,hit:Set,sunk, horizontal, pieceByCell:Map}
let gameOver = false;
let revealed = false;

// elementos
const boardEl = document.getElementById("board");
const shotsEl = document.getElementById("shots");
const hitsEl = document.getElementById("hits");
const shipsLeftEl = document.getElementById("shipsLeft");
const msgEl = document.getElementById("message");

document.getElementById("newGame").addEventListener("click", newGame);
document.getElementById("reveal").addEventListener("click", toggleReveal);

// helpers
function key(r, c) {
  return `${r},${c}`;
}

function setMessage(text) {
  msgEl.textContent = text;
}

function updateStats() {
  shotsEl.textContent = String(shots);
  hitsEl.textContent = String(hits);
  shipsLeftEl.textContent = String(shipsData.filter(s => !s.sunk).length);
}

function createEmptyGrid() {
  return Array.from({ length: SIZE }, () => Array(SIZE).fill(0));
}

function renderBoard() {
  boardEl.innerHTML = "";
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      const btn = document.createElement("button");
      btn.className = "cell";
      btn.type = "button";
      btn.dataset.r = r;
      btn.dataset.c = c;
      btn.setAttribute("aria-label", `Linha ${r + 1} Coluna ${c + 1}`);
      btn.addEventListener("click", onShoot);
      boardEl.appendChild(btn);
    }
  }
}

function cellEl(r, c) {
  return boardEl.querySelector(`.cell[data-r="${r}"][data-c="${c}"]`);
}

function canPlaceShip(r, c, size, horizontal) {
  if (horizontal) {
    if (c + size > SIZE) return false;
    for (let i = 0; i < size; i++) {
      if (grid[r][c + i] !== 0) return false;
    }
  } else {
    if (r + size > SIZE) return false;
    for (let i = 0; i < size; i++) {
      if (grid[r + i][c] !== 0) return false;
    }
  }
  return true;
}

/**
 * Coloca um navio e cria as "peças" (proa/meio/popa ou topo/meio/base)
 * pieceByCell: Map("r,c" -> classe CSS da peça)
 */
function placeShip(id, name, size) {
  let placed = false;
  let tries = 0;

  while (!placed && tries < 2000) {
    tries++;

    const horizontal = Math.random() < 0.5;
    const r = Math.floor(Math.random() * SIZE);
    const c = Math.floor(Math.random() * SIZE);

    if (!canPlaceShip(r, c, size, horizontal)) continue;

    // lista ordenada das células do navio
    const orderedCells = [];
    for (let i = 0; i < size; i++) {
      const rr = horizontal ? r : r + i;
      const cc = horizontal ? c + i : c;
      grid[rr][cc] = id;
      orderedCells.push([rr, cc]);
    }

    // cria map de peças por célula
    const pieceByCell = new Map();
    orderedCells.forEach(([rr, cc], idx) => {
      const k = key(rr, cc);

      if (horizontal) {
        if (idx === 0) pieceByCell.set(k, "h-left");
        else if (idx === size - 1) pieceByCell.set(k, "h-right");
        else pieceByCell.set(k, "h-mid");
      } else {
        if (idx === 0) pieceByCell.set(k, "v-top");
        else if (idx === size - 1) pieceByCell.set(k, "v-bottom");
        else pieceByCell.set(k, "v-mid");
      }
    });

    shipsData.push({
      id,
      name,
      size,
      cells: new Set(orderedCells.map(([rr, cc]) => key(rr, cc))),
      hit: new Set(),
      sunk: false,
      horizontal,
      pieceByCell,
    });

    placed = true;
  }

  if (!placed) {
    throw new Error("Não foi possível posicionar os navios. Tente novamente.");
  }
}

function setupShips() {
  shipsData = [];
  grid = createEmptyGrid();

  SHIPS.forEach((s, idx) => {
    placeShip(idx + 1, s.name, s.size);
  });
}

/**
 * Mostra a peça dentro da célula (apenas quando acertar/afundar)
 */
function showPiece(r, c, ship) {
  const el = cellEl(r, c);
  if (!el) return;

  // não duplica
  if (el.querySelector(".piece")) return;

  const cls = ship.pieceByCell.get(key(r, c)) || "h-mid";
  const piece = document.createElement("div");
  piece.className = `piece ${cls}`;
  el.appendChild(piece);
}

function markSunk(ship) {
  ship.sunk = true;

  ship.cells.forEach(k => {
    const [r, c] = k.split(",").map(Number);
    const el = cellEl(r, c);

    // garante que a peça exista
    showPiece(r, c, ship);

    el.classList.remove("hit");
    el.classList.add("sunk");
  });
}

function onShoot(e) {
  if (gameOver) return;

  const el = e.currentTarget;
  const r = Number(el.dataset.r);
  const c = Number(el.dataset.c);

  // já clicou nessa casa?
  if (
    el.classList.contains("miss") ||
    el.classList.contains("hit") ||
    el.classList.contains("sunk")
  ) {
    setMessage("Você já atirou aí. Escolha outra casa.");
    return;
  }

  shots++;

  const id = grid[r][c];

  if (id === 0) {
    el.classList.add("miss");
    setMessage("🌊 Água! Errou.");
  } else {
    el.classList.add("hit");
    hits++;

    const ship = shipsData.find(s => s.id === id);
    ship.hit.add(key(r, c));

    // mostra a peça na hora do acerto
    showPiece(r, c, ship);

    if (ship.hit.size === ship.size) {
      markSunk(ship);
      setMessage(`💥 Você AFUNDOU o navio: ${ship.name}!`);
    } else {
      setMessage("🎯 Acertou! Você revelou uma parte do navio.");
    }
  }

  updateStats();
  checkWin();
}

function checkWin() {
  const left = shipsData.filter(s => !s.sunk).length;
  if (left === 0) {
    gameOver = true;
    setMessage(`🏆 Vitória! Você afundou todos os navios em ${shots} tiros.`);
    boardEl.querySelectorAll(".cell").forEach(b => b.classList.add("disabled"));
  }
}

function toggleReveal() {
  revealed = !revealed;

  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      const el = cellEl(r, c);
      const id = grid[r][c];
      const already =
        el.classList.contains("miss") ||
        el.classList.contains("hit") ||
        el.classList.contains("sunk");

      if (id !== 0 && !already && revealed) el.classList.add("reveal-ship");
      else el.classList.remove("reveal-ship");
    }
  }

  setMessage(revealed ? "👀 Navios revelados (modo teste)." : "Modo teste desativado.");
}

function newGame() {
  shots = 0;
  hits = 0;
  gameOver = false;
  revealed = false;

  renderBoard();
  setupShips();
  updateStats();
  setMessage("Boa sorte, comandante!");
}

newGame();

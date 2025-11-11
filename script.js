// script.js — cleaned, defensive, and fixed
console.log("script.js loaded");

/*
  NOTE: this file is intentionally defensive:
  - checks DOM queries before using them
  - tolerates both "qa-phase" and "qaPhase" naming
  - keeps Firebase reads/writes guarded
*/

const $ = id => document.getElementById(id);

// Helper: find a section element for a phase, tolerant of naming
function findSectionForPhase(phase) {
  const candidates = [
    // common naming permutations
    phase,
    phase.replace("-", ""),
    phase.replace("-", "_"),
    (phase + "Phase"),
    phase.replace("-", "") + "Phase",
    phase + "-phase",
    phase.replace("-", "") + "-phase",
    // explicit known mappings
    ...(phase === "pre-guess" ? ["pre-guess-waiting", "preGuessPhase"] : []),
  ];
  for (const id of candidates) {
    const el = document.getElementById(id);
    if (el) return el;
  }
  return null;
}

// show/hide page sections (safe)
function showSection(id) {
  document.querySelectorAll("section.page").forEach(s => s.classList.add("hidden"));
  const el = document.getElementById(id);
  if (el) el.classList.remove("hidden");
}

// safe transition that uses section ids recognized above
function transitionToPhase(phaseName) {
  // find the DOM section for the phase
  const target = findSectionForPhase(phaseName);
  const current = document.querySelector("section.page:not(.hidden)");
  if (current) {
    current.classList.add("fade-out");
    setTimeout(() => {
      current.classList.add("hidden");
      current.classList.remove("fade-out", "active");
      if (target) {
        target.classList.remove("hidden");
        target.classList.add("active", "fade-in");
        setTimeout(() => target.classList.remove("fade-in"), 600);
      }
      updateBackgroundForPhase(phaseName);
    }, 450);
  } else {
    if (target) {
      target.classList.remove("hidden");
      target.classList.add("active");
    }
    updateBackgroundForPhase(phaseName);
  }
}

// background update (phase-class on body)
function updateBackgroundForPhase(phase) {
  document.body.className = document.body.className
    .split(" ")
    .filter(c => !c.endsWith("-phase"))
    .join(" ")
    .trim();
  if (phase) document.body.classList.add(`${phase}-phase`);
}

// Globals
let gameRef = null;
let playerId = null;
let isHost = false;
window.currentPhase = window.currentPhase || null;
window.qaStarted = window.qaStarted || false;

// Default questions (kept from your list)
const questions = [
  { id: 'q1', text: "If I were a sound effect, I'd be:", options: ['Ka-ching!', 'Dramatic gasp', 'Boing!', 'Evil laugh'] },
  { id: 'q2', text: "If I were a weather forecast, I'd be:", options: ['100% chill', 'Partly dramatic with a chance of chaos!', 'Heatwave vibes', 'Sudden tornado of opinions'] },
  { id: 'q3', text: "If I were a breakfast cereal, I'd be:", options: ['Jungle Oats', 'WeetBix', 'Rice Krispies', 'MorVite', 'That weird healthy one no-one eats'] },
  { id: 'q4', text: "If I were a bedtime excuse, I'd be...", options: ['I need water','There\'s a spider in my room','I can\'t sleep without "Pillow"','There see shadows outside my window','Just one more episode'] },
  { id: 'q5', text: "If I were a villain in a movie, I'd be...", options: ['Scarlet Overkill','Grinch','Thanos','A mosquito in your room at night','Darth Vader'] },
  { id: 'q6', text: "If I were a kitchen appliance, I'd be...", options: ['A blender on high speed with no lid','A toaster that only pops when no one’s looking','Microwave that screams when it’s done','A fridge that judges your snack choices'] },
  { id: 'q7', text: "If I were a dance move, I'd be...", options: ['The awkward shuffle at weddings','Kwasakwasa, Ba-baah!','The “I thought no one was watching” move','The knee-pop followed by a regretful sit-down'] },
  { id: 'q8', text: "If I were a text message, I'd be...", options: ['A typo-ridden voice-to-text disaster','A three-hour late “LOL”','A group chat gif spammer','A mysterious “K.” with no context'] },
  { id: 'q9', text: "If I were a warning label, I'd be...", options: ['Caution: May spontaneously break into song','Contents may cause uncontrollable giggles','Qaphela: Gevaar/Ingozi','Warning: Will talk your ear off about random facts','May contain traces of impulsive decisions'] },
  { id: 'q10', text: "If I were a type of chair, I’d be…", options: ['A Phala Phala sofa','A creaky antique that screams when you sit','One of those folding chairs that attack your fingers','A throne made of regrets and snack crumbs'] }
];

// Safe DOM-ready wiring
document.addEventListener("DOMContentLoaded", () => {
  console.log("DOM fully loaded");

  // Hook create/join buttons if present (supporting multiple possible IDs)
  const createBtn = $("createRoomBtn") || $("create-room-btn") || $("createRoom");
  const joinBtn = $("joinRoomBtn") || $("join-room-btn") || $("joinRoom");
  if (createBtn) createBtn.addEventListener("click", createRoom);
  if (joinBtn) joinBtn.addEventListener("click", joinRoom);

  // host begin-game if exists
  const beginBtn = $("begin-game-btn") || $("beginGameBtn");
  if (beginBtn) beginBtn.addEventListener("click", () => {
    if (gameRef) gameRef.child("phase").set("qa");
  });

  // host begin-guessing control (in pre-guess)
  const beginGuessingBtn = $("begin-guessing-btn") || $("beginGuessingBtn");
  if (beginGuessingBtn) beginGuessingBtn.addEventListener("click", () => {
    if (isHost && gameRef) gameRef.update({ phase: "guessing" });
  });
});

// ===== createRoom / joinRoom =====
async function createRoom() {
  const nameEl = $("hostName") || $("host-name");
  const countEl = $("playerCount") || $("player-count");
  const name = nameEl ? nameEl.value.trim() : "";
  const count = countEl ? parseInt(countEl.value.trim(), 10) : NaN;
  if (!name || !count || isNaN(count) || count < 2) {
    alert("Enter your name and number of players (min 2).");
    return;
  }

  const code = Math.random().toString(36).substring(2, 7).toUpperCase();
  playerId = name;
  isHost = true;

  if (!window.db) {
    alert("Database not ready. Please refresh.");
    return;
  }

  gameRef = window.db.ref("rooms/" + code);
  await gameRef.set({
    host: name,
    numPlayers: count,
    phase: "waiting",
    players: { [name]: { score: 0, ready: false } }
  });

  // save some helpful local metadata
  try { localStorage.setItem("roomCode", code); localStorage.setItem("isHost", "true"); } catch(e){}

  // UI
  const roomCodeEl = $("room-code-display-game") || $("roomCodeDisplay");
  const playersCountEl = $("players-count") || $("playersCount");
  if (roomCodeEl) roomCodeEl.textContent = "Room Code: " + code;
  if (playersCountEl) playersCountEl.textContent = `Players joined: 1 / ${count}`;

  transitionToPhase("waiting");
  subscribeToGame(code);
  console.log("✅ Room created with code:", code);
}

async function joinRoom() {
  const nameEl = $("playerName") || $("player-name");
  const codeEl = $("roomCode") || $("room-code") || $("roomCodeInput");
  const name = nameEl ? nameEl.value.trim() : "";
  const code = codeEl ? (codeEl.value || "").trim().toUpperCase() : "";

  if (!name || !code) return alert("Enter name and room code");

  playerId = name;
  isHost = false;

  if (!window.db) return alert("Database not ready. Please refresh.");
  gameRef = window.db.ref("rooms/" + code);

  const snap = await gameRef.once("value");
  if (!snap.exists()) return alert("Room not found.");

  await gameRef.child("players/" + name).set({ score: 0, ready: false });

  try { localStorage.setItem("roomCode", code); localStorage.setItem("isHost", "false"); } catch(e){}

  transitionToPhase("waiting");
  subscribeToGame(code);
  console.log("✅ Joined room:", code);
}

// ===== subscribeToGame (centralized listener) =====
function subscribeToGame(code) {
  if (!window.db) return;
  const ref = window.db.ref("rooms/" + code);
  gameRef = ref;

  // detach previous to avoid duplicates
  try { ref.off(); } catch (e) { /* ignore */ }

  ref.on("value", snapshot => {
    const data = snapshot.val();
    if (!data) return;

    // update UI and check readiness
    try {
      updateRoomUI(data, code);
    } catch (err) {
      console.error("updateRoomUI error:", err);
    }

    try {
      checkAllPlayersReadyListener(snapshot);
    } catch (err) {
      console.error("checkAllPlayersReadyListener error:", err);
    }

    // phase: scoreboard or reveal hooks (if needed)
    const phase = data.phase;
    if (phase === "scoreboard") {
      showScoreboard(data);
    } else if (phase === "reveal") {
      showRevealPhase(data);
    }
  });
}

// ===== updateRoomUI (defensive) =====
function updateRoomUI(data, code) {
  if (!data) return;
  const phase = data.phase || "waiting";
  const players = data.players || {};
  const numPlayers = Object.keys(players).length;
  const total = data.numPlayers || 0;

  console.log("🧩 updateRoomUI called for phase:", phase, "players:", Object.keys(players));

  // safe updates
  const roomCodeEl = $("room-code-display-game") || $("roomCodeDisplay");
  const countEl = $("players-count") || $("playersCount");
  if (roomCodeEl) roomCodeEl.textContent = "Room Code: " + code;
  if (countEl) countEl.textContent = `Players joined: ${numPlayers} / ${total}`;

  const playerListEl = $("players-list") || $("playerList") || $("playersList");
  if (playerListEl) {
    playerListEl.innerHTML = Object.keys(players).map(p => {
      const ready = players[p] && players[p].ready ? " ✅" : "";
      const score = players[p] && typeof players[p].score !== "undefined" ? ` (${players[p].score})` : "";
      return `<li>${p}${ready}${score}</li>`;
    }).join("");
  }

  // ensure we render the correct phase screen (use transition helper)
  switch (phase) {
    case "waiting":
      transitionToPhase("waiting");
      break;
    case "qa":
      transitionToPhase("qa");
      // start QA only once per client
      if (!window.qaStarted) startQA();
      break;
    case "pre-guess":
      transitionToPhase("pre-guess");
      break;
    case "guessing":
      transitionToPhase("guessing");
      startGuessing();
      break;
    case "scoreboard":
      transitionToPhase("scoreboard");
      break;
    case "reveal":
      transitionToPhase("reveal");
      break;
    default:
      transitionToPhase("waiting");
  }
}

// ===== readiness checker used by the host to reveal begin-guessing UI =====
function checkAllPlayersReadyListener(snapshot) {
  const data = snapshot.val() || {};
  const players = data.players || {};
  const phase = data.phase;
  if (!isHost) return;

  const beginGuessingBtn = $("begin-guessing-btn") || $("beginGuessingBtn");
  const waitingStatus = $("waiting-status") || $("waitingStatus");
  const allReady = Object.values(players).every(p => p && p.ready);

  if (phase === "pre-guess") {
    if (allReady) {
      if (beginGuessingBtn) beginGuessingBtn.classList.remove("hidden");
      if (waitingStatus) waitingStatus.textContent = "Everyone’s done! Begin guessing 🎉";
    } else {
      if (beginGuessingBtn) beginGuessingBtn.classList.add("hidden");
      if (waitingStatus) waitingStatus.textContent = "Waiting for all players to finish Q&A...";
    }
  } else if (phase === "qa" && allReady) {
    // Move to pre-guess automatically if everyone finished during QA
    gameRef.update({ phase: "pre-guess" }).then(() => {
      console.log("✅ All players ready — moved to pre-guess");
    }).catch(e => console.warn("Couldn't advance to pre-guess:", e));
  }
}

// ===== Q&A (client-side) =====
let currentQuestion = 0;
let answers = {};

function startQA() {
  if (!gameRef) return console.warn("startQA: no gameRef");
  window.qaStarted = true;
  currentQuestion = 0;
  answers = {};
  transitionToPhase("qa");
  renderQuestion();
}

function renderQuestion() {
  const container = $("qa-questions") || $("qa-container") || $("qa-questions-container");
  if (!container) {
    console.warn("renderQuestion: #qa-questions missing");
    return;
  }
  container.innerHTML = "";

  const q = questions[currentQuestion];
  if (!q) {
    // finished locally: save answers and mark ready
    saveAnswersAndMarkReady();
    return;
  }

  // question counter
  const counter = document.createElement("div");
  counter.className = "question-counter";
  counter.textContent = `Question ${currentQuestion + 1} of ${questions.length}`;
  container.appendChild(counter);

  // tile
  const tile = document.createElement("div");
  tile.className = "qa-tile active";
  tile.innerHTML = `
    <h3 class="question-text">${q.text}</h3>
    <div class="options-grid">
      ${q.options.map((opt, idx) => `<button class="option-btn" data-idx="${idx}">${opt}</button>`).join("")}
    </div>
  `;
  container.appendChild(tile);

  tile.querySelectorAll(".option-btn").forEach(btn => {
    btn.addEventListener("click", async () => {
      const chosen = btn.textContent;
      answers[q.id] = chosen;
      // save per-question to DB to be safe
      if (gameRef && playerId) {
        try {
          await gameRef.child(`players/${playerId}/answers/${q.id}`).set({ optionText: chosen, ts: Date.now() });
        } catch (e) {
          console.warn("Failed to write answer:", e);
        }
      }
      tile.classList.add("slide-out");
      setTimeout(() => {
        currentQuestion++;
        renderQuestion();
      }, 350);
    });
  });
}

async function saveAnswersAndMarkReady() {
  if (!gameRef || !playerId) return;
  try {
    // answers already saved per-question — mark ready
    await gameRef.child(`players/${playerId}/ready`).set(true);
    transitionToPhase("pre-guess");
  } catch (e) {
    console.warn("saveAnswersAndMarkReady error:", e);
  }
}

// ===== GUESSING (simple round loop) =====
async function startGuessing() {
  if (!gameRef) return;
  console.log("startGuessing invoked");
  // we rely on subscribeToGame to call updateRoomUI and transitionToPhase("guessing")
  // Additional setup can be placed here if needed.
  // For complex round-driven guessing, you'd install another listener specifically for guessing rounds.
}

// ===== SCOREBOARD & REVEAL =====
function showScoreboard(data) {
  transitionToPhase("scoreboard");
  const container = $("scoreboard") || $("scoreboard-container");
  if (!container) return;
  const players = data.players || {};
  let html = `<ul class="score-list">`;
  Object.entries(players).forEach(([name, p]) => {
    html += `<li>${name}: <strong>${p.score || 0}</strong> pts ${p.ready ? "✅" : ""}</li>`;
  });
  html += `</ul>`;
  container.innerHTML = html;
  // reveal control for host
  const revealBtn = $("revealWinnerBtn") || $("reveal-winner-btn");
  if (revealBtn) revealBtn.classList.toggle("hidden", !isHost);
  if (revealBtn) revealBtn.onclick = () => gameRef.update({ phase: "reveal" });
}

function showRevealPhase(data) {
  transitionToPhase("reveal");
  const container = $("revealPhase") || $("reveal") || $("scoreboard");
  if (!container) return;

  const players = data.players || {};
  const sorted = Object.entries(players).map(([name, o]) => ({ name, score: o.score || 0 })).sort((a, b) => b.score - a.score);
  const winner = sorted[0]?.name || "Someone";
  const highScore = sorted[0]?.score || 0;
  // fire confetti
  launchConfetti();

  let html = `<div class="reveal-phase fade-in"><h1>🎉 ${winner} wins!</h1><h3>${highScore} pts</h3><ul>`;
  sorted.forEach(p => html += `<li>${p.name}: ${p.score}</li>`);
  html += `</ul><button class="vibrant-btn" onclick="location.reload()">Play Again</button></div>`;
  container.innerHTML = html;
}

// ===== Confetti (safe) =====
function launchConfetti() {
  try {
    const canvas = document.createElement("canvas");
    canvas.id = "confetti-canvas";
    Object.assign(canvas.style, { position: "fixed", top: 0, left: 0, width: "100vw", height: "100vh", pointerEvents: "none", zIndex: 9999 });
    document.body.appendChild(canvas);
    const ctx = canvas.getContext("2d");
    // adapt canvas pixel size
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const pieces = Array.from({ length: 120 }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * -canvas.height,
      size: Math.random() * 8 + 4,
      color: `hsl(${Math.random() * 360}, 80%, 60%)`,
      speed: Math.random() * 4 + 2,
      rot: Math.random() * 360
    }));

    function draw() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      pieces.forEach(p => {
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x, p.y, p.size, p.size);
        p.y += p.speed;
        p.x += Math.sin(p.y / 20);
        if (p.y > canvas.height) {
          p.y = -10 - Math.random() * 100;
          p.x = Math.random() * canvas.width;
        }
      });
      requestAnimationFrame(draw);
    }
    draw();
    setTimeout(() => canvas.remove(), 10000);
  } catch (e) {
    console.warn("Confetti failed:", e);
  }
}

// Expose a minimal debug helper so you can call from console
window._gameDebug = {
  subscribeToGame,
  createRoom,
  joinRoom,
  gameRef,
  setHost: () => isHost = true
};

console.log("✅ script.js loaded and ready");

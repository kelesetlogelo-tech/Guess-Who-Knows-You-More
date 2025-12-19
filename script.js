// script.js — cleaned, gradient transitions and full logic restored
console.log("script.js loaded");

const $ = id => document.getElementById(id);

// Helper: find a section element for a phase
function findSectionForPhase(phase) {
  const candidates = [
    phase,
    phase.replace("-", ""),
    phase.replace("-", "_"),
    phase + "Phase",
    phase.replace("-", "") + "Phase",
    phase + "-phase",
    phase.replace("-", "") + "-phase",
    ...(phase === "pre-guess" ? ["pre-guess-waiting", "preGuessPhase"] : []),
  ];
  for (const id of candidates) {
    const el = document.getElementById(id);
    if (el) return el;
  }
  return null;
}

function showPage(pageId) {
  console.log("showPage:", pageId);

  // Hide all pages
  document.querySelectorAll(".page").forEach(p => p.classList.add("hidden"));

  // Show target page
  const page = document.getElementById(pageId);
  if (!page) {
    console.error("❌ Cannot show page — ID not found:", pageId);
    return;
  }

  page.classList.remove("hidden");
  page.classList.add("active");
}

// Simple show/hide of sections
function transitionToPhase(phaseName) {
  console.log("🌀 TRANSITION DEBUG: Attempting to switch to", phaseName);
  const allSections = Array.from(document.querySelectorAll("section.page"));
  console.log("Found sections:", allSections.map(s => s.id));

  const target = findSectionForPhase(phaseName);
  if (target) {
    showPage(target.id);
    console.log("🌈 Switching phase:", phaseName);
} else {
    console.warn("⚠️ No section found for phase:", phaseName);
  }
  updateBackgroundForPhase(phaseName);
  console.log("✅ After transition:", phaseName);
}

// Update background gradient for each phase
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

// Default questions
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

// DOM ready setup
document.addEventListener("DOMContentLoaded", () => {
  console.log("DOM fully loaded ✅");

  const createBtn = $("createRoomBtn") || $("create-room-btn") || $("createRoom");
  const joinBtn = $("joinRoomBtn") || $("join-room-btn") || $("joinRoom");
  if (createBtn) createBtn.addEventListener("click", createRoom);
  if (joinBtn) joinBtn.addEventListener("click", joinRoom);

  const beginBtn = $("begin-game-btn") || $("beginGameBtn");
  if (beginBtn) beginBtn.addEventListener("click", () => {
    if (gameRef) gameRef.child("phase").set("qa");
  });

  const beginGuessingBtn = $("begin-guessing-btn") || $("beginGuessingBtn");
  if (beginGuessingBtn) beginGuessingBtn.addEventListener("click", () => {
    if (isHost && gameRef) gameRef.update({ phase: "guessing" });
  });
});

// ===== Firebase game logic =====
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

  try { localStorage.setItem("roomCode", code); 
        localStorage.setItem("isHost", "true");

  const roomCodeEl =
    $("room-code-display-game") ||
    $("roomCodeDisplay") ||
    document.querySelector("[data-room-code]"); // fallback

  if (roomCodeEl) {
  roomCodeEl.textContent = "Room Code: " + code;
  } else {
  console.warn("⚠️ No UI element found for room code.");
}
  
  const playersCountEl = $("players-count") || $("playersCount");
  if (playersCountEl) {
    playersCountEl.textContent = `Players joined: 1 / ${count}`;
  }

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

// ===== subscribeToGame =====
function subscribeToGame(code) {
  if (!window.db) return;
  const ref = window.db.ref("rooms/" + code);
  gameRef = ref;

  try { ref.off(); } catch (e) {}

  ref.on("value", snapshot => {
    const data = snapshot.val();
    if (!data) return;

    try { updateRoomUI(data, code); } catch (err) { console.error(err); }
  
    const phase = data.phase;
    if (phase === "scoreboard") showScoreboard(data);
    else if (phase === "reveal") showRevealPhase(data);
  });
}

// ===== updateRoomUI =====
function updateRoomUI(data, code) {
  if (!data) return;
  const phase = data.phase || "waiting";
  const players = data.players || {};
  const numPlayers = Object.keys(players).length;
  const total = data.numPlayers || 0;

  const roomCodeEl = $("room-code-display-game") || $("roomCodeDisplay");
  const countEl = $("players-count") || $("playersCount");
  if (roomCodeEl) roomCodeEl.textContent = "Room Code: " + code;
  if (countEl) countEl.textContent = `Players joined: ${numPlayers} / ${total}`;

  const playerListEl = $("players-list") || $("playerList") || $("playersList");
  if (playerListEl) {
    playerListEl.innerHTML = Object.keys(players).map(p => {
      const ready = players[p]?.ready ? " ✅" : "";
      const score = players[p]?.score !== undefined ? ` (${players[p].score})` : "";
      return `<li>${p}${ready}${score}</li>`;
    }).join("");
  }

  switch (phase) {
    case "waiting": transitionToPhase("waiting"); break;
    case "qa": transitionToPhase("qa"); if (!window.qaStarted) startQA(); break;
    case "pre-guess": transitionToPhase("pre-guess"); break;
    case "guessing": transitionToPhase("guessing"); startGuessing(); break;
    case "scoreboard": transitionToPhase("scoreboard"); break;
    case "reveal": transitionToPhase("reveal"); break;
  }
}

// ===== Q&A =====
let currentQuestion = 0;
let answers = {};

function startQA() {
  if (!gameRef) return;
  window.qaStarted = true;
  currentQuestion = 0;
  answers = {};
  transitionToPhase("qa");
  renderQuestion();
}

function renderQuestion() {
  const container = $("qa-questions") || $("qa-container") || $("qa-questions-container");
  if (!container) return;

  container.innerHTML = "";
  const q = questions[currentQuestion];
  if (!q) return saveAnswersAndMarkReady();

  const counter = document.createElement("div");
  counter.className = "question-counter";
  counter.textContent = `Question ${currentQuestion + 1} of ${questions.length}`;
  container.appendChild(counter);

  const tile = document.createElement("div");
  tile.className = "qa-tile";
  tile.innerHTML = `
    <h3 class="question-text">${q.text}</h3>
    <div class="options-grid">
      ${q.options.map(opt => `<button class="option-btn">${opt}</button>`).join("")}
    </div>`;
  container.appendChild(tile);

  tile.querySelectorAll(".option-btn").forEach(btn => {
    btn.addEventListener("click", async () => {
      const chosen = btn.textContent;
      answers[q.id] = chosen;
      if (gameRef && playerId) {
        await gameRef.child(`players/${playerId}/answers/${q.id}`).set({ optionText: chosen, ts: Date.now() });
      }
      currentQuestion++;
      renderQuestion();
    });
  });
}

async function saveAnswersAndMarkReady() {
  if (!gameRef || !playerId) return;
  await gameRef.child(`players/${playerId}/ready`).set(true);
  transitionToPhase("pre-guess");
}

// ===== SCOREBOARD =====
function showScoreboard(data) {
  transitionToPhase("scoreboard");
  const container = $("scoreboard") || $("scoreboard-container");
  if (!container) return;
  const players = data.players || {};
  container.innerHTML = Object.entries(players)
    .map(([n, p]) => `<li>${n}: <strong>${p.score || 0}</strong> pts</li>`).join("");
}

function showRevealPhase(data) {
  transitionToPhase("reveal");
  const container = $("revealPhase") || $("reveal");
  if (!container) return;
  const players = data.players || {};
  const sorted = Object.entries(players)
    .map(([n, o]) => ({ name: n, score: o.score || 0 }))
    .sort((a, b) => b.score - a.score);
  const winner = sorted[0]?.name || "Someone";
  container.innerHTML = `<h1>🎉 ${winner} wins!</h1>`;
}
console.log("✅ Game script ready!");








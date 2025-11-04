console.log("script.js loaded");

let gameRef = null;
let isHost = false;
const $ = id => document.getElementById(id);

function showSection(id) {
  document.querySelectorAll("section").forEach(s => s.classList.add("hidden"));
  $(id).classList.remove("hidden");
}

// ---------------- CREATE ROOM ----------------
$("create-room-btn").addEventListener("click", async () => {
  const name = $("host-name").value.trim();
  const count = parseInt($("player-count").value.trim());

  if (!name || !count) {
    alert("Enter your name and number of players");
    return;
  }

  const code = Math.random().toString(36).substring(2, 7).toUpperCase();
  $("room-code-display").textContent = "Room Code: " + code;

  isHost = true;
  gameRef = window.db.ref("rooms/" + code);

  await gameRef.set({
    host: name,
    numPlayers: count,
    phase: "waiting",
    players: { [name]: { score: 0 } }
  });
  // <--- NEW: show room code + initial player count in the waiting/game UI
  $("room-code-display-game").textContent = "Room Code: " + code;
  $("players-count").textContent = `Players joined: 1 / ${count}`;

  subscribeToGame(code);
  showSection("game");
});

// ---------------- JOIN ROOM ----------------
$("join-room-btn").addEventListener("click", async () => {
  const name = $("player-name").value.trim();
  const code = $("join-code").value.trim().toUpperCase();

  if (!name || !code) {
    alert("Enter your name and room code");
    return;
  }

  gameRef = window.db.ref("rooms/" + code);
  await gameRef.child("players/" + name).set({ score: 0 });

  subscribeToGame(code);
  showSection("game");
});

// ---------------- SUBSCRIBE ----------------
let beginGameTimer = null; // global variable to track the 3-second delay timer

function subscribeToGame(code) {
  const ref = window.db.ref("rooms/" + code);
  ref.on("value", snap => {
    const data = snap.val();
    if (!data) return;

    // Update room code and player count
    $("room-code-display-game").textContent = "Room Code: " + code;

    const playersObj = data.players || {};
    const joinedCount = Object.keys(playersObj).length;
    const expected = data.numPlayers || "?";
    $("players-count").textContent = `Players joined: ${joinedCount} / ${expected}`;

    // Control the Begin Game button visibility
    const beginBtn = $("begin-game-btn");
    if (isHost && beginBtn) {
      // Check if all players have joined
      const allPlayersJoined = expected !== "?" && joinedCount >= expected;

      if (allPlayersJoined) {
        // If all players joined, start 3-second countdown (if not already running)
        if (!beginGameTimer) {
          beginGameTimer = setTimeout(() => {
            beginBtn.classList.remove("hidden"); // Show after 3 seconds
            beginGameTimer = null; // Reset timer
          }, 3000); // 3000ms = 3 seconds
        }
      } else {
        // If not all players joined, hide button and reset timer
        beginBtn.classList.add("hidden");
        if (beginGameTimer) {
          clearTimeout(beginGameTimer);
          beginGameTimer = null;
        }
      }
         // --- AUTO TRANSITION TO PRE-GUESS WAITING ROOM ---
    const playersObj = data.players || {};
    const totalPlayers = parseInt(data.numPlayers) || 0;
    const readyCount = Object.values(playersObj).filter(p => p.ready).length;

    // Update ready status text
    const readyStatus = $("ready-status");
    if (readyStatus) {
      readyStatus.textContent = `Ready: ${readyCount} / ${totalPlayers}`;
    }

    // If everyone has completed Q&A
    if (data.phase === "qa" && readyCount === totalPlayers && totalPlayers > 0) {
      // Move the game to pre-guess phase
      window.db.ref(`rooms/${code}/phase`).set("pre-guess");
    }

    // --- HANDLE PRE-GUESS PHASE DISPLAY ---
    if (data.phase === "pre-guess") {
      showSection("pre-guess-waiting");

      const startBtn = $("start-guessing-btn");
      if (isHost && startBtn) {
        startBtn.classList.remove("hidden");
        startBtn.onclick = () => {
          window.db.ref(`rooms/${code}/phase`).set("guessing");
        };
      }
    } 
  }

    // Normal phase rendering
    renderPhase(data.phase);
  });
}

// ---------------- UPDATE PHASE ----------------
async function updatePhase(newPhase) {
  if (!gameRef) return;
  await gameRef.child("phase").set(newPhase);
}

// ---------------- RENDER PHASE ----------------
function renderPhase(phase) {
  const title = $("phase-title");
  title.textContent = {
    waiting: "Waiting for players...",
 if (phase === "qa") startQA();
 if (phase === "pre-guess") showSection("pre-guess-waiting");

    qa: "Q&A Phase",
// ---------- Q&A PHASE LOGIC ----------
const questions = [
  { id: 'q1', text: "If I were a sound effect, I'd be:", options: ['Ka-ching!', 'Dramatic gasp', 'Boing!', 'Evil laugh'] },
  { id: 'q2', text: "If I were a weather forecast, I'd be:", options: ['100% chill', 'Partly dramatic with a chance of chaos!', 'Heatwave vibes', 'Sudden tornado of opinions'] },
  { id: 'q3', text: "If I were a breakfast cereal, I'd be:", options: ['Jungle Oats', 'WeetBix', 'Rice Krispies', 'MorVite', 'That weird healthy one no-one eats'] },
  { id: 'q4', text: "If I were a bedtime excuse, I'd be...", options: ['I need water', "There's a spider in my room", "I can't sleep without 'Pillow'", 'There are shadows outside my window', 'Just one more episode'] },
  { id: 'q5', text: "If I were a villain in a movie, I'd be...", options: ['Scarlet Overkill', 'Grinch', 'Thanos', 'A mosquito in your room at night', 'Darth Vader'] },
  { id: 'q6', text: "If I were a kitchen appliance, I'd be...", options: ['A blender on high speed with no lid', 'A toaster that only pops when no one’s looking', 'Microwave that screams when it’s done', 'A fridge that judges your snack choices'] },
  { id: 'q7', text: "If I were a dance move, I'd be...", options: ['The awkward shuffle at weddings', 'Kwasakwasa, Ba-baah!', 'The “I thought no one was watching” move', 'The knee-pop followed by a regretful sit-down'] },
  { id: 'q8', text: "If I were a text message, I'd be...", options: ['A typo-ridden voice-to-text disaster', 'A three-hour late “LOL”', 'A group chat gif spammer', 'A mysterious “K.” with no context'] },
  { id: 'q9', text: "If I were a warning label, I'd be...", options: ['Caution: May spontaneously break into song', 'Contents may cause uncontrollable giggles', 'Qaphela: Gevaar/Ingozi', 'Warning: Will talk your ear off about random facts', 'May contain traces of impulsive decisions'] },
  { id: 'q10', text: "If I were a type of chair, I’d be…", options: ['A Phala Phala sofa', 'A creaky antique that screams when you sit', 'One of those folding chairs that attack your fingers', 'A throne made of regrets and snack crumbs'] }
];

let currentQuestion = 0;
let answers = {};

function startQA() {
  showSection("qa-phase");
  renderQuestion();
}

function renderQuestion() {
  const container = $("qa-container");
  container.innerHTML = "";

  if (currentQuestion >= questions.length) {
    // When done, mark as complete
    alert("All questions answered! Waiting for others...");
    // Update Firebase to move to pre-guess phase
    const room = localStorage.getItem("roomCode");
    const player = localStorage.getItem("playerName");
    window.db.ref(`rooms/${room}/players/${player}/answers`).set(answers);
    // When done, mark as complete
    alert("All questions answered! Waiting for others...");

   // Update player answers in Firebase
   const room = localStorage.getItem("roomCode");
   const player = localStorage.getItem("playerName");
   window.db.ref(`rooms/${room}/players/${player}`).update({
    answers,
    ready: true
  });

  // Move player to Pre-Guess Waiting Room
  showSection("pre-guess-waiting");

  }

  const q = questions[currentQuestion];
  const tile = document.createElement("div");
  tile.className = "qa-tile";

  tile.innerHTML = `
    <h2>${q.text}</h2>
    ${q.options.map(opt => `<button class="qa-option">${opt}</button>`).join("")}
  `;
  container.appendChild(tile);

  tile.querySelectorAll(".qa-option").forEach(btn => {
    btn.onclick = () => {
      answers[q.id] = btn.textContent;
      tile.classList.add("slide-out");
      setTimeout(() => {
        currentQuestion++;
        renderQuestion();
      }, 600);
    };
  });
}

    guessing: "Guessing Phase",
    scoreboard: "Scoreboard"
  }[phase] || "Game Phase";

  ["begin-game-btn", "start-guessing-btn", "reveal-scores-btn", "play-again-btn"]
    .forEach(id => $(id).classList.add("hidden"));

  if (isHost) {
    if (phase === "waiting") $("begin-game-btn").classList.remove("hidden");
    if (phase === "qa") $("start-guessing-btn").classList.remove("hidden");
    if (phase === "guessing") $("reveal-scores-btn").classList.remove("hidden");
    if (phase === "scoreboard") $("play-again-btn").classList.remove("hidden");
  }
}

// ---------------- HOST CONTROLS ----------------
$("begin-game-btn").onclick = () => updatePhase("qa");
window.db.ref(`rooms/${roomCode}/phase`).set("qa");

$("start-guessing-btn").onclick = () => updatePhase("guessing");
$("reveal-scores-btn").onclick = () => updatePhase("scoreboard");
$("play-again-btn").onclick = () => location.reload();





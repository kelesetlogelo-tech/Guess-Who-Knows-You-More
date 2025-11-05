console.log("script.js loaded");

let gameRef = null;
let isHost = false;
let playerId = null;
let beginGameTimer = null;

const $ = id => document.getElementById(id);

function showSection(id) {
  document.querySelectorAll("section").forEach(s => s.classList.add("hidden"));
  const el = $(id);
  if (el) el.classList.remove("hidden");
}

// ---------------- CREATE ROOM ----------------
$("create-room-btn").addEventListener("click", async () => {
  const name = $("hostName").value.trim();
  const count = parseInt($("playerCount").value.trim());
  if (!name || !count) return alert("Enter your name and number of players");

  const code = Math.random().toString(36).substring(2, 7).toUpperCase();
  playerId = name;
  isHost = true;

  gameRef = window.db.ref("rooms/" + code);
  await gameRef.set({
    host: name,
    numPlayers: count,
    phase: "waiting",
    players: { [name]: { score: 0 } }
  });

  $("room-code-display-game").textContent = "Room Code: " + code;
  $("players-count").textContent = `Players joined: 1 / ${count}`;
  subscribeToGame(code);
  showSection("waitingRoom");
});

// ---------------- JOIN ROOM ----------------
$("join-room-btn").addEventListener("click", async () => {
  const name = $("playerName").value.trim();
  const code = $("roomCode").value.trim().toUpperCase();
  if (!name || !code) return alert("Enter your name and room code");

  playerId = name;
  isHost = false;

  gameRef = window.db.ref("rooms/" + code);
  await gameRef.child("players/" + name).set({ score: 0 });

  subscribeToGame(code);
  showSection("waitingRoom");
});

// ---------------- SUBSCRIBE ----------------
function subscribeToGame(code) {
  const ref = window.db.ref("rooms/" + code);
  ref.on("value", snap => {
    const data = snap.val();
    if (!data) return;

    $("room-code-display-game").textContent = "Room Code: " + code;

    const playersObj = data.players || {};
    const joinedCount = Object.keys(playersObj).length;
    const expected = data.numPlayers || "?";
    $("players-count").textContent = `Players joined: ${joinedCount} / ${expected}`;

    const beginBtn = $("begin-game-btn");

    if (isHost && beginBtn) {
      const allJoined = expected !== "?" && joinedCount >= expected;
      if (allJoined) {
        if (!beginGameTimer) {
          beginGameTimer = setTimeout(() => {
            beginBtn.classList.remove("hidden");
            beginGameTimer = null;
          }, 3000);
        }
      } else {
        beginBtn.classList.add("hidden");
        clearTimeout(beginGameTimer);
        beginGameTimer = null;
      }
    } else if (beginBtn) {
      beginBtn.classList.add("hidden");
    }

    // auto-move to pre-guess when all ready
    const readyCount = Object.values(playersObj).filter(p => p.ready).length;
    const totalPlayers = parseInt(data.numPlayers) || 0;
    if (data.phase === "qa" && readyCount === totalPlayers && totalPlayers > 0) {
      window.db.ref(`rooms/${code}/phase`).set("pre-guess");
    }

    renderPhase(data.phase, code);
  });
}

// ---------------- RENDER PHASE ----------------
function renderPhase(phase, code) {
  console.log("Rendering phase:", phase);
  switch (phase) {
    case "waiting":
      showSection("waitingRoom");
      break;
    case "qa":
      showSection("qa-phase");
      startQA(code);
      break;
    case "pre-guess":
      showSection("pre-guess-waiting");
      if (isHost) $("start-guessing-btn").classList.remove("hidden");
      break;
    case "guessing":
      showSection("guessing-phase");
      break;
    case "scoreboard":
      showSection("scoreboard");
      break;
  }
}

// ---------------- HOST CONTROLS ----------------
$("begin-game-btn").addEventListener("click", () => {
  if (gameRef) gameRef.child("phase").set("qa");
});

$("start-guessing-btn").addEventListener("click", () => {
  if (gameRef) gameRef.child("phase").set("guessing");
});

// ---------------- Q&A PHASE ----------------
const questions = [
  { text: "If I were a sound effect, I'd be:", options: ["Ka-ching!", "Boing!", "Evil laugh", "Dramatic gasp"] },
  { text: "If I were a weather forecast, I'd be:", options: ["100% chill", "Partly dramatic", "Heatwave vibes"] },
  { text: "If I were a breakfast cereal, I'd be:", options: ["WeetBix", "Rice Krispies", "Morvite", "Jungle Oats"] },
];

let currentQuestion = 0;
let answers = {};

function startQA() {
  currentQuestion = 0;
  answers = {};
  renderQuestion();
}

function renderQuestion() {
  const container = $("qa-container");
  container.innerHTML = "";
  const q = questions[currentQuestion];
  if (!q) return markPlayerReady();

  const tile = document.createElement("div");
  tile.className = "qa-tile active";
  tile.innerHTML = `
    <h3>${q.text}</h3>
    <div class="options">
      ${q.options.map(opt => `<button class="option-btn">${opt}</button>`).join("")}
    </div>
  `;
  container.appendChild(tile);

  tile.querySelectorAll(".option-btn").forEach(btn => {
    btn.onclick = () => {
      answers[q.text] = btn.textContent;
      tile.classList.add("slide-out");
      setTimeout(() => {
        currentQuestion++;
        renderQuestion();
      }, 500);
    };
  });
}

function markPlayerReady() {
  if (!gameRef || !playerId) return;
  gameRef.child(`players/${playerId}/ready`).set(true);
  showSection("pre-guess-waiting");
}

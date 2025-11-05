console.log("script.js loaded");

let gameRef = null;
let isHost = false;
let playerId = null;
let beginGameTimer = null;

const $ = id => document.getElementById(id);

function showSection(id) {
  document.querySelectorAll("section.page").forEach(s => s.classList.remove("active"));
  const el = document.getElementById(id);
  if (el) el.classList.add("active");
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
/** Update UI and background when phase changes **/
function renderPhase(phase) {
  const title = $("phase-title");

  // Remove all old phase classes from body
  document.body.className = document.body.className
    .split(" ")
    .filter(c => !c.includes("-phase"))
    .join(" ")
    .trim();

  // Add the new phase class for color
  document.body.classList.add(`${phase}-phase`);

  switch (phase) {
    case "waiting":
      showSection("waitingRoom");
      break;

    case "qa":
      showSection("qa-phase");
      startQA();
      break;

    case "pre-guess":
      showSection("pre-guess-waiting");
      break;

    case "guessing":
      showSection("guessing-phase");
      startGuessing();
      break;

    case "scoreboard":
      showSection("scoreboard");
      break;

    default:
      showSection("landing");
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
  { id: 'q1', text: "If I were a sound effect, I'd be:", options: [
    "Ka-ching!",
    "Dramatic gasp",
    "Boing!",
    "Evil laugh"
  ]},
  { id: 'q2', text: "If I were a weather forecast, I'd be:", options: [
    "100% chill",
    "Partly dramatic with a chance of chaos!",
    "Heatwave vibes",
    "Sudden tornado of opinions"
  ]},
  { id: 'q3', text: "If I were a breakfast cereal, I'd be:", options: [
    "Jungle Oats",
    "WeetBix",
    "Rice Krispies",
    "MorVite",
    "That weird healthy one no-one eats"
  ]},
  { id: 'q4', text: "If I were a bedtime excuse, I'd be...", options: [
    "I need water",
    "There's a spider in my room",
    "I can't sleep without 'Pillow'",
    "There see shadows outside my window",
    "Just one more episode"
  ]},
  { id: 'q5', text: "If I were a villain in a movie, I'd be...", options: [
    "Scarlet Overkill",
    "Grinch",
    "Thanos",
    "A mosquito in your room at night",
    "Darth Vader"
  ]},
  { id: 'q6', text: "If I were a kitchen appliance, I'd be...", options: [
    "A blender on high speed with no lid",
    "A toaster that only pops when no one’s looking",
    "Microwave that screams when it’s done",
    "A fridge that judges your snack choices"
  ]},
  { id: 'q7', text: "If I were a dance move, I'd be...", options: [
    "The awkward shuffle at weddings",
    "Kwasakwasa, Ba-baah!",
    "The “I thought no one was watching” move",
    "The knee-pop followed by a regretful sit-down"
  ]},
  { id: 'q8', text: "If I were a text message, I'd be...", options: [
    "A typo-ridden voice-to-text disaster",
    "A three-hour late 'LOL'",
    "A group chat gif spammer",
    "A mysterious 'K.' with no context"
  ]},
  { id: 'q9', text: "If I were a warning label, I'd be...", options: [
    "Caution: May spontaneously break into song",
    "Contents may cause uncontrollable giggles",
    "Qaphela: Gevaar/Ingozi",
    "Warning: Will talk your ear off about random facts",
    "May contain traces of impulsive decisions"
  ]},
  { id: 'q10', text: "If I were a type of chair, I’d be…", options: [
    "A Phala Phala sofa",
    "A creaky antique that screams when you sit",
    "One of those folding chairs that attack your fingers",
    "A throne made of regrets and snack crumbs"
  ]}
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


console.log("script.js loaded");

let gameRef;
let isHost = false;
const $ = id => document.getElementById(id);

function showSection(id) {
  document.querySelectorAll("section").forEach(s => s.classList.add("hidden"));
  $(id).classList.remove("hidden");
}

// ---------- CREATE ROOM ----------
$("create-room-btn").onclick = async () => {
  const playerName = $("host-name").value.trim();
  const numPlayers = parseInt($("player-count").value);

  if (!playerName || !numPlayers) {
    alert("Enter your name and number of players");
    return;
  }

  const roomCode = Math.random().toString(36).substr(2, 4).toUpperCase();
  $("room-code-display").textContent = `Room Code: ${roomCode}`;

  isHost = true;
  gameRef = window.db.ref("rooms/" + roomCode);
  await gameRef.set({
    host: playerName,
    numPlayers,
    phase: "waiting",
    players: { [playerName]: { score: 0 } }
  });

  subscribeToGame(roomCode);
  showSection("game");
  updatePhase("waiting");
};

// ---------- JOIN ROOM ----------
$("join-room-btn").onclick = async () => {
  const playerName = $("player-name").value.trim();
  const joinCode = $("join-code").value.trim().toUpperCase();

  if (!playerName || !joinCode) {
    alert("Enter your name and room code");
    return;
  }

  const playerRef = window.db.ref(`rooms/${joinCode}/players/${playerName}`);
  await playerRef.set({ score: 0 });

  gameRef = window.db.ref("rooms/" + joinCode);
  subscribeToGame(joinCode);
  showSection("game");
};

// ---------- UPDATE PHASE ----------
async function updatePhase(newPhase) {
  if (!gameRef) return;
  await gameRef.child("phase").set(newPhase);
}

// ---------- SUBSCRIBE TO GAME ----------
function subscribeToGame(roomCode) {
  const ref = window.db.ref("rooms/" + roomCode);
  ref.on("value", snap => {
    const data = snap.val();
    if (!data) return;
    renderPhase(data.phase);
  });
}

// ---------- RENDER PHASE ----------
function renderPhase(phase) {
  const title = $("phase-title");
  title.textContent = {
    waiting: "Waiting for players...",
    qa: "Q&A Phase",
    guessing: "Guessing Phase",
    scoreboard: "Scoreboard",
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

// ---------- HOST CONTROLS ----------
$("begin-game-btn").onclick = () => updatePhase("qa");
$("start-guessing-btn").onclick = () => updatePhase("guessing");
$("reveal-scores-btn").onclick = () => updatePhase("scoreboard");
$("play-again-btn").onclick = () => location.reload();

console.log("script.js loaded");

const $ = id => document.getElementById(id);
let playerName = "", roomCode = "", isHost = false, gameRef = null;

// ----------- SMOOTH SECTION SWITCHING -----------
function switchSection(id) {
  const current = document.querySelector("section.active");
  if (current && current.id === id) return;

  if (current) current.classList.remove("active");
  document.querySelectorAll("section").forEach(sec => sec.classList.add("hidden"));

  const next = $(id);
  next.classList.remove("hidden");
  setTimeout(() => next.classList.add("active"), 50);
}

// ----------- Firebase PHASE UPDATE -----------
function updatePhase(newPhase) {
  if (gameRef) gameRef.child("phase").set(newPhase);
}

// ----------- ROOM CREATION -----------
$("createRoomBtn").onclick = () => {
  playerName = $("playerName").value.trim();
  const num = parseInt($("numPlayers").value);
  if (!playerName || !num) return alert("Enter name and number of players.");

  roomCode = Math.random().toString(36).substr(2, 5).toUpperCase();
  $("roomCodeDisplay").textContent = `Room Code: ${roomCode}`;
  isHost = true;

  gameRef = window.db.ref("rooms/" + roomCode);
  gameRef.set({
    host: playerName,
    numPlayers: num,
    phase: "waiting",
    players: { [playerName]: { score: 0, doneQA: false, doneGuess: false } }
  });

  attachRoomListener();
  switchSection("preQA-waiting");
};

// ----------- JOIN ROOM -----------
$("joinRoomBtn").onclick = () => {
  playerName = $("playerName").value.trim();
  roomCode = $("roomCodeInput").value.trim().toUpperCase();
  if (!playerName || !roomCode) return alert("Enter name and room code.");

  gameRef = window.db.ref("rooms/" + roomCode);
  gameRef.once("value").then(snap => {
    if (!snap.exists()) return alert("Room not found!");
    gameRef.child("players/" + playerName).set({ score: 0, doneQA: false, doneGuess: false });
    attachRoomListener();
    switchSection("preQA-waiting");
  });
};

// ----------- ROOM LISTENER -----------
function attachRoomListener() {
  gameRef.on("value", snap => {
    const data = snap.val();
    if (!data) return;
    handlePhase(data.phase, data);
  });
}

// ----------- HANDLE PHASES -----------
function handlePhase(phase, data) {
  if (phase === "waiting") {
    switchSection("preQA-waiting");
    $("playerList").textContent = Object.keys(data.players).join(", ");
    const ready = Object.keys(data.players).length === data.numPlayers;
    if (isHost && ready) $("beginGameBtn").classList.remove("hidden");
  }
  if (phase === "qa") switchSection("qa-phase");
  if (phase === "preGuess") switchSection("preGuess-waiting");
  if (phase === "guess") switchSection("guess-phase");
  if (phase === "postGuess") switchSection("postGuess-waiting");
  if (phase === "scoreboard") switchSection("scoreboard");

  if (isHost) {
    $("beginGameBtn").classList.toggle("hidden", phase !== "waiting");
    $("startGuessingBtn").classList.toggle("hidden", phase !== "preGuess");
    $("revealScoresBtn").classList.toggle("hidden", phase !== "postGuess");
  }
}

// ----------- HOST BUTTONS -----------
$("beginGameBtn").onclick = () => updatePhase("qa");
$("startGuessingBtn").onclick = () => updatePhase("guess");
$("revealScoresBtn").onclick = () => updatePhase("scoreboard");
$("playAgainBtn").onclick = () => window.location.reload();

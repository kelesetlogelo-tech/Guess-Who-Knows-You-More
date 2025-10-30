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

// ---------- ROOM CREATION ----------
document.addEventListener("DOMContentLoaded", () => {
  const btn = document.getElementById("create-room-btn");
  if (btn) {
    btn.onclick = async () => {
    const playerName = document.getElementById("host-name").value.trim();
    const numPlayers = parseInt(document.getElementById("player-count").value);

    if (!playerName || !numPlayers) {
      alert("Enter your name and number of players");
      return;
    }

    const roomCode = Math.random().toString(36).substring(2, 7).toUpperCase();
    const roomData = {
      host: playerName,
      playerCount: numPlayers,
      phase: "waiting",
      players: { [playerName]: { ready: false, score: 0 } },
    };

    try {
      await window.db.ref("rooms/" + roomCode).set(roomData);
      document.getElementById("room-code-display").textContent = `Room Code: ${roomCode}`;
      console.log("Room created:", roomCode);
    } catch (err) {
      console.error("Error creating room:", err);
      alert("Could not create room — check Firebase connection.");
       }
     };
   }
});
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
    $("startGameBtn").classList.toggle("hidden", phase !== "waiting");
    $("startGuessingBtn").classList.toggle("hidden", phase !== "preGuess");
    $("revealScoresBtn").classList.toggle("hidden", phase !== "postGuess");
  }
}

// ----------- HOST BUTTONS -----------
$("startGameBtn").onclick = () => updatePhase("qa");
$("startGuessingBtn").onclick = () => updatePhase("guess");
$("revealScoresBtn").onclick = () => updatePhase("scoreboard");
$("playAgainBtn").onclick = () => window.location.reload();










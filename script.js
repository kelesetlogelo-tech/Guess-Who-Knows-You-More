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
    }

    // Normal phase rendering
    renderPhase(data.phase);
  });
}

    // normal phase rendering
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
    qa: "Q&A Phase",
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
$("start-guessing-btn").onclick = () => updatePhase("guessing");
$("reveal-scores-btn").onclick = () => updatePhase("scoreboard");
$("play-again-btn").onclick = () => location.reload();



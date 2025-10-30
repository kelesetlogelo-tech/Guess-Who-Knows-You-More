console.log("script.js loaded");

window.addEventListener("DOMContentLoaded", () => {
  console.log("DOM fully loaded — safe to bind elements");

  const phases = document.querySelectorAll(".phase");

  const showPhase = (id) => {
    phases.forEach(p => p.classList.remove("active"));
    const next = document.getElementById(id);
    if (next) next.classList.add("active", "slide-enter");
  };

  // ===== ELEMENTS =====
  const hostNameInput = document.getElementById("host-name");
  const playerCountInput = document.getElementById("player-count");
  const createBtn = document.getElementById("create-room-btn");
  const joinBtn = document.getElementById("join-room-btn");
  const joinCodeInput = document.getElementById("join-code");
  const beginBtn = document.getElementById("begin-game-btn");
  const startGuessBtn = document.getElementById("start-guessing-btn");
  const revealBtn = document.getElementById("reveal-btn");
  const playAgainBtn = document.getElementById("play-again-btn");

  // ===== STATE =====
  let roomCode = null;
  let isHost = false;

  // ===== CREATE ROOM =====
  createBtn.onclick = async () => {
    const name = hostNameInput.value.trim();
    const count = playerCountInput.value.trim();
    if (!name || !count) return alert("Enter your name and number of players");

    roomCode = Math.random().toString(36).substring(2, 7).toUpperCase();
    isHost = true;

    await db.ref(`rooms/${roomCode}`).set({
      host: name,
      playerCount: count,
      phase: "waiting",
      players: { [name]: { ready: false, score: 0 } }
    });

    localStorage.setItem("roomCode", roomCode);
    localStorage.setItem("playerName", name);

    showPhase("waiting-room");
    document.getElementById("room-code-display").textContent = `Room Code: ${roomCode}`;
    console.log("Room created:", roomCode);
  };

  // ===== JOIN ROOM =====
  joinBtn.onclick = async () => {
    const code = joinCodeInput.value.trim().toUpperCase();
    const name = hostNameInput.value.trim();
    if (!name || !code) return alert("Enter name and room code");

    const room = await db.ref(`rooms/${code}`).get();
    if (!room.exists()) return alert("Room not found");

    roomCode = code;
    await db.ref(`rooms/${roomCode}/players/${name}`).set({ ready: false, score: 0 });

    localStorage.setItem("roomCode", roomCode);
    localStorage.setItem("playerName", name);

    showPhase("waiting-room");
    console.log(`${name} joined room ${roomCode}`);
  };

  // ===== HOST CONTROLS =====
  if (beginBtn) {
    beginBtn.onclick = () => {
      if (!roomCode) return alert("Room not created yet");
      db.ref(`rooms/${roomCode}/phase`).set("qa");
    };
  }

  if (startGuessBtn) {
    startGuessBtn.onclick = () => {
      if (!roomCode) return alert("Room not created yet");
      db.ref(`rooms/${roomCode}/phase`).set("guessing");
    };
  }

  if (revealBtn) {
    revealBtn.onclick = () => {
      if (!roomCode) return alert("Room not created yet");
      db.ref(`rooms/${roomCode}/phase`).set("scoreboard");
    };
  }

  if (playAgainBtn) {
    playAgainBtn.onclick = () => {
      window.location.reload();
    };
  }

  // ===== LISTEN FOR PHASE CHANGES =====
  db.ref(`rooms`).on("value", (snapshot) => {
    snapshot.forEach(room => {
      const data = room.val();
      if (room.key === roomCode && data.phase) {
        const phase = data.phase;
        console.log(`Phase changed to: ${phase}`);

        if (phase === "waiting") showPhase("waiting-room");
        if (phase === "qa") showPhase("qa-phase");
        if (phase === "pre-guess") showPhase("pre-guess-waiting");
        if (phase === "guessing") showPhase("guessing-phase");
        if (phase === "post-guess") showPhase("post-guess-waiting");
        if (phase === "scoreboard") showPhase("scoreboard-phase");
      }
    });
  });
});

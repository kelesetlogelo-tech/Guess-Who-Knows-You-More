console.log("script.js loaded");

document.addEventListener("DOMContentLoaded", () => {
  console.log("DOM fully loaded — binding event handlers");

  // --- Helper to show only current phase ---
  function showPhase(id) {
    document.querySelectorAll(".phase").forEach(p => p.classList.add("hidden"));
    const next = document.getElementById(id);
    if (next) {
      next.classList.remove("hidden");
      next.classList.add("fade-in");
    }
  }

  // --- Cache elements ---
  const createBtn = document.getElementById("create-room-btn");
  const joinBtn = document.getElementById("join-room-btn");
  const beginBtn = document.getElementById("begin-game-btn");
  const startGuessBtn = document.getElementById("start-guessing-btn");
  const revealBtn = document.getElementById("reveal-btn");
  const playAgainBtn = document.getElementById("play-again-btn");

  let roomCode = null;
  let playerName = null;
  let isHost = false;
  let gameRef = null;

  // === CREATE ROOM ===
  createBtn.onclick = async () => {
    playerName = document.getElementById("host-name").value.trim();
    const numPlayers = parseInt(document.getElementById("player-count").value);

    if (!playerName || !numPlayers) {
      alert("Enter your name and number of players");
      return;
    }

    roomCode = Math.random().toString(36).substring(2, 7).toUpperCase();
    isHost = true;

    try {
      await window.db.ref("rooms/" + roomCode).set({
        host: playerName,
        playerCount: numPlayers,
        phase: "waiting",
        players: { [playerName]: { ready: false, score: 0 } },
      });

      localStorage.setItem("roomCode", roomCode);
      localStorage.setItem("playerName", playerName);

      document.getElementById("room-code-display").textContent = `Room Code: ${roomCode}`;
      document.querySelectorAll(".host-only").forEach(el => el.classList.remove("hidden"));
      showPhase("waiting-room");

      gameRef = window.db.ref("rooms/" + roomCode);
      console.log("✅ Room created:", roomCode);
    } catch (err) {
      console.error("❌ Firebase write error:", err);
      alert("Could not create room. Check Firebase connection.");
    }
  };

  // === JOIN ROOM ===
  joinBtn.onclick = async () => {
    playerName = document.getElementById("player-name").value.trim();
    const code = document.getElementById("join-code").value.trim().toUpperCase();
    if (!playerName || !code) return alert("Enter name and room code");

    const roomRef = window.db.ref("rooms/" + code);
    const roomSnap = await roomRef.get();

    if (!roomSnap.exists()) {
      alert("Room not found!");
      return;
    }

    roomCode = code;
    gameRef = roomRef;
    await roomRef.child("players/" + playerName).set({ ready: false, score: 0 });

    localStorage.setItem("roomCode", roomCode);
    localStorage.setItem("playerName", playerName);

    showPhase("waiting-room");
    console.log("✅ Joined room:", code);
  };

  // === HOST BUTTONS ===
  beginBtn.onclick = () => gameRef.child("phase").set("qa");
  startGuessBtn.onclick = () => gameRef.child("phase").set("guessing");
  revealBtn.onclick = () => gameRef.child("phase").set("scoreboard");
  playAgainBtn.onclick = () => location.reload();

  // === REALTIME PHASE SYNC ===
  window.db.ref("rooms").on("value", snapshot => {
    snapshot.forEach(room => {
      const data = room.val();
      if (room.key === roomCode) {
        const phase = data.phase;
        switch (phase) {
          case "waiting": showPhase("waiting-room"); break;
          case "qa": showPhase("qa-phase"); break;
          case "guessing": showPhase("guessing-phase"); break;
          case "scoreboard": showPhase("scoreboard-phase"); break;
        }
      }
    });
  });
});

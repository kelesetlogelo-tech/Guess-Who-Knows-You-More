console.log("script.js loaded");

document.addEventListener("DOMContentLoaded", () => {
  console.log("DOM fully loaded");

  const createRoomBtn = document.getElementById("createRoomBtn");
  const joinRoomBtn = document.getElementById("joinRoomBtn");
  const beginGameBtn = document.getElementById("begin-game-btn");

  const hostNameInput = document.getElementById("hostName");
  const playerCountInput = document.getElementById("playerCount");
  const playerNameInput = document.getElementById("playerName");
  const roomCodeInput = document.getElementById("roomCode");

  const roomCodeDisplay = document.getElementById("room-code-display-game");
  const playersList = document.getElementById("players-list");
  const playersCount = document.getElementById("players-count");

  // Firebase
  const db = window.db;
  if (!db) {
    console.error("❌ Firebase not initialized — window.db missing");
    return;
  }

  // === Utility ===
  function generateRoomCode() {
    const code = Math.random().toString(36).substring(2, 7).toUpperCase();
    console.log("Generated Room Code:", code);
    return code;
  }

  function transitionToPhase(phase) {
    console.log(`🌈 Transitioning to: ${phase}`);
    document.querySelectorAll("section.page").forEach((sec) => sec.classList.add("hidden"));
    const target = document.getElementById(phase);
    if (target) {
      target.classList.remove("hidden");
      updateBackgroundForPhase(phase);
    } else {
      console.warn(`⚠️ No section found for phase ID: ${phase}`);
    }
  }

  function updateBackgroundForPhase(phase) {
    document.body.className = ""; // reset
    document.body.classList.add(`${phase}-phase`);
  }

  // === CREATE ROOM ===
  createRoomBtn.addEventListener("click", async () => {
    const hostName = hostNameInput.value.trim();
    const maxPlayers = parseInt(playerCountInput.value.trim());

    if (!hostName || !maxPlayers) {
      alert("Please enter your name and number of players.");
      return;
    }

    const roomCode = generateRoomCode();
    const roomRef = db.ref(`rooms/${roomCode}`);

    await roomRef.set({
      host: hostName,
      maxPlayers,
      phase: "waitingRoom",
      players: {
        [hostName]: { name: hostName, score: 0 }
      },
    });

    console.log("✅ Room created:", roomCode);

    // Show waiting room AFTER data is set
    transitionToPhase("waitingRoom");

    // Display code
    roomCodeDisplay.textContent = `Room Code: ${roomCode}`;

    // Live update player list
    roomRef.child("players").on("value", (snapshot) => {
      const players = snapshot.val() || {};
      renderPlayerList(players, maxPlayers);
    });

    // Reveal Begin Game button for host
    beginGameBtn.classList.remove("hidden");
  });

  // === JOIN ROOM ===
  joinRoomBtn.addEventListener("click", async () => {
    const playerName = playerNameInput.value.trim();
    const roomCode = roomCodeInput.value.trim().toUpperCase();

    if (!playerName || !roomCode) {
      alert("Please enter your name and room code.");
      return;
    }

    const roomRef = db.ref(`rooms/${roomCode}`);
    const snapshot = await roomRef.get();

    if (!snapshot.exists()) {
      alert("Room not found!");
      return;
    }

    await roomRef.child(`players/${playerName}`).set({ name: playerName, score: 0 });

    console.log(`✅ ${playerName} joined room ${roomCode}`);

    transitionToPhase("waitingRoom");
    roomCodeDisplay.textContent = `Room Code: ${roomCode}`;

    // Listen for updates
    roomRef.child("players").on("value", (snapshot) => {
      const players = snapshot.val() || {};
      renderPlayerList(players, snapshot.val().maxPlayers);
    });
  });

  // === BEGIN GAME ===
  beginGameBtn.addEventListener("click", () => {
    console.log("Game starting — transitioning to Q&A phase...");
    transitionToPhase("qaPhase");
  });

  function renderPlayerList(players, maxPlayers) {
    playersList.innerHTML = "";
    const playerArray = Object.values(players);
    playerArray.forEach((p) => {
      const li = document.createElement("li");
      li.textContent = p.name;
      playersList.appendChild(li);
    });
    playersCount.textContent = `Players: ${playerArray.length}/${maxPlayers}`;
  }
});

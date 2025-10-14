// Purpose: attach UI handlers only after DOM is ready and guard against missing elements / missing Firebase.

console.log("script.js loaded");

class MultiplayerIfIWereGame {
  constructor() {
    this.db = window.db || null;
    this.roomCode = null;
    this.roomRef = null;
    this.playersRef = null;
    this.isHost = false;
    this.expectedPlayers = 0;
    this.playerName = "";

    // Don't attach UI until DOM is ready
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", () => this.hookUI());
    } else {
      this.hookUI();
    }

    console.log("MultiplayerIfIWereGame constructed — db present?", !!this.db);
  }

  // Safe element getter with multiple id fallbacks
  $$(ids) {
    for (const id of ids) {
      const el = document.getElementById(id);
      if (el) return el;
    }
    return null;
  }

  hookUI() {
    console.log("hookUI: DOM ready — wiring UI");

    // Try multiple common IDs so this file is resilient to small id differences
    const createBtn = this.$$(["createRoomBtn", "createRoom", "create-room-button"]);
    const joinBtn   = this.$$(["joinRoomBtn", "joinRoom", "join-room-button"]);
    const beginBtn  = this.$$(["beginBtn", "beginGame", "begin-game-btn"]);

    if (!createBtn) console.error("Create button not found. Expected id: createRoomBtn/createRoom/create-room-button");
    if (!joinBtn)   console.error("Join button not found. Expected id: joinRoomBtn/joinRoom/join-room-button");
    if (!beginBtn)  console.warn("Begin button not found (host UI). Expected id: beginBtn/beginGame/begin-game-btn");

    // Attach listeners if elements exist
    if (createBtn) createBtn.addEventListener("click", (e) => this.handleCreate(e));
    if (joinBtn)   joinBtn.addEventListener("click", (e) => this.handleJoin(e));
    if (beginBtn)  beginBtn.addEventListener("click", (e) => this.handleBegin(e));

    // Also log useful DOM references for debugging
    console.log("hookUI complete. Found elements:", { createBtn: !!createBtn, joinBtn: !!joinBtn, beginBtn: !!beginBtn });
  }

  // Handler wrappers
  handleCreate(e) {
    console.log("Create button clicked");
    if (!this.db) {
      console.error("Firebase DB (window.db) not found. Make sure firebase-config.js runs before script.js and sets window.db = firebase.database()");
      alert("Firebase not initialized. See console.");
      return;
    }

    const hostNameEl = this.$$(["hostName", "host-name", "host-name-input"]);
    const playerCountEl = this.$$(["playerCount","playerCount","numPlayers","player-count-input"]);

    if (!hostNameEl || !playerCountEl) {
      console.error("Host name or player count element missing. hostNameEl:", !!hostNameEl, "playerCountEl:", !!playerCountEl);
      alert("Host input fields missing. Check HTML IDs.");
      return;
    }

    const hostName = (hostNameEl.value || "").trim();
    const count = parseInt(playerCountEl.value, 10);

    if (!hostName || isNaN(count) || count < 2 || count > 8) {
      alert("Please enter a host name and a valid player count (2–8).");
      return;
    }

    this.createRoom(hostName, count);
  }

  handleJoin(e) {
    console.log("Join button clicked");
    if (!this.db) {
      console.error("Firebase DB (window.db) not found.");
      alert("Firebase not initialized. See console.");
      return;
    }

    const playerNameEl = this.$$(["playerName","player-name","player-name-input"]);
    const roomCodeEl   = this.$$(["roomCodeInput","roomCode","room-code-input","joinCode"]);

    if (!playerNameEl || !roomCodeEl) {
      console.error("Join inputs missing. playerNameEl:", !!playerNameEl, "roomCodeEl:", !!roomCodeEl);
      alert("Join input fields missing. Check HTML IDs.");
      return;
    }

    const name = (playerNameEl.value || "").trim();
    const code = (roomCodeEl.value || "").trim().toUpperCase();

    if (!name || !code) {
      alert("Please enter your name and the room code.");
      return;
    }

    this.joinRoom(name, code);
  }

  handleBegin(e) {
    console.log("Begin button clicked");
    if (!this.isHost) {
      console.warn("Begin clicked by non-host — ignoring");
      return;
    }
    if (!this.roomRef) {
      console.error("Room ref missing; cannot begin");
      return;
    }

    this.roomRef.update({ gameStarted: true })
      .then(() => console.log("Game started flag set in DB"))
      .catch(err => console.error("Failed to set gameStarted:", err));
  }

  // Core flows
  generateRoomCode() {
    return Math.random().toString(36).substring(2, 7).toUpperCase();
  }

  createRoom(hostName, expectedPlayers) {
    this.isHost = true;
    this.playerName = hostName;
    this.expectedPlayers = expectedPlayers;
    this.roomCode = this.generateRoomCode();

    this.roomRef = this.db.ref(`rooms/${this.roomCode}`);
    this.playersRef = this.roomRef.child("players");

    this.roomRef.set({
      host: hostName,
      expectedPlayers: expectedPlayers,
      gameStarted: false
    }).then(() => {
      return this.playersRef.push().set({ name: hostName, joinedAt: Date.now(), isHost: true });
    }).then(() => {
      console.log("Room created:", this.roomCode);
      // show code in UI if spot exists
      const roomCodeDisplay = this.$$(["roomCodeDisplay","roomCode","room-code-display"]);
      if (roomCodeDisplay) roomCodeDisplay.textContent = this.roomCode;
      this.showWaitingUI();
      this.listenForPlayers();
    }).catch(err => {
      console.error("createRoom error:", err);
      alert("Failed to create room — check console.");
    });
  }

  joinRoom(playerName, roomCode) {
    this.playerName = playerName;
    this.roomCode = roomCode;

    this.roomRef = this.db.ref(`rooms/${this.roomCode}`);
    this.playersRef = this.roomRef.child("players");

    // ensure room exists
    this.roomRef.once("value").then(snap => {
      if (!snap.exists()) {
        alert("Room not found.");
        throw new Error("Room not found: " + this.roomCode);
      }
      return this.playersRef.push().set({ name: playerName, joinedAt: Date.now(), isHost: false });
    }).then(() => {
      console.log("Joined room:", this.roomCode);
      // show the code
      const roomCodeDisplay = this.$$(["roomCodeDisplay","roomCode","room-code-display"]);
      if (roomCodeDisplay) roomCodeDisplay.textContent = this.roomCode;
      this.showWaitingUI();
      this.listenForPlayers();
    }).catch(err => {
      console.error("joinRoom error:", err);
    });
  }

  showWaitingUI() {
    // hide landing
    const landing = this.$$(["landing","landing-screen"]);
    const waiting = this.$$(["waitingRoom","waiting-room"]);
    if (landing) landing.classList.add("hidden");
    if (waiting) waiting.classList.remove("hidden");
  }

  listenForPlayers() {
    if (!this.playersRef || !this.roomRef) {
      console.error("listenForPlayers called without refs", this.playersRef, this.roomRef);
      return;
    }

    console.log("Listening for players on room:", this.roomCode);

    this.playersRef.on("value", snap => {
      const playersObj = snap.val() || {};
      const players = Object.values(playersObj).map(p => p.name || "Unnamed");

      // update UI
      const listEl = this.$$(["playerList","player-list","playerListEl","playersList"]);
      if (listEl) {
        listEl.innerHTML = "";
        players.forEach(n => {
          const li = document.createElement("li");
          li.textContent = n;
          listEl.appendChild(li);
        });
      }

      // update players count if element present
      const countEl = this.$$(["playersCount","players-count","playersCountEl"]);
      if (countEl) countEl.textContent = `${players.length} / ${this.expectedPlayers || "?"} joined`;

      // If host and we've reached expected players, show begin
      if (this.isHost && players.length >= this.expectedPlayers) {
        const beginBtn = this.$$(["beginBtn","beginGame","begin-game-btn"]);
        if (beginBtn) beginBtn.classList.remove("hidden");
      }
    });

    // watch gameStarted
    this.roomRef.child("gameStarted").on("value", s => {
      if (s.val() === true) {
        console.log("Game started flag seen — starting game locally");
        this.startGame();
      }
    });
  }

  startGame() {
    const waiting = this.$$(["waitingRoom","waiting-room"]);
    const gamePhase = this.$$(["gamePhase","game-phase","gameArea"]);
    if (waiting) waiting.classList.add("hidden");
    if (gamePhase) gamePhase.classList.remove("hidden");

    const card = this.$$(["questionCard","question-card"]);
    if (card) {
      card.innerHTML = `<div class="card"><h3>First question</h3><p>Example Q&A will go here.</p></div>`;
    }
  }
}

// create instance once DOM loaded
let gameInstance = null;
document.addEventListener("DOMContentLoaded", () => {
  console.log("DOMContentLoaded: creating game instance");
  if (!window.db) console.warn("window.db is falsy — firebase-config.js may not have run yet");
  gameInstance = new MultiplayerIfIWereGame();
});


console.log("Game initialized");

class MultiplayerIfIWereGame {
  constructor() {
    this.roomCode = null;
    this.host = false;
    this.expectedPlayers = 0;
    this.playerName = "";
    this.players = [];

    this.db = window.db;
  }

  // Generate unique room code
  generateRoomCode() {
    return Math.random().toString(36).substring(2, 7).toUpperCase();
  }

  // Create room
  createRoom(hostName, expectedPlayers) {
    this.roomCode = this.generateRoomCode();
    this.host = true;
    this.playerName = hostName;
    this.expectedPlayers = expectedPlayers;

    this.db.ref("rooms/" + this.roomCode).set({
      host: hostName,
      expectedPlayers: expectedPlayers,
      players: {
        [hostName]: true
      },
      gameStarted: false
    });

    this.showWaitingRoom();
    this.listenForPlayers();
  }

  // Join room
  joinRoom(playerName, roomCode) {
    this.roomCode = roomCode;
    this.playerName = playerName;

    const playerRef = this.db.ref(`rooms/${roomCode}/players/${playerName}`);
    playerRef.set(true);

    this.showWaitingRoom();
    this.listenForPlayers();
  }

  // Listen for players
  listenForPlayers() {
    this.db.ref(`rooms/${this.roomCode}/players`).on("value", snapshot => {
      const players = snapshot.val() || {};
      this.players = Object.keys(players);

      this.updatePlayerList();

      // Host logic
      if (this.host) {
        if (this.players.length >= this.expectedPlayers) {
          document.getElementById("beginBtn").classList.remove("hidden");
        }
      }
    });

    this.db.ref(`rooms/${this.roomCode}/gameStarted`).on("value", snapshot => {
      if (snapshot.val()) {
        this.startGame();
      }
    });
  }

  // Update waiting room UI
  updatePlayerList() {
    const listEl = document.getElementById("playerList");
    listEl.innerHTML = "";
    this.players.forEach(p => {
      const li = document.createElement("li");
      li.textContent = p;
      listEl.appendChild(li);
    });
  }

  // Start the game
  startGame() {
    document.getElementById("waitingRoom").classList.add("hidden");
    document.getElementById("gamePhase").classList.remove("hidden");
    document.getElementById("questionCard").innerHTML = `
      <h3>First Question</h3>
      <p>Who is most likely to say "If I were a superhero, I would... ?"</p>
    `;
  }

  // Host clicks Begin
  beginGame() {
    this.db.ref(`rooms/${this.roomCode}`).update({ gameStarted: true });
  }

  // Show waiting room
  showWaitingRoom() {
    document.getElementById("landing").classList.add("hidden");
    document.getElementById("waitingRoom").classList.remove("hidden");
    document.getElementById("roomCodeDisplay").textContent = this.roomCode;
  }
}

// Initialize
document.addEventListener("DOMContentLoaded", () => {
  const game = new MultiplayerIfIWereGame();

  document.getElementById("createRoomBtn").addEventListener("click", () => {
    const hostName = document.getElementById("hostName").value.trim();
    const expectedPlayers = parseInt(document.getElementById("playerCount").value.trim());

    if (hostName && expectedPlayers > 1 && expectedPlayers <= 8) {
      game.createRoom(hostName, expectedPlayers);
    } else {
      alert("Enter host name and valid number of players (2-8).");
    }
  });

  document.getElementById("joinRoomBtn").addEventListener("click", () => {
    const playerName = document.getElementById("playerName").value.trim();
    const roomCode = document.getElementById("roomCodeInput").value.trim().toUpperCase();

    if (playerName && roomCode) {
      game.joinRoom(playerName, roomCode);
    } else {
      alert("Enter your name and room code.");
    }
  });

  document.getElementById("beginBtn").addEventListener("click", () => {
    if (game.host) {
      game.beginGame();
    }
  });
});

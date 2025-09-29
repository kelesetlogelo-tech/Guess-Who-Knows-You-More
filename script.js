class MultiplayerIfIWereGame {
  constructor() {
    console.log("Game initialized");

    this.db = null;
    this.roomId = null;
    this.host = false;
    this.expectedPlayers = 0;

    this.initFirebase();
    this.attachEventListeners();
  }

  initFirebase() {
    try {
      this.db = firebase.database();
      console.log("Firebase ready");
    } catch (err) {
      console.error("Firebase init error:", err);
    }
  }

  attachEventListeners() {
    document.getElementById("create-room-btn").addEventListener("click", () => this.createRoom());
    document.getElementById("join-room-btn").addEventListener("click", () => this.joinRoom());
    document.getElementById("begin-game-btn").addEventListener("click", () => this.beginGame());
  }

  generateRoomCode() {
    return Math.random().toString(36).substring(2, 7).toUpperCase();
  }

  createRoom() {
    const hostName = document.getElementById("host-name").value.trim();
    const playerCount = parseInt(document.getElementById("player-count").value);

    if (!hostName || isNaN(playerCount) || playerCount < 2 || playerCount > 8) {
      alert("Enter host name and number of players (2–8)");
      return;
    }

    this.roomId = this.generateRoomCode();
    this.host = true;
    this.expectedPlayers = playerCount;

    const roomRef = this.db.ref("rooms/" + this.roomId);
    roomRef.set({
      host: hostName,
      expectedPlayers: playerCount,
      players: { [hostName]: true },
      status: "waiting"
    });

    this.showWaitingRoom(hostName);
    this.listenForPlayers();
  }

  joinRoom() {
    const playerName = document.getElementById("player-name").value.trim();
    const roomCode = document.getElementById("room-code").value.trim().toUpperCase();

    if (!playerName || !roomCode) {
      alert("Enter your name and room code");
      return;
    }

    this.roomId = roomCode;
    const roomRef = this.db.ref("rooms/" + roomCode);

    roomRef.once("value").then(snapshot => {
      if (!snapshot.exists()) {
        alert("Room does not exist");
        return;
      }

      const roomData = snapshot.val();
      if (Object.keys(roomData.players).length >= roomData.expectedPlayers) {
        alert("Room is full");
        return;
      }

      roomRef.child("players").update({ [playerName]: true });
      this.showWaitingRoom(playerName);
      this.listenForPlayers();
    });
  }

  showWaitingRoom(playerName) {
    document.getElementById("landing-screen").classList.add("hidden");
    document.getElementById("waiting-room").classList.remove("hidden");
    document.getElementById("room-info").innerText = `Room Code: ${this.roomId}`;
  }

  listenForPlayers() {
    const roomRef = this.db.ref("rooms/" + this.roomId);

    roomRef.on("value", snapshot => {
      if (!snapshot.exists()) return;

      const roomData = snapshot.val();
      const players = Object.keys(roomData.players || {});
      const playerList = document.getElementById("player-list");
      playerList.innerHTML = "";
      players.forEach(p => {
        const li = document.createElement("li");
        li.textContent = p;
        playerList.appendChild(li);
      });

      if (this.host && players.length === roomData.expectedPlayers) {
        document.getElementById("begin-game-btn").classList.remove("hidden");
      }

      if (roomData.status === "started") {
        this.startGame();
      }
    });
  }

  beginGame() {
    this.db.ref("rooms/" + this.roomId).update({ status: "started" });
  }

  startGame() {
    document.getElementById("waiting-room").classList.add("hidden");
    document.getElementById("game-screen").classList.remove("hidden");
    document.getElementById("game-area").innerHTML = "<p>Game has begun!</p>";
  }
}

document.addEventListener("DOMContentLoaded", () => {
  new MultiplayerIfIWereGame();
});


console.log("Game initialized");

class MultiplayerIfIWereGame {
  constructor() {
    this.db = db;
    this.roomRef = null;
    this.roomCode = null;
    this.host = false;
    this.hostName = "";
    this.numPlayers = 0;

    this.bindUI();
  }

  bindUI() {
    document.getElementById("createRoom").addEventListener("click", () => this.createRoom());
    document.getElementById("joinRoom").addEventListener("click", () => this.joinRoom());
    document.getElementById("beginGame").addEventListener("click", () => this.startGame());
  }

  generateRoomCode() {
    return Math.random().toString(36).substring(2, 7).toUpperCase();
  }

  createRoom() {
    this.host = true;
    this.hostName = document.getElementById("hostName").value.trim();
    this.numPlayers = parseInt(document.getElementById("numPlayers").value);
    if (!this.hostName || isNaN(this.numPlayers) || this.numPlayers < 2 || this.numPlayers > 8) {
      alert("Enter host name and valid number of players (2-8).");
      return;
    }
    this.roomCode = this.generateRoomCode();
    this.roomRef = this.db.ref("rooms/" + this.roomCode);
    this.roomRef.set({
      host: this.hostName,
      numPlayers: this.numPlayers,
      players: { [this.hostName]: true },
      started: false
    });
    document.getElementById("landing").classList.add("hidden");
    document.getElementById("waitingRoom").classList.remove("hidden");
    document.getElementById("waitingRoomCode").innerText = this.roomCode;
    this.listenForPlayers();
  }

  joinRoom() {
    const playerName = document.getElementById("playerName").value.trim();
    const code = document.getElementById("roomCode").value.trim().toUpperCase();
    if (!playerName || !code) {
      alert("Enter your name and room code.");
      return;
    }
    this.roomCode = code;
    this.roomRef = this.db.ref("rooms/" + this.roomCode);
    this.roomRef.once("value", (snapshot) => {
      if (!snapshot.exists()) {
        alert("Room not found.");
        return;
      }
      this.roomRef.child("players").update({ [playerName]: true });
      document.getElementById("landing").classList.add("hidden");
      document.getElementById("waitingRoom").classList.remove("hidden");
      document.getElementById("waitingRoomCode").innerText = this.roomCode;
      this.listenForPlayers();
    });
  }

  listenForPlayers() {
    this.roomRef.child("players").on("value", (snapshot) => {
      const players = snapshot.val() || {};
      const list = document.getElementById("playerList");
      list.innerHTML = "";
      Object.keys(players).forEach((name) => {
        const li = document.createElement("li");
        li.textContent = name;
        list.appendChild(li);
      });

      if (this.host && Object.keys(players).length === this.numPlayers) {
        document.getElementById("beginGame").classList.remove("hidden");
      }
    });

    this.roomRef.child("started").on("value", (snapshot) => {
      if (snapshot.val() === true) {
        document.getElementById("waitingRoom").classList.add("hidden");
        document.getElementById("gameArea").classList.remove("hidden");
      }
    });
  }

  startGame() {
    this.roomRef.update({ started: true });
  }
}

document.addEventListener("DOMContentLoaded", () => {
  new MultiplayerIfIWereGame();
});

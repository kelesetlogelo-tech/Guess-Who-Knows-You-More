console.log("Game initialized");

class MultiplayerIfIWereGame {
  constructor() {
    this.roomCode = null;
    this.isHost = false;
    this.hostName = "";
    this.numPlayers = 0;
    this.roomRef = null;

    this.init();
  }

  init() {
    document.getElementById("createRoom").addEventListener("click", () => this.createRoom());
    document.getElementById("joinRoom").addEventListener("click", () => this.joinRoom());
    document.getElementById("beginGame").addEventListener("click", () => this.startGame());
  }

  generateRoomCode() {
    return Math.random().toString(36).substring(2, 7).toUpperCase();
  }

  createRoom() {
    this.isHost = true;
    this.hostName = document.getElementById("hostName").value.trim();
    this.numPlayers = parseInt(document.getElementById("numPlayers").value.trim(), 10);

    if (!this.hostName || isNaN(this.numPlayers) || this.numPlayers < 2 || this.numPlayers > 8) {
      alert("Enter host name and valid number of players (2-8).");
      return;
    }

    this.roomCode = this.generateRoomCode();
    this.roomRef = window.db.ref("rooms/" + this.roomCode);

    this.roomRef.set({
      host: this.hostName,
      expectedPlayers: this.numPlayers,
      players: {
        [this.hostName]: { joined: true }
      },
      status: "waiting"
    });

    document.getElementById("roomCodeDisplay").innerText = this.roomCode;
    this.showWaitingRoom();
    this.listenForPlayers();
  }

  joinRoom() {
    const playerName = document.getElementById("playerName").value.trim();
    const code = document.getElementById("roomCodeInput").value.trim().toUpperCase();

    if (!playerName || !code) {
      alert("Enter your name and room code.");
      return;
    }

    this.roomCode = code;
    this.roomRef = window.db.ref("rooms/" + this.roomCode);

    this.roomRef.child("players/" + playerName).set({ joined: true });

    document.getElementById("roomCodeDisplay").innerText = this.roomCode;
    this.showWaitingRoom();
    this.listenForPlayers();
  }

  listenForPlayers() {
    this.roomRef.on("value", snapshot => {
      const roomData = snapshot.val();
      if (!roomData) return;

      const playerList = document.getElementById("playerList");
      playerList.innerHTML = "";

      if (roomData.players) {
        Object.keys(roomData.players).forEach(name => {
          const li = document.createElement("li");
          li.textContent = name;
          playerList.appendChild(li);
        });
      }

      if (this.isHost &&
          roomData.players &&
          Object.keys(roomData.players).length >= roomData.expectedPlayers &&
          roomData.status === "waiting") {
        document.getElementById("beginGame").classList.remove("hidden");
      }

      if (roomData.status === "started") {
        this.startGame();
      }
    });
  }

  showWaitingRoom() {
    document.getElementById("hostSection").classList.add("hidden");
    document.getElementById("joinSection").classList.add("hidden");
    document.getElementById("waitingRoom").classList.remove("hidden");
  }

  startGame() {
    if (this.isHost) {
      this.roomRef.update({ status: "started" });
    }

    document.getElementById("waitingRoom").classList.add("hidden");
    document.getElementById("gameArea").classList.remove("hidden");

    // Example dummy question card
    document.getElementById("questionCard").innerHTML = `
      <h3>If I were an animal, I would be...</h3>
      <ul>
        <li>🐱 Cat</li>
        <li>🐶 Dog</li>
        <li>🦁 Lion</li>
        <li>🦉 Owl</li>
      </ul>
    `;
  }
}

new MultiplayerIfIWereGame();

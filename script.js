class MultiplayerIfIWereGame {
  constructor() {
    console.log("Game initialized");
    this.db = null;
    this.currentRoomId = null;
    this.playerId = "player-" + Math.floor(Math.random() * 10000);
    this.players = {};

    this.initFirebase();
  }

  initFirebase() {
    try {
      this.db = firebase.database();
      console.log("Firebase database ready");
    } catch (error) {
      console.error("Firebase init error:", error);
    }
  }

  createRoom() {
    const roomId = "room-" + Math.floor(Math.random() * 10000);
    const roomRef = this.db.ref("rooms/" + roomId);

    // Initialize room with host as first player
    roomRef.set({
      createdAt: Date.now(),
      players: {
        [this.playerId]: { id: this.playerId, joinedAt: Date.now() }
      }
    });

    this.currentRoomId = roomId;
    this.listenToRoom(roomId);

    console.log("Room created:", roomId);
    alert("Room created! Share this Room ID: " + roomId);
  }

  joinRoom(roomId) {
    const roomRef = this.db.ref("rooms/" + roomId + "/players/" + this.playerId);

    roomRef.set({ id: this.playerId, joinedAt: Date.now() })
      .then(() => {
        this.currentRoomId = roomId;
        this.listenToRoom(roomId);
        console.log("Joined room:", roomId);
        alert("Successfully joined room " + roomId);
      })
      .catch(err => {
        console.error("Error joining room:", err);
        alert("Could not join room. Check the ID and try again.");
      });
  }

  listenToRoom(roomId) {
    const roomRef = this.db.ref("rooms/" + roomId + "/players");

    roomRef.on("value", snapshot => {
      const players = snapshot.val() || {};
      this.players = players;
      console.log("Updated players in room:", players);

      // Update players list in UI
      const playersList = document.getElementById("players-list");
      playersList.innerHTML = "<h3>Players in Room:</h3><ul>" +
        Object.values(players).map(p => `<li>${p.id}</li>`).join("") +
        "</ul>";
    });
  }
}

document.addEventListener("DOMContentLoaded", () => {
  const game = new MultiplayerIfIWereGame();

  document.getElementById("create-room-button")
    .addEventListener("click", () => game.createRoom());

  document.getElementById("join-room-button")
    .addEventListener("click", () => {
      const roomId = prompt("Enter Room ID to join:");
      if (roomId) game.joinRoom(roomId);
    });
});

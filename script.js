console.log("✅ script.js loaded");

const $ = id => document.getElementById(id);
let gameRef = null;
let playerId = null;
let isHost = false;

function showPage(id) {
  document.querySelectorAll(".page").forEach(p => p.classList.remove("active"));
  const el = $(id);
  if (el) el.classList.add("active");
}

document.addEventListener("DOMContentLoaded", () => {
  console.log("DOM ready");

  $("createRoomBtn").onclick = createRoom;
  $("joinRoomBtn").onclick = joinRoom;
  $("beginGameBtn").onclick = () => {
    if (isHost && gameRef) gameRef.child("phase").set("qa");
  };
});

async function createRoom() {
  const name = $("hostName").value.trim();
  const count = parseInt($("playerCount").value.trim(), 10);
  if (!name || isNaN(count) || count < 2) return alert("Enter name + number of players");

  const code = Math.random().toString(36).substring(2, 7).toUpperCase();
  playerId = name;
  isHost = true;

  if (!window.db) return alert("Database not ready");

  gameRef = window.db.ref("rooms/" + code);
  await gameRef.set({
    host: name,
    numPlayers: count,
    phase: "waiting",
    players: { [name]: { score: 0, ready: false } }
  });

  localStorage.setItem("roomCode", code);
  localStorage.setItem("isHost", "true");

  $("roomCodeDisplay").textContent = "Room Code: " + code;
  showPage("waiting");

  subscribeToRoom(code);
  console.log("✅ Room created:", code);
}

async function joinRoom() {
  const name = $("playerName").value.trim();
  const code = $("roomCode").value.trim().toUpperCase();
  if (!name || !code) return alert("Enter name and room code");

  playerId = name;
  isHost = false;

  if (!window.db) return alert("Database not ready");
  gameRef = window.db.ref("rooms/" + code);

  const snap = await gameRef.once("value");
  if (!snap.exists()) return alert("Room not found");

  await gameRef.child("players/" + name).set({ score: 0, ready: false });

  localStorage.setItem("roomCode", code);
  localStorage.setItem("isHost", "false");

  $("roomCodeDisplay").textContent = "Room Code: " + code;
  showPage("waiting");

  subscribeToRoom(code);
  console.log("✅ Joined room:", code);
}

function subscribeToRoom(code) {
  const ref = window.db.ref("rooms/" + code);
  ref.on("value", snap => {
    const data = snap.val();
    if (!data) return;
    updateWaitingRoom(data);
    if (data.phase === "qa") startQA();
  });
}

function updateWaitingRoom(data) {
  const list = $("playerList");
  const btn = $("beginGameBtn");
  if (!list) return;

  list.innerHTML = Object.keys(data.players || {})
    .map(p => `<li>${p}</li>`)
    .join("");

  // Only host sees the "Begin Game" button
  if (isHost && Object.keys(data.players).length >= data.numPlayers) {
    btn.classList.remove("hidden");
  } else {
    btn.classList.add("hidden");
  }
}

function startQA() {
  showPage("qa");
  const container = $("qaContainer");
  container.innerHTML = "<p>Question time! (This is just a placeholder)</p>";
}

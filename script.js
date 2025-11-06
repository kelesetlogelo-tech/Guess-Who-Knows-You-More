console.log("script.js loaded");

document.addEventListener("DOMContentLoaded", () => {
  console.log("DOM fully loaded");

  // ===== Helper =====
  const $ = id => document.getElementById(id);

  function showSection(id) {
    document.querySelectorAll("section.page").forEach(s => s.classList.add("hidden"));
    const el = document.getElementById(id);
    if (el) el.classList.remove("hidden");
  }

  // ===== State =====
  let gameRef = null;
  let playerId = null;
  let isHost = false;

  // ====== CREATE ROOM ======
  async function createRoom() {
    const name = $("hostName").value.trim();
    const count = parseInt($("playerCount").value.trim());

    if (!name || !count) {
      alert("Enter your name and number of players");
      return;
    }

    const code = Math.random().toString(36).substring(2, 7).toUpperCase();
    console.log("Generated Room Code:", code);

    playerId = name;
    isHost = true;

    if (!window.db) {
      console.error("Firebase not initialized — window.db missing");
      alert("Database not ready. Please refresh and try again.");
      return;
    }

    gameRef = window.db.ref("rooms/" + code);
    await gameRef.set({
      host: name,
      numPlayers: count,
      phase: "waiting",
      players: { [name]: { score: 0 } }
    });

    $("room-code-display-game").textContent = "Room Code: " + code;
    $("players-count").textContent = `Players joined: 1 / ${count}`;

    showSection("waitingRoom");
    subscribeToGame(code);
  }

  // ====== JOIN ROOM ======
  async function joinRoom() {
    const name = $("playerName").value.trim();
    const code = $("roomCode").value.trim().toUpperCase();

    if (!name || !code) {
      alert("Enter your name and room code");
      return;
    }

    playerId = name;
    isHost = false;

    if (!window.db) {
      console.error("Firebase not initialized — window.db missing");
      alert("Database not ready. Please refresh and try again.");
      return;
    }

    gameRef = window.db.ref("rooms/" + code);
    await gameRef.child("players/" + name).set({ score: 0 });

    showSection("waitingRoom");
    subscribeToGame(code);
  }

// ---------------- SUBSCRIBE TO GAME ----------------
function subscribeToGame(code) {
  if (!window.db) return;

  const ref = window.db.ref("rooms/" + code);

  ref.on("value", snap => {
    const data = snap.val();
    if (!data) return;

    // --- ROOM CODE & PLAYER COUNTS ---
    $("room-code-display-game").textContent = "Room Code: " + code;
    const playersObj = data.players || {};
    const joinedCount = Object.keys(playersObj).length;
    const expected = data.numPlayers || "?";
    $("players-count").textContent = `Players joined: ${joinedCount} / ${expected}`;

    // --- UPDATE PLAYER LIST ---
    const list = $("playerList");
    list.innerHTML = "";
    Object.keys(playersObj).forEach(name => {
      const li = document.createElement("li");
      const ready = playersObj[name].ready ? " ✅" : "";
      li.textContent = name + ready;
      list.appendChild(li);
    });

    // --- HOST: SHOW BEGIN GAME BUTTON WHEN FULL ---
    const beginBtn = $("begin-game-btn");
    if (isHost && beginBtn) {
      if (joinedCount >= expected) beginBtn.classList.remove("hidden");
      else beginBtn.classList.add("hidden");
    }

    // --- 🔧 HANDLE PHASE CHANGES SAFELY ---
    // Prevent re-triggering the QA phase if we’re already in it
    if (data.phase !== window.currentPhase) {
      window.currentPhase = data.phase;
      renderPhase(data.phase, code);
    }

    // --- 🔧 If all players ready, host moves to guessing ---
    if (isHost && data.phase === "pre-guess") {
      const allReady = Object.values(playersObj).every(p => p.ready);
      if (allReady) {
        ref.child("phase").set("guessing");
      }
    }
  });
}

  // ====== Q&A ======
  const questions = [
    { id: 'q1', text: "If I were a sound effect, I'd be:", options: ["Ka-ching!", "Dramatic gasp", "Boing!", "Evil laugh"] },
    { id: 'q2', text: "If I were a weather forecast, I'd be:", options: ["100% chill", "Partly dramatic with a chance of chaos!", "Heatwave vibes", "Sudden tornado of opinions"] },
    { id: 'q3', text: "If I were a breakfast cereal, I'd be:", options: ["Jungle Oats", "WeetBix", "Rice Krispies", "MorVite", "That weird healthy one no-one eats"] },
    { id: 'q4', text: "If I were a bedtime excuse, I'd be...", options: ["I need water", "There's a spider in my room", "I can't sleep without 'Pillow'", "There see shadows outside my window", "Just one more episode"] },
    { id: 'q5', text: "If I were a villain in a movie, I'd be...", options: ["Scarlet Overkill", "Grinch", "Thanos", "A mosquito in your room at night", "Darth Vader"] },
    { id: 'q6', text: "If I were a kitchen appliance, I'd be...", options: ["A blender on high speed with no lid", "A toaster that only pops when no one’s looking", "Microwave that screams when it’s done", "A fridge that judges your snack choices"] },
    { id: 'q7', text: "If I were a dance move, I'd be...", options: ["The awkward shuffle at weddings", "Kwasakwasa, Ba-baah!", "The “I thought no one was watching” move", "The knee-pop followed by a regretful sit-down"] },
    { id: 'q8', text: "If I were a text message, I'd be...", options: ["A typo-ridden voice-to-text disaster", "A three-hour late 'LOL'", "A group chat gif spammer", "A mysterious 'K.' with no context"] },
    { id: 'q9', text: "If I were a warning label, I'd be...", options: ["Caution: May spontaneously break into song", "Contents may cause uncontrollable giggles", "Qaphela: Gevaar/Ingozi", "Warning: Will talk your ear off about random facts", "May contain traces of impulsive decisions"] },
    { id: 'q10', text: "If I were a type of chair, I’d be…", options: ["A Phala Phala sofa", "A creaky antique that screams when you sit", "One of those folding chairs that attack your fingers", "A throne made of regrets and snack crumbs"] }
  ];

  let currentQuestion = 0;
  let answers = {};

  function startQA() {
    currentQuestion = 0;
    answers = {};
    renderQuestion();
  }

  function renderQuestion() {
  const container = $("qa-container");
  container.innerHTML = "";

  const q = questions[currentQuestion];
  if (!q) return markPlayerReady();

  // --- Question Counter ---
  const counter = document.createElement("div");
  counter.className = "question-counter";
  counter.textContent = `Question ${currentQuestion + 1} of ${questions.length}`;
  container.appendChild(counter);

  // --- Question Tile ---
  const tile = document.createElement("div");
  tile.className = "qa-tile active";
  tile.innerHTML = `
    <h3 class="question-text">${q.text}</h3>
    <div class="options-grid">
      ${q.options
        .map(opt => `<button class="option-btn">${opt}</button>`)
        .join("")}
    </div>
  `;
  container.appendChild(tile);

  // --- Button Behavior ---
  tile.querySelectorAll(".option-btn").forEach(btn => {
    btn.onclick = () => {
      answers[q.text] = btn.textContent;
      tile.classList.add("slide-out");
      setTimeout(() => {
        currentQuestion++;
        renderQuestion();
      }, 600);
    };
  });
}

  function markPlayerReady() {
    if (!gameRef || !playerId) return;
    gameRef.child(`players/${playerId}/ready`).set(true);
    showSection("pre-guess-waiting");
  }

  // ====== BUTTON LISTENERS ======
  $("create-room-btn").addEventListener("click", createRoom);
  $("join-room-btn").addEventListener("click", joinRoom);
  $("begin-game-btn").addEventListener("click", () => {
    if (gameRef) gameRef.child("phase").set("qa");
  });

 // ---------------- RENDER PHASE ----------------
function renderPhase(phase, code) {
  const overlay = document.getElementById("phase-transition-overlay");
  if (!overlay) return;

  overlay.classList.add("active");

  setTimeout(() => {
    document.body.className = document.body.className
      .split(" ")
      .filter(c => !c.includes("-phase"))
      .join(" ")
      .trim();

    document.body.classList.add(`${phase}-phase`);

    switch (phase) {
      case "waiting":
        showSection("waitingRoom");
        break;

      case "qa":
        // 🔧 Start QA only once per player
        if (!window.qaStarted) {
          window.qaStarted = true;
          showSection("qa-phase");
          startQA();
        }
        break;

      case "pre-guess":
        showSection("pre-guess-waiting");
        break;

      case "guessing":
        showSection("guessing-phase");
        startGuessing();
        break;

      case "scoreboard":
        showSection("scoreboard");
        break;

      default:
        showSection("landing");
        break;
    }

    setTimeout(() => overlay.classList.remove("active"), 600);
  }, 600);
} 

  console.log("✅ script.js fully loaded!");
});


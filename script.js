console.log("script.js loaded");

document.addEventListener("DOMContentLoaded", () => {
  console.log("DOM fully loaded");

  // 👇 Show the home page on load
  const firstPage = document.querySelector(".page");
  if (firstPage) firstPage.classList.add("active");
  const $ = (id) => document.getElementById(id);
  // Attach listeners
  $("createRoomBtn").onclick = createRoom;
  $("joinRoomBtn").onclick = joinRoom;

  function showSection(id) {
      document.querySelectorAll("section.page").forEach(s => {
        s.classList.remove("active");
        s.classList.add("fade-out");
        setTimeout(() => s.classList.add("hidden"), 400);
  }

  let gameRef = null;
  let playerId = null;
  let isHost = false;

  // === CREATE ROOM ===
  async function createRoom() {
    const name = $("hostName").value.trim();
    const count = parseInt($("playerCount").value.trim(), 10);
    if (!name || !count || isNaN(count) || count < 2) {
      alert("Enter your name and number of players (min 2).");
      return;
    }

    const code = Math.random().toString(36).substring(2, 7).toUpperCase();
    playerId = name;
    isHost = true;

    if (!window.db) {
      alert("Database not ready. Please refresh.");
      return;
    }

    gameRef = window.db.ref("rooms/" + code);
    await gameRef.set({
      host: name,
      numPlayers: count,
      phase: "waiting",
      players: { [name]: { score: 0, ready: false } },
    });

    $("room-code-display-game").textContent = "Room Code: " + code;
    $("playerCount").textContent = `Players joined: 1 / ${count}`;
    transitionToPhase("waitingRoom");

    subscribeToGame(code);
    console.log("✅ Room created with code:", code);
   }


  // === JOIN ROOM ===
  async function joinRoom() {
    const name = $("playerName").value.trim();
    const code = $("roomCode").value.trim().toUpperCase();
    if (!name || !code) return alert("Enter name and room code");

    playerId = name;
    isHost = false;

    if (!window.db) return alert("Database not ready. Please refresh.");
    gameRef = window.db.ref("rooms/" + code);

    const snap = await gameRef.once("value");
    if (!snap.exists()) return alert("Room not found.");

    await gameRef.child("players/" + name).set({ score: 0, ready: false });
    
  });

  const next = document.getElementById(id);
  next.classList.remove("hidden", "fade-out");
  next.classList.add("fade-in", "active");
}
    subscribeToGame(code);
  }

  // === SUBSCRIBE TO GAME ===
  function subscribeToGame(code) {
    const ref = window.db.ref("rooms/" + code);
    gameRef = ref;

    ref.on("value", (snapshot) => {
      const data = snapshot.val();
      if (!data) return;

      updateRoomUI(data, code);
      const phase = data.phase;

      if (phase === "qa") showQA(data);
      else if (phase === "guessing") showGuessing(data);
      else if (phase === "scoreboard") showScoreboard(data);
      else if (phase === "reveal") showRevealPhase(data);
    });
  }

  // === UPDATE WAITING ROOM ===
  function updateRoomUI(data, code) {
    const players = data.players || {};
    $("players-count").textContent = `Players joined: ${Object.keys(players).length} / ${data.numPlayers}`;
    $("player-list").innerHTML = Object.keys(players)
      .map((p) => `<li>${p}${p === data.host ? " 👑" : ""}</li>`)
      .join("");

    if (isHost && Object.keys(players).length === data.numPlayers && data.phase === "waiting") {
      // move to Q&A
      gameRef.update({ phase: "qa" });
    }
  }

  // === Q&A PHASE ===
  function showQA(data) {
    transitionToPhase("qaPhase");
    const container = $("qa-questions");
    container.innerHTML = "";
    const questions = [
       { id: 'q1', text: 'If I were a sound effect, I\'d be:', options: ['Ka-ching!', 'Dramatic gasp', 'Boing!', 'Evil laugh'] },
            { id: 'q2', text: 'If I were a weather forecast, I\'d be:', options: ['100% chill', 'Partly dramatic with a chance of chaos!', 'Heatwave vibes', 'Sudden tornado of opinions'] },
            { id: 'q3', text: 'If I were a breakfast cereal, I\'d be:', options: ['Jungle Oats', 'WeetBix', 'Rice Krispies', 'MorVite', 'That weird healthy one no-one eats'] },
            { id: 'q4', text: 'If I were a bedtime excuse, I\'d be...', options: [
                'I need water',
                "There\'s a spider in my room",
                "I can\'t sleep without \"Pillow\"",
                'There see shadows outside my window',
                'Just one more episode'
            ] },
            { id: 'q5', text: 'If I were a villain in a movie, I\'d be...', options: [
                'Scarlet Overkill',
                'Grinch',
                'Thanos',
                'A mosquito in your room at night',
                'Darth Vader'
            ] },
            { id: 'q6', text: 'If I were a kitchen appliance, I\'d be...', options: [
                'A blender on high speed with no lid',
                'A toaster that only pops when no one’s looking',
                'Microwave that screams when it’s done',
                'A fridge that judges your snack choices'
            ] },
            { id: 'q7', text: 'If I were a dance move, I\'d be...', options: [
                'The awkward shuffle at weddings',
                'Kwasakwasa, Ba-baah!',
                'The “I thought no one was watching” move',
                'The knee-pop followed by a regretful sit-down'
            ] },
            { id: 'q8', text: 'If I were a text message, I\'d be...', options: [
                'A typo-ridden voice-to-text disaster',
                'A three-hour late “LOL”',
                'A group chat gif spammer',
                'A mysterious “K.” with no context'
            ] },
            { id: 'q9', text: 'If I were a warning label, I\'d be...', options: [
                'Caution: May spontaneously break into song',
                'Contents may cause uncontrollable giggles',
                'Qaphela: Gevaar/Ingozi',
                'Warning: Will talk your ear off about random facts',
                'May contain traces of impulsive decisions'
            ] },
            { id: 'q10', text: 'If I were a type of chair, I’d be…', options: [
                'A Phala Phala sofa',
                'A creaky antique that screams when you sit',
                'One of those folding chairs that attack your fingers',
                'A throne made of regrets and snack crumbs'
            ] }
    ];

    questions.forEach((q, idx) => {
      const div = document.createElement("div");
      div.innerHTML = `
        <p>${q}</p>
        <input type="text" id="answer-${idx}" placeholder="Your answer..." />
      `;
      container.appendChild(div);
    });

    $("submitAnswersBtn").onclick = async () => {
      const answers = {};
      questions.forEach((_, i) => {
        const val = $(`answer-${i}`).value.trim();
        answers[i] = val || "—";
      });
      await gameRef.child("answers").child(playerId).set(answers);
      await gameRef.child("players").child(playerId).update({ ready: true });
      alert("✅ Answers submitted!");

      if (isHost) checkAllReady(data);
    };
  }

  async function checkAllReady(data) {
    const snap = await gameRef.child("players").once("value");
    const players = snap.val() || {};
    const allReady = Object.values(players).every((p) => p.ready);
    if (allReady) gameRef.update({ phase: "guessing" });
  }

  // === GUESSING PHASE ===
  function showGuessing(data) {
    transitionToPhase("guessingPhase");
    const container = $("guessing-content");
    container.innerHTML = `<p>Guess who gave which answers!</p>`;
    if (isHost) {
      setTimeout(() => gameRef.update({ phase: "scoreboard" }), 5000);
    }
  }

  // === SCOREBOARD PHASE ===
  function showScoreboard(data) {
    transitionToPhase("scoreboardPhase");
    const container = $("scoreboard");
    const players = data.players || {};

    let html = `<ul>`;
    Object.entries(players).forEach(([name, p]) => {
      html += `<li>${name}: <strong>${p.score || 0}</strong> pts</li>`;
    });
    html += `</ul>`;
    container.innerHTML = html;

    if (isHost) $("revealWinnerBtn").classList.remove("hidden");

    $("revealWinnerBtn").onclick = () => gameRef.update({ phase: "reveal" });
  }

  // === REVEAL PHASE ===
  function showRevealPhase(data) {
    transitionToPhase("revealPhase");
    const container = $("revealPhase");
    const players = data.players || {};
    const sorted = Object.entries(players)
      .map(([n, o]) => ({ name: n, score: o.score || 0 }))
      .sort((a, b) => b.score - a.score);

    const winner = sorted[0]?.name || "Someone";
    const highScore = sorted[0]?.score || 0;
    launchConfetti();

    container.innerHTML = `
      <div class="reveal-phase fade-in pastel-bg">
        <h1 class="grand-title">🎉 The DoodleDazzle Champion Is...</h1>
        <h2 class="winner-name">${winner}</h2>
        <p class="scene-tagline">“All hail the master of mind-melding guesses!”</p>

        <div class="podium-container">
          <div class="podium second">
            <div class="podium-rank">2️⃣</div>
            <div class="player-name">${sorted[1]?.name || "—"}</div>
            <div class="score">${sorted[1]?.score || 0} pts</div>
          </div>
          <div class="podium first">
            <div class="podium-rank">🏆</div>
            <div class="player-name">${winner}</div>
            <div class="score">${highScore} pts</div>
          </div>
          <div class="podium third">
            <div class="podium-rank">3️⃣</div>
            <div class="player-name">${sorted[2]?.name || "—"}</div>
            <div class="score">${sorted[2]?.score || 0} pts</div>
          </div>
        </div>

        <button class="vibrant-btn" onclick="location.reload()">Play Again 🔁</button>
      </div>
    `;
  }

  // === CONFETTI ===
  function launchConfetti() {
    const canvas = document.createElement("canvas");
    canvas.id = "confetti-canvas";
    Object.assign(canvas.style, {
      position: "fixed",
      top: "0",
      left: "0",
      width: "100vw",
      height: "100vh",
      pointerEvents: "none",
    });
    document.body.appendChild(canvas);

    const ctx = canvas.getContext("2d");
    const pieces = Array.from({ length: 150 }, () => ({
      x: Math.random() * window.innerWidth,
      y: Math.random() * -window.innerHeight,
      size: Math.random() * 8 + 4,
      color: `hsl(${Math.random() * 360}, 80%, 70%)`,
      speed: Math.random() * 4 + 2,
    }));

    function draw() {
      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
      pieces.forEach((p) => {
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x, p.y, p.size, p.size);
        p.y += p.speed;
        if (p.y > window.innerHeight) p.y = -10;
      });
      requestAnimationFrame(draw);
    }
    draw();
    setTimeout(() => canvas.remove(), 10000);
  }

  /* ===== DYNAMIC BACKGROUND GRADIENTS ===== */
function updateBackgroundForPhase(phase) {
  const body = document.body;
  body.className = ""; // reset all classes first
  body.classList.add(`${phase}-phase`);
}

/* ===== PHASE TRANSITION HANDLER ===== */
function transitionToPhase(phaseId) {
  const current = document.querySelector(".page.active");
  const next = document.getElementById(phaseId);
  if (!next) return;

  // Fade out current section
  if (current) {
    current.classList.add("fade-out");
    setTimeout(() => {
      current.classList.remove("active", "fade-out");
      current.classList.add("hidden");

      // Fade in new section
      next.classList.remove("hidden");
      next.classList.add("active", "fade-in");
      setTimeout(() => next.classList.remove("fade-in"), 800);

      // Update background gradient
      updateBackgroundForPhase(phaseId);
    }, 600);
  } else {
    // First load case
    next.classList.remove("hidden");
    next.classList.add("active");
    updateBackgroundForPhase(phaseId);
  }
}


// Similarly:
// transitionToPhase("qa-phase");
// transitionToPhase("scoreboard");
// transitionToPhase("reveal-phase");

  // === EVENT BINDINGS ===
  $("createRoomBtn")?.addEventListener("click", createRoom);
  $("joinRoomBtn")?.addEventListener("click", joinRoom);
});







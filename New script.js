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

  // ===== SUBSCRIBE TO GAME =====
  function subscribeToGame(code) {
    if (!window.db) return;
    const ref = window.db.ref("rooms/" + code);
    gameRef = ref;

    ref.on("value", snapshot => {
      const data = snapshot.val();
      if (!data) return;

      updateRoomUI(data, code);
      if (data.phase === "guessing") startGuessingPhase(data);
      else if (data.phase === "scoreboard") showScoreboard(data);
      else if (data.phase === "reveal") showRevealPhase(data);
    });
  }

  // ===== UPDATE ROOM UI =====
  function updateRoomUI(data, code) {
    const players = data.players || {};
    const count = Object.keys(players).length;
    $("players-count").textContent = `Players joined: ${count} / ${data.numPlayers}`;

    if (isHost && data.phase === "waiting" && count === data.numPlayers) {
      $("start-game-btn").classList.remove("hidden");
      $("start-game-btn").onclick = () => {
        gameRef.update({ phase: "qa" });
        showSection("qaPhase");
      };
    }

    if (data.phase === "qa") {
      showSection("qaPhase");
    } else if (data.phase === "pre-guess") {
      if (isHost) showHostAdvanceButton();
      else showSection("pre-guess-waiting");
    }
  }

  // ===== HOST ADVANCE BUTTON =====
  function showHostAdvanceButton() {
    const container = $("game-area");
    container.innerHTML = `
      <div class="fade-in guessing-intro">
        <h3>All players are ready!</h3>
        <p class="scene-tagline">“Brace yourselves… guessing begins!”</p>
        <button id="begin-guessing" class="vibrant-btn">Begin Guessing 🎯</button>
      </div>
    `;
    $("begin-guessing").onclick = () => {
      gameRef.update({ phase: "guessing" });
    };
  }

  // ===== START GUESSING PHASE =====
  function startGuessingPhase(data) {
    const container = $("game-area");
    const playersObj = data.players || {};
    const sortedPlayers = Object.keys(playersObj).sort((a, b) => a.localeCompare(b));
    currentTargetIndex = data.currentTargetIndex || 0;
    const targetName = sortedPlayers[currentTargetIndex];

    if (playerId === targetName) {
      container.innerHTML = `
        <div class="fade-in guessing-intro">
          <h2>${targetName}, you’re being judged! 😅</h2>
          <p class="scene-tagline">“Relax. They *think* they know you…”</p>
        </div>
      `;
      return;
    }

    const questions = [
      "If ${targetName} were a fruit, what would they be?",
      "If ${targetName} could time travel, where would they go?",
      "If ${targetName} were an emoji, which one?",
      "If ${targetName} ruled the world, what would be the first law?",
      "If ${targetName} had a theme song, what would it be?",
      "If ${targetName} were a color, which one?",
      "If ${targetName} could only eat one food forever, what would it be?",
      "If ${targetName} were an animal, what would they be?",
      "If ${targetName} won a million dollars, what would they buy first?",
      "If ${targetName} were a movie character, who would they be?"
    ];

    let html = `<div class="fade-in guessing-phase">
      <h2>Guessing Time! What would ${targetName} say?</h2>
      <div id="guess-questions"></div>
      <button id="submit-guesses" class="vibrant-btn">Submit Guesses ✅</button>
    </div>`;
    container.innerHTML = html;

    const questionContainer = $("guess-questions");
    questions.forEach((q, idx) => {
      const div = document.createElement("div");
      div.className = "guess-question-card";
      div.innerHTML = `
        <p>${idx + 1}. ${q}</p>
        <input type="text" placeholder="Your guess for ${targetName}..." data-q="${idx}">
      `;
      questionContainer.appendChild(div);
    });

    $("submit-guesses").onclick = async () => {
      const guesses = {};
      document.querySelectorAll("#guess-questions input").forEach((input) => {
        guesses[input.dataset.q] = input.value || "—";
      });
      await gameRef.child("guesses").child(targetName).child(playerId).set(guesses);
      container.innerHTML = `
        <div class="fade-in guessing-intro">
          <h3>✅ Guesses submitted!</h3>
          <p class="scene-tagline">“Now let’s see how right (or wrong) you were...”</p>
        </div>
      `;
    };

    if (isHost) {
      let nextBtn = document.getElementById("next-target-btn");
      if (!nextBtn) {
        nextBtn = document.createElement("button");
        nextBtn.id = "next-target-btn";
        nextBtn.className = "vibrant-btn";
        nextBtn.textContent = "Next Target ➡️";
        container.appendChild(nextBtn);
      }

      nextBtn.onclick = async () => {
        const answers = data.answers?.[targetName];
        const guesses = data.guesses?.[targetName];
        if (!answers || !guesses) {
          alert("⏳ Wait for all submissions before scoring!");
          return;
        }

        const scores = {};
        Object.entries(guesses).forEach(([guesser, guessObj]) => {
          let score = 0;
          Object.keys(answers).forEach((i) => {
            const a = answers[i]?.toLowerCase() || "";
            const g = guessObj[i]?.toLowerCase() || "";
            if (a && g && a[0] === g[0]) score += 1;
          });
          scores[guesser] = score;
        });

        await gameRef.child("roundScores").child(targetName).set(scores);
        Object.entries(scores).forEach(([guesser, s]) => {
          const current = playersObj[guesser]?.score || 0;
          gameRef.child("players").child(guesser).update({ score: current + s });
        });

        const nextIndex = currentTargetIndex + 1;
        if (nextIndex < sortedPlayers.length) {
          await gameRef.update({ currentTargetIndex: nextIndex });
        } else {
          await gameRef.update({ phase: "scoreboard" });
        }
      };
    }
  }

  // ===== SHOW SCOREBOARD =====
  function showScoreboard(data) {
    const container = $("game-area");
    const roundScores = data.roundScores || {};
    const players = data.players || {};

    let html = `<div class="scoreboard fade-in"><h2>🏆 Round Results</h2>`;

    Object.entries(roundScores).forEach(([target, results]) => {
      html += `<div class="round-block"><h3>🎯 ${target}'s Round</h3><ul>`;
      Object.entries(results).forEach(([player, score]) => {
        html += `<li>${player}: <strong>${score}</strong> pts</li>`;
      });
      html += `</ul></div>`;
    });

    html += `<h2>🔥 Total Scores</h2><ul>`;
    Object.entries(players).forEach(([player, obj]) => {
      html += `<li>${player}: <strong>${obj.score || 0}</strong></li>`;
    });
    html += `</ul></div>`;

    if (isHost) {
      html += `<button id="reveal-winner" class="vibrant-btn">Reveal Winner 🎉</button>`;
    }

    container.innerHTML = html;

    if (isHost) {
      $("reveal-winner").onclick = () => {
        gameRef.update({ phase: "reveal" });
      };
    }
  }

  // ===== SHOW REVEAL PHASE =====
  function showRevealPhase(data) {
    const container = $("game-area");
    const players = data.players || {};

    const sorted = Object.entries(players)
      .map(([name, obj]) => ({ name, score: obj.score || 0 }))
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

        <h3>Final Scores:</h3>
        <ul class="final-score-list">
          ${sorted
            .map(
              (p, i) => `
              <li class="fade-in-delay" style="animation-delay:${i * 0.2}s">
                ${i + 1}. ${p.name} — <strong>${p.score}</strong> pts
              </li>`
            )
            .join("")}
        </ul>

        <button class="vibrant-btn" onclick="location.reload()">Play Again 🔁</button>
      </div>
    `;
  }

  /* 🎊 Simple confetti burst animation using canvas */
  function launchConfetti() {
    const confettiCanvas = document.createElement("canvas");
    confettiCanvas.id = "confetti-canvas";
    confettiCanvas.style.position = "fixed";
    confettiCanvas.style.top = "0";
    confettiCanvas.style.left = "0";
    confettiCanvas.style.width = "100vw";
    confettiCanvas.style.height = "100vh";
    confettiCanvas.style.pointerEvents = "none";
    document.body.appendChild(confettiCanvas);

    const ctx = confettiCanvas.getContext("2d");
    const pieces = Array.from({ length: 150 }, () => ({
      x: Math.random() * window.innerWidth,
      y: Math.random() * window.innerHeight - window.innerHeight,
      size: Math.random() * 8 + 4,
      color: `hsl(${Math.random() * 360}, 80%, 70%)`,
      speed: Math.random() * 4 + 2,
      rotation: Math.random() * 360,
    }));

    function draw() {
      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
      pieces.forEach((p) => {
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.rect(p.x, p.y, p.size, p.size);
        ctx.fill();
        p.y += p.speed;
        p.rotation += 3;
        if (p.y > window.innerHeight) p.y = -10;
      });
      requestAnimationFrame(draw);
    }

    draw();
    setTimeout(() => confettiCanvas.remove(), 10000);
  }
});


console.log("script.js loaded");

document.addEventListener("DOMContentLoaded", () => {
  console.log("DOM fully loaded");

  const $ = id => document.getElementById(id);
  function showSection(id) {
    document.querySelectorAll("section.page").forEach(s => s.classList.add("hidden"));
    const el = document.getElementById(id);
    if (el) el.classList.remove("hidden");
  }

  let gameRef = null;
  let playerId = null;
  let isHost = false;
  let currentTargetIndex = 0;

  window.currentPhase = window.currentPhase || null;
  window.qaStarted = window.qaStarted || false;

  // ===== CREATE ROOM =====
  async function createRoom() {
    const name = $("hostName").value?.trim();
    const count = parseInt($("playerCount").value?.trim(), 10);
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
      players: { [name]: { score: 0, ready: false } }
    });

    $("room-code-display-game").textContent = "Room Code: " + code;
    $("players-count").textContent = `Players joined: 1 / ${count}`;
    showSection("waitingRoom");

    subscribeToGame(code);
  }

  // ===== JOIN ROOM =====
  async function joinRoom() {
    const name = $("playerName").value?.trim();
    const code = $("roomCode").value?.trim().toUpperCase();
    if (!name || !code) return alert("Enter name and room code");

    playerId = name;
    isHost = false;

    if (!window.db) return alert("Database not ready. Please refresh.");
    gameRef = window.db.ref("rooms/" + code);

    const snap = await gameRef.once("value");
    if (!snap.exists()) return alert("Room not found.");

    await gameRef.child("players/" + name).set({ score: 0, ready: false });
    showSection("waitingRoom");
    subscribeToGame(code);
  }

  // ===== MARK PLAYER READY =====
  function markPlayerReady() {
    if (!gameRef || !playerId) return;
    gameRef.child(`players/${playerId}/ready`).set(true);
    showSection("pre-guess-waiting");
    if (isHost) setTimeout(() => checkAllPlayersReady(gameRef.key), 800);
  }

  function checkAllPlayersReady(code) {
    const ref = window.db.ref("rooms/" + code + "/players");
    ref.once("value").then(snap => {
      const players = snap.val() || {};
      const allReady = Object.values(players).every(p => p.ready);
      if (allReady) {
        window.db.ref("rooms/" + code).update({
          phase: "pre-guess",
          guessingIndex: 0
        });
      }
    });
  }

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

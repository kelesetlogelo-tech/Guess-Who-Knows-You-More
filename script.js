// script.js (fixed + hardened)
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

  // Global guards stored on window so multiple subscribes play nicely
  window.currentPhase = window.currentPhase || null;
  window.qaStarted = window.qaStarted || false;

  // ====== CREATE ROOM ======
  async function createRoom() {
    const name = $("hostName").value?.trim();
    const count = parseInt($("playerCount").value?.trim(), 10);

    if (!name || !count || isNaN(count) || count < 2) {
      alert("Enter your name and number of players (min 2).");
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
      players: { [name]: { score: 0, ready: false } }
    });

    // UI
    $("room-code-display-game").textContent = "Room Code: " + code;
    $("players-count").textContent = `Players joined: 1 / ${count}`;

    showSection("waitingRoom");
    subscribeToGame(code);
  }

  // ====== JOIN ROOM ======
  async function joinRoom() {
    const name = $("playerName").value?.trim();
    const code = $("roomCode").value?.trim().toUpperCase();

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

    // ensure room exists before writing
    const snap = await gameRef.once("value");
    if (!snap.exists()) { alert("Room not found."); return; }

    await gameRef.child("players/" + name).set({ score: 0, ready: false });

    showSection("waitingRoom");
    subscribeToGame(code);
  }

  // ---------------- SUBSCRIBE TO GAME ----------------
  function subscribeToGame(code) {
    if (!window.db) return;

    const ref = window.db.ref("rooms/" + code);

    // detach previous to avoid double handlers (defensive)
    try { ref.off(); } catch (e) {}

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
      if (list) {
        list.innerHTML = "";
        Object.keys(playersObj).forEach(name => {
          const li = document.createElement("li");
          const ready = playersObj[name].ready ? " ✅" : "";
          li.textContent = name + ready;
          list.appendChild(li);
        });
      }

      // --- HOST: SHOW BEGIN GAME BUTTON WHEN FULL ---
      const beginBtn = $("begin-game-btn");
      if (isHost && beginBtn) {
        if (expected !== "?" && joinedCount >= expected) beginBtn.classList.remove("hidden");
        else beginBtn.classList.add("hidden");
      } else if (beginBtn) {
        // always hide for non-hosts
        beginBtn.classList.add("hidden");
      }

      // --- PHASE CHANGE: avoid re-triggering same phase repeatedly ---
      if (data.phase !== window.currentPhase) {
        window.currentPhase = data.phase;
        renderPhase(data.phase, code);
      }

      // If host and everyone ready in pre-guess, advance to guessing (defensive)
      if (isHost && data.phase === "pre-guess") {
        const allReady = Object.values(playersObj).length > 0 && Object.values(playersObj).every(p => p.ready);
        if (allReady) {
          ref.update({ phase: "guessing", guessingIndex: 0 });
        }
      }
    });
  }

  // ====== Q&A QUESTIONS (10) ======
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
    // each player must start QA exactly once when phase changes to 'qa'
    if (!gameRef) { console.warn("startQA: no gameRef"); return; }
    window.qaStarted = true;
    currentQuestion = 0;
    answers = {};
    showSection("qa-phase");
    renderQuestion();
  }

  function renderQuestion() {
    const container = $("qa-container");
    if (!container) return console.warn("renderQuestion: missing #qa-container");

    container.innerHTML = "";

    const q = questions[currentQuestion];
    if (!q) {
      // finished Q&A locally — save answers to DB and mark ready
      saveAnswersAndMarkReady();
      return;
    }

    // Question counter
    const counter = document.createElement("div");
    counter.className = "question-counter";
    counter.textContent = `Question ${currentQuestion + 1} of ${questions.length}`;
    container.appendChild(counter);

    // Tile
    const tile = document.createElement("div");
    tile.className = "qa-tile active";
    tile.innerHTML = `
      <h3 class="question-text">${q.text}</h3>
      <div class="options-grid">
        ${q.options.map((opt, idx) => `<button class="option-btn" data-opt-index="${idx}">${opt}</button>`).join("")}
      </div>
    `;
    container.appendChild(tile);

    // Wire options — save the selected answer immediately to DB (per-question)
    tile.querySelectorAll(".option-btn").forEach(btn => {
      btn.onclick = async () => {
        const chosenText = btn.textContent;
        // Save per-question answer to DB under players/{playerId}/answers/{q.id}
        if (gameRef && playerId) {
          try {
            await gameRef.child(`players/${playerId}/answers/${q.id}`).set({
              optionText: chosenText,
              optionIndex: parseInt(btn.dataset.optIndex, 10) || 0,
              ts: Date.now()
            });
          } catch (e) {
            console.warn("Failed to write answer:", e);
          }
        }
        // local copy too
        answers[q.id] = chosenText;

        // animate out then next
        tile.classList.add("slide-out");
        setTimeout(() => {
          currentQuestion++;
          renderQuestion();
        }, 400);
      };
    });
  }

  async function saveAnswersAndMarkReady() {
    // mark ready in DB (answers already saved per-question; this is a final flag)
    if (!gameRef || !playerId) { console.warn("saveAnswersAndMarkReady: missing refs"); return; }
    try {
      await gameRef.child(`players/${playerId}/ready`).set(true);
      showSection("pre-guess-waiting");
    } catch (e) {
      console.warn("Could not mark ready:", e);
    }
  }

  // ====== BUTTON LISTENERS ======
  $("create-room-btn")?.addEventListener("click", createRoom);
  $("join-room-btn")?.addEventListener("click", joinRoom);
  $("begin-game-btn")?.addEventListener("click", () => {
    if (gameRef) gameRef.child("phase").set("qa");
  });

  // ---------------- RENDER PHASE ----------------
  function renderPhase(phase, code) {
    // If overlay exists, use cinematic; otherwise just switch immediately
    const overlay = document.getElementById("phase-transition-overlay");

    const doSwitch = () => {
      // remove existing phase-* classes
      document.body.className = document.body.className
        .split(" ")
        .filter(c => !c.includes("-phase"))
        .join(" ")
        .trim();

      if (phase) document.body.classList.add(`${phase}-phase`);

      switch (phase) {
        case "waiting":
          window.qaStarted = false; // reset local QA guard when returning to waiting
          showSection("waitingRoom");
          break;

        case "qa":
          // start QA for this client (only once)
          if (!window.qaStarted) startQA();
          else showSection("qa-phase");
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
    };

    if (overlay) {
      overlay.classList.add("active");
      setTimeout(() => {
        doSwitch();
        setTimeout(() => overlay.classList.remove("active"), 500);
      }, 400);
    } else {
      doSwitch();
    }
  }

  // ====== GUESSING (per-target rounds) ======
  async function startGuessing() {
    if (!gameRef) return;
    const snap = await gameRef.once("value");
    const data = snap.val();
    if (!data || !data.players) return;

    const players = Object.keys(data.players).sort();
    const index = (data.guessingIndex || 0);
    const targetPlayer = players[index];

    if (!targetPlayer) {
      console.warn("startGuessing: no target found");
      return;
    }

    if (playerId === targetPlayer) {
      // Show judged view to the target player
      const container = $("guessing-phase");
      container.innerHTML = `
        <div class="judged-view">
          <h2>Oh my goodness, you're being judged!</h2>
          <p>Hang tight while everyone guesses your answers...</p>
        </div>
      `;
      return;
    }

    // Non-target players render the guessing round
    renderGuessingRound(targetPlayer, players);
  }

  function renderGuessingRound(targetPlayer, allPlayers) {
    const container = $("guessing-phase");
    if (!container) return;
    container.innerHTML = `
      <h2 class="guessing-header">Now guessing <span class="target-name">${targetPlayer}</span>!</h2>
      <div id="guess-container" class="qa-container"></div>
    `;

    const guessContainer = $("guess-container");
    let qIndex = 0;
    let roundScore = 0;

    async function renderGuessQuestion() {
      const q = questions[qIndex];
      if (!q) return finishGuessingRound();

      // read correct answer for this q from DB
      const ansSnap = await gameRef.child(`players/${targetPlayer}/answers/${q.id}`).once("value");
      const correctObj = ansSnap.val(); // { optionText, optionIndex, ts } or null
      const correctText = correctObj ? (correctObj.optionText || "") : null;

      guessContainer.innerHTML = `
        <div class="question-counter">Question ${qIndex + 1} of ${questions.length}</div>
        <h3 class="question-text">${q.text}</h3>
        <div class="options-grid">
          ${q.options.map((opt, idx) => `<button class="option-btn" data-opt-index="${idx}">${opt}</button>`).join("")}
        </div>
      `;

      guessContainer.querySelectorAll(".option-btn").forEach(btn => {
        btn.onclick = async () => {
          const guess = btn.textContent;
          const correct = (guess === correctText);

          if (correct) {
            btn.classList.add("correct");
            roundScore += 1;
          } else {
            btn.classList.add("incorrect");
            roundScore -= 1;
          }

          // disable options
          guessContainer.querySelectorAll(".option-btn").forEach(b => b.disabled = true);

          setTimeout(() => {
            qIndex++;
            renderGuessQuestion();
          }, 600);
        };
      });
    }

    renderGuessQuestion();

    async function finishGuessingRound() {
      // Save the player’s result for this target
      await gameRef.child(`roundScores/${targetPlayer}/${playerId}`).set(roundScore).catch(e => console.warn(e));

      // Also update their total score transactionally
      gameRef.child(`players/${playerId}/score`).transaction(curr => (curr || 0) + roundScore);

      // Switch to temporary scoreboard (round scoreboard)
      showSection("scoreboard");
      renderRoundScoreboard(targetPlayer);

      // Host checks whether everyone completed this target and advances index
      if (isHost) {
        const snap = await gameRef.child(`roundScores/${targetPlayer}`).once("value");
        const donePlayers = Object.keys(snap.val() || {});
        const activePlayers = allPlayers.filter(p => p !== targetPlayer);
        if (donePlayers.length >= activePlayers.length) {
          const currentIndex = allPlayers.indexOf(targetPlayer);
          const nextIndex = currentIndex + 1;
          if (nextIndex < allPlayers.length) {
            // advance to next target (small delay so players see the round scoreboard)
            setTimeout(() => gameRef.update({ guessingIndex: nextIndex }), 2000);
          } else {
            setTimeout(() => gameRef.update({ phase: "scoreboard" }), 2000);
          }
        }
      }
    }
  }

  // Round scoreboard for a single target
  function renderRoundScoreboard(targetPlayer) {
    const board = $("scoreboard");
    if (!board) return;
    board.innerHTML = `
      <h2 class="round-title">Who knows ${targetPlayer} best?</h2>
      <ul id="roundScoresList" class="score-list"></ul>
      <p class="waiting-msg">(Waiting for others to finish...)</p>
    `;

    const list = $("roundScoresList");
    const ref = gameRef.child("roundScores/" + targetPlayer);

    // detach previous handler to avoid duplicates
    try { ref.off(); } catch (e) {}

    ref.on("value", snap => {
      const scores = snap.val() || {};
      list.innerHTML = "";
      const sorted = Object.entries(scores).sort((a, b) => b[1] - a[1]);
      sorted.forEach(([name, sc]) => {
        const li = document.createElement("li");
        li.textContent = `${name}: ${sc > 0 ? "+" + sc : sc} pts`;
        list.appendChild(li);
      });
    });
  }

  console.log("✅ script.js fully loaded!");
});

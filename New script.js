// script.js (final integrated version)
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
                    players: {
                        [name]: {
                            score: 0,
                            ready: false
                        }
                    }
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

                await gameRef.child("players/" + name).set({
                    score: 0,
                    ready: false
                });
                showSection("waitingRoom");
                subscribeToGame(code);
            }

            // ===== MARK PLAYER READY =====
            function markPlayerReady() {
                if (!gameRef || !playerId) return;
                gameRef.child(`players/${playerId}/answers`).set(answers);
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

                // ✅ Master listener — updates UI + readiness checks
                ref.on("value", snapshot => {
                    const data = snapshot.val();
                    if (!data) return;

                    updateRoomUI(data, code);
                    checkAllPlayersReady(snapshot);

                    // ✅ Detect and render current phase
                    const phase = data.phase;

                    if (phase === "scoreboard") {
                        showScoreboard(data); // already part of your guessing loop
                    } else if (phase === "reveal") {
                        showRevealPhase(data); // 🎉 final winner animation
                    }
                });

                // =========================
                // 🧩 CHECK ALL PLAYERS READY (Unified)
                // =========================
                function checkAllPlayersReady(snapshot, code) {
                    const data = snapshot.val() || {};
                    const players = data.players || {};
                    const phase = data.phase;
                    if (!isHost) return; // Only host runs this logic

                    const beginGuessingBtn = document.getElementById("begin-guessing-btn");
                    const waitingStatus = document.getElementById("waiting-status");

                    const allReady = Object.values(players).every(p => p.ready);

                    // ✅ If all players finished Q&A, advance to pre-guess automatically
                    if (phase === "qa" && allReady) {
                        window.db.ref("rooms/" + code).update({
                            phase: "pre-guess"
                        });
                        console.log("✅ All players ready — advancing to PRE-GUESS phase");
                        return;
                    }

                    // ✅ If in pre-guess, show host control to begin guessing
                    if (phase === "pre-guess") {
                        if (allReady) {
                            beginGuessingBtn?.classList.remove("hidden");
                            if (waitingStatus)
                                waitingStatus.textContent = "Everyone’s done! Begin guessing 🎉";
                        } else {
                            beginGuessingBtn?.classList.add("hidden");
                            if (waitingStatus)
                                waitingStatus.textContent = "Waiting for all players to finish Q&A...";
                        }
                    }
                }

                // =========================
                // 🎯 HOST: BEGIN GUESSING
                // =========================
                document.getElementById("begin-guessing-btn")?.addEventListener("click", async () => {
                    if (!isHost || !gameRef) return;
                    await gameRef.update({
                        phase: "guessing"
                    });
                    console.log("✅ Host advanced to Guessing Phase");
                });

                // --- Update Waiting Room ---
                function updateRoomUI(data, code) {
                    $("room-code-display-game").textContent = "Room Code: " + code;
                    const playersObj = data.players || {};
                    const joinedCount = Object.keys(playersObj).length;
                    const expected = data.numPlayers || "?";
                    $("players-count").textContent = `Players joined: ${joinedCount} / ${expected}`;

                    const list = $("playerList");
                    list.innerHTML = "";
                    Object.keys(playersObj).forEach(name => {
                        const li = document.createElement("li");
                        const ready = playersObj[name].ready ? " ✅" : "";
                        li.textContent = name + ready;
                        list.appendChild(li);
                    });

                    // --- Show Begin Game for Host ---
                    const beginBtn = $("begin-game-btn");
                    if (isHost && beginBtn) {
                        joinedCount >= expected ?
                            beginBtn.classList.remove("hidden") :
                            beginBtn.classList.add("hidden");
                    }

                    // --- Only react to new phases ---
                    if (data.phase !== window.currentPhase) {
                        window.currentPhase = data.phase;
                        renderPhase(data.phase, code);
                    }
                }

                // ===== Q&A =====
                const questions = [{
                        id: "q1",
                        text: "If I were a sound effect, I'd be:",
                        options: ["Ka-ching!", "Dramatic gasp", "Boing!", "Evil laugh"]
                    },
                    {
                        id: "q2",
                        text: "If I were a weather forecast, I'd be:",
                        options: ["100% chill", "Partly dramatic with a chance of chaos!", "Heatwave vibes", "Sudden tornado of opinions"]
                    },
                    {
                        id: "q3",
                        text: "If I were a breakfast cereal, I'd be:",
                        options: ["Jungle Oats", "WeetBix", "Rice Krispies", "MorVite", "That weird healthy one no-one eats"]
                    },
                    {
                        id: "q4",
                        text: "If I were a bedtime excuse, I'd be...",
                        options: ["I need water", "There's a spider in my room", "I can't sleep without 'Pillow'", "There see shadows outside my window", "Just one more episode"]
                    },
                    {
                        id: "q5",
                        text: "If I were a villain in a movie, I'd be...",
                        options: ["Scarlet Overkill", "Grinch", "Thanos", "A mosquito in your room at night", "Darth Vader"]
                    },
                    {
                        id: "q6",
                        text: "If I were a kitchen appliance, I'd be...",
                        options: ["A blender on high speed with no lid", "A toaster that only pops when no one’s looking", "Microwave that screams when it’s done", "A fridge that judges your snack choices"]
                    },
                    {
                        id: "q7",
                        text: "If I were a dance move, I'd be...",
                        options: ["The awkward shuffle at weddings", "Kwasakwasa, Ba-baah!", "The 'I thought no one was watching' move", "The knee-pop followed by a regretful sit-down"]
                    },
                    {
                        id: "q8",
                        text: "If I were a text message, I'd be...",
                        options: ["A typo-ridden voice-to-text disaster", "A three-hour late 'LOL'", "A group chat gif spammer", "A mysterious 'K.' with no context"]
                    },
                    {
                        id: "q9",
                        text: "If I were a warning label, I'd be...",
                        options: ["Caution: May spontaneously break into song", "Contents may cause uncontrollable giggles", "Qaphela: Gevaar/Ingozi", "Warning: Will talk your ear off about random facts", "May contain traces of impulsive decisions"]
                    },
                    {
                        id: "q10",
                        text: "If I were a type of chair, I’d be…",
                        options: ["A Phala Phala sofa", "A creaky antique that screams when you sit", "One of those folding chairs that attack your fingers", "A throne made of regrets and snack crumbs"]
                    }
                ];

                let currentQuestion = 0;
                let answers = {};

                function startQA() {
                    if (!gameRef) return;
                    window.qaStarted = true;
                    currentQuestion = 0;
                    answers = {};
                    showSection("qa-phase");
                    renderQuestion();
                }

                function renderQuestion() {
                    const container = $("qa-container");
                    if (!container) return;
                    container.innerHTML = "";
                    const q = questions[currentQuestion];
                    if (!q) return saveAnswersAndMarkReady();

                    const counter = document.createElement("div");
                    counter.className = "question-counter";
                    counter.textContent = `Question ${currentQuestion + 1} of ${questions.length}`;
                    container.appendChild(counter);

                    const tile = document.createElement("div");
                    tile.className = "qa-tile active";
                    tile.innerHTML = `
      <h3 class="question-text">${q.text}</h3>
      <div class="options-grid">
        ${q.options.map((opt, idx) => `<button class="option-btn" data-opt-index="${idx}">${opt}</button>`).join("")}
      </div>
    `;
                    container.appendChild(tile);

                    tile.querySelectorAll(".option-btn").forEach(btn => {
                        btn.onclick = async () => {
                            const chosenText = btn.textContent;
                            if (gameRef && playerId) {
                                await gameRef.child(`players/${playerId}/answers/${q.id}`).set({
                                    optionText: chosenText,
                                    optionIndex: parseInt(btn.dataset.optIndex, 10),
                                    ts: Date.now()
                                });
                            }
                            answers[q.id] = chosenText;
                            tile.classList.add("slide-out");
                            setTimeout(() => {
                                currentQuestion++;
                                renderQuestion();
                            }, 400);
                        };
                    });
                }

                async function saveAnswersAndMarkReady() {
                    if (!gameRef || !playerId) return;
                    await gameRef.child(`players/${playerId}/ready`).set(true);
                    showSection("pre-guess-waiting");
                }

                // ===== BUTTONS =====
                $("create-room-btn")?.addEventListener("click", createRoom);
                $("join-room-btn")?.addEventListener("click", joinRoom);
                $("begin-game-btn")?.addEventListener("click", () => {
                    if (gameRef) gameRef.child("phase").set("qa");
                });
                $("begin-guessing-btn")?.addEventListener("click", () => {
                    if (isHost && gameRef) gameRef.child("phase").set("guessing");
                });

                // ===== RENDER PHASE =====
                function renderPhase(phase) {
                    const overlay = document.getElementById("phase-transition-overlay");
                    const doSwitch = () => {
                        document.body.className = document.body.className
                            .split(" ")
                            .filter(c => !c.includes("-phase"))
                            .join(" ")
                            .trim();
                        if (phase) document.body.classList.add(`${phase}-phase`);

                        switch (phase) {
                            case "waiting":
                                showSection("waitingRoom");
                                break;
                            case "qa":
                                startQA();
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
                        }
                    };
                    if (overlay) {
                        overlay.classList.add("active");
                        setTimeout(() => {
                            doSwitch();
                            setTimeout(() => overlay.classList.remove("active"), 500);
                        }, 400);
                    } else doSwitch();
                }

                // =========================
                // 🎯 GUESSING PHASE LOGIC (FOR CURRENT DB STRUCTURE)
                // =========================
                function startGuessing() {
                    const container = document.getElementById("guess-container");
                    if (!container || !gameRef) return;

                    console.log("Guessing phase started — setting up listener...");

                    gameRef.on("value", (snapshot) => {
                        const data = snapshot.val() || {};
                        const playersObj = data.players || {};
                        const players = Object.keys(playersObj);
                        if (players.length === 0) return;

                        const sortedPlayers = players.sort((a, b) => a.localeCompare(b));
                        if (data.currentTargetIndex === undefined) {
                            if (isHost) gameRef.update({
                                currentTargetIndex: 0
                            });
                            return;
                        }

                        const currentTargetIndex = data.currentTargetIndex;
                        const targetName = sortedPlayers[currentTargetIndex];
                        const isTarget = playerId === targetName;

                  });
                }
              }
});

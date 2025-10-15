// script.js - single-file replacement
// Multiplayer: lobby -> Q&A -> Guess-prep -> Guessing -> Waiting -> Done

/* ========= Questions (10) ========= */
const QUESTIONS = [
  { text: "If I were a sound effect, I'd be ....", options: ["The frantic hoot of a Siyaya (taxi)", "Evil laugh!", "A mix of Kwaito & Amapiano basslines from a shebeen", "Ta-da!", "Dramatic gasp", "The hiss of a shaken carbonated drink"] },
  { text: "If I were a weather-forecast, I'd be ....", options: ["Partly dramatic with a chance of chaos", "Sudden tornado of opinions", "100% chill", "Heatwave in Limpopo", "The calm before the storm: I'm a quiet observer until I have had too much coffee!", "Severe weather alert for a sudden unexplainable urge to reorganize my entire livingspace"] },
  { text: "If I were a bedtime excuse, I'd be ....", options: ["I need to find the remote", "I need to search for \"Pillow\"", "Trying to find my way out of this rabbit hole of YouTube videos", "I need water", "There's something in my closet", "Just one more episode", "There's a spider in my room"] },
  { text: "If I were a breakfast cereal, I'd be ....", options: ["Jungle Oats", "Weetbix", "The weird healthy one that keeps piling up in the pantry", "Rice Krispies", "Bokomo Cornflakes", "MorVite"] },
  { text: "If I were a villain in a movie, I'd be ....", options: ["Thanos", "Grinch", "Scarlet Overkill", "A mosquito in your room at night", "Darth Vader", "Doctor Doom", "Emperor Palpatine"] },
  { text: "If I were a kitchen appliance, I'd be ....", options: ["A blender on high speed with no lid", "A toaster that only pops when no one’s looking", "A microwave that screams when it’s done", "A fridge that judges your snack choices"] },
  { text: "If I were a dance move, I'd be ....", options: ["The sprinkler: I'm a little awkward, a little stiff and probably hitting the person next to me!", "The moonwalk: I'm trying to move forward, but somehow end up where I started...", "The 'I thought no one was watching' move", "The knee-pop followed by a regretful sit-down", "The Macarena: I know I can do it, but I'm not quite sure why", "That 'running to the bathroom' shuffle: the desperate high-speed march with clenched-up posture and wild eyes"] },
  { text: "If I were a text message, I'd be ....", options: ["A typo-ridden voice-to-text disaster", "A three-hour late \"LOL\"", "A group chat gif spammer", "A mysterious 'K.' with no context"] },
  { text: "If I were a warning label, I'd be ....", options: ["Caution: May spontaneously break into song", "Warning: Contains high levels of optimism and creative ideas, but only after caffeine", "Contents may cause uncontrollable giggles", "Warning: Do not operate on an empty stomach", "Warning: Will talk your ear off about random facts", "May contain traces of impulsive decisions", "Caution: Do not interrupt during a new K-Pop music video release", "Warning: Do not approach before first cup of coffee"] },
  { text: "If I were a type of chair, I'd be ....", options: ["That sofa at Phala Phala", "A creaky antique that screams when you sit", "One of those folding chairs that attack your fingers", "The overstuffed armchair covered in snack crumbs", "The velvet fainting couch - I'm a little dramatic... a lot extra actually!"] }
];

/* ========= helpers ========= */
function escapeHtml(str) {
  return (str + '').replace(/[&<>"']/g, function (m) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m];
  });
}

console.log("script.js loaded");

/* ========= main class ========= */
class MultiplayerIfIWereGame {
  constructor() {
    this.db = window.db || null;

    // player/room
    this.roomCode = null;
    this.roomRef = null;
    this.playersRef = null;
    this.myPlayerKey = null;
    this.playerName = "";
    this.isHost = false;
    this.expectedPlayers = 0;

    // QA state
    this.qaIndex = 0;
    this.qaTotal = QUESTIONS.length;
    this.qaStageInner = null;

    // Guessing state
    this.guessingOrder = [];
    this.currentGuesserIndex = 0;
    this.guessTargets = [];
    this.currentTargetIdx = 0;
    this.currentTargetQIndex = 0;

    this.playersCache = {};

    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", () => this.hookUI());
    } else {
      this.hookUI();
    }

    console.log("MultiplayerIfIWereGame constructed — db present?", !!this.db);
  }

  // small selector helper
  $$(ids) {
    for (const id of ids) {
      const el = document.getElementById(id);
      if (el) return el;
    }
    return null;
  }

  hookUI() {
    console.log("hookUI wiring UI");
    const createBtn = this.$$(["createRoomBtn", "createRoom"]);
    const joinBtn = this.$$(["joinRoomBtn", "joinRoom"]);
    const beginBtn = this.$$(["beginBtn", "beginGame"]);
    // safety: remove existing handlers first (avoid duplicates)
    if (createBtn) {
      createBtn.onclick = null;
      createBtn.addEventListener("click", () => this.handleCreateClick());
    }
    if (joinBtn) {
      joinBtn.onclick = null;
      joinBtn.addEventListener("click", () => this.handleJoinClick());
    }
    if (beginBtn) {
      beginBtn.onclick = null;
      beginBtn.addEventListener("click", () => this.handleBeginClick());
    }
  }

  /* ===== Lobby handlers ===== */
  handleCreateClick() {
    console.log("Create clicked");
    if (!this.db) {
      alert("Firebase not initialized. See console.");
      return;
    }
    const hostNameEl = this.$$(["hostName"]);
    const playerCountEl = this.$$(["playerCount", "numPlayers"]);
    if (!hostNameEl || !playerCountEl) { alert("Host inputs missing."); return; }
    const hostName = (hostNameEl.value || "").trim();
    const count = parseInt(playerCountEl.value, 10);
    if (!hostName || isNaN(count) || count < 2 || count > 8) { alert("Enter host name and player count (2-8)."); return; }
    this.createRoom(hostName, count);
  }

  handleJoinClick() {
    console.log("Join clicked");
    if (!this.db) { alert("Firebase not initialized. See console."); return; }
    const playerNameEl = this.$$(["playerName"]);
    const roomCodeEl = this.$$(["roomCodeInput", "roomCode", "joinCode"]);
    if (!playerNameEl || !roomCodeEl) { alert("Join inputs missing."); return; }
    const name = (playerNameEl.value || "").trim();
    const code = (roomCodeEl.value || "").trim().toUpperCase();
    if (!name || !code) { alert("Enter your name and room code."); return; }
    this.joinRoom(name, code);
  }

  handleBeginClick() {
    console.log("Begin clicked");
    if (!this.isHost || !this.roomRef) return;
    this.roomRef.update({ gameStarted: true, phase: "qa" })
      .then(() => console.log("gameStarted set"))
      .catch(err => console.error("Failed to set gameStarted:", err));
  }

  /* ===== create/join ===== */
  generateRoomCode() { return Math.random().toString(36).substring(2, 7).toUpperCase(); }

  createRoom(hostName, expectedPlayers) {
    this.isHost = true;
    this.playerName = hostName;
    this.expectedPlayers = expectedPlayers;
    this.roomCode = this.generateRoomCode();
    this.roomRef = this.db.ref(`rooms/${this.roomCode}`);
    this.playersRef = this.roomRef.child("players");

    this.roomRef.set({ host: hostName, expectedPlayers, gameStarted: false, phase: "lobby" })
      .then(() => {
        const p = this.playersRef.push();
        return p.set({ name: hostName, joinedAt: Date.now(), isHost: true }).then(() => {
          this.myPlayerKey = p.key;
          this.playersCache[this.myPlayerKey] = { name: hostName, isHost: true };
          console.log("Host added with key:", this.myPlayerKey);
          this.showWaitingUI();
          this.listenForPlayers();
        });
      }).catch(err => { console.error("createRoom error:", err); alert("Could not create room — see console."); });
  }

  joinRoom(playerName, roomCode) {
    this.playerName = playerName;
    this.roomCode = roomCode;
    this.roomRef = this.db.ref(`rooms/${this.roomCode}`);
    this.playersRef = this.roomRef.child("players");

    this.roomRef.once("value").then(snap => {
      if (!snap.exists()) { alert("Room not found."); throw new Error("Room not found"); }
      const p = this.playersRef.push();
      return p.set({ name: playerName, joinedAt: Date.now(), isHost: false }).then(() => {
        this.myPlayerKey = p.key;
        this.playersCache[this.myPlayerKey] = { name: playerName, isHost: false };
        console.log("Joined with key:", this.myPlayerKey);
        this.showWaitingUI();
        this.listenForPlayers();
      });
    }).catch(err => console.error("joinRoom error:", err));
  }

  showWaitingUI() {
    const landing = this.$$(["landing"]);
    const waiting = this.$$(["waitingRoom"]);
    const roomCodeDisplay = this.$$(["roomCodeDisplay", "roomCode"]);
    if (landing) landing.classList.add("hidden");
    if (waiting) waiting.classList.remove("hidden");
    if (roomCodeDisplay) roomCodeDisplay.textContent = this.roomCode;
  }

  /* ===== listen players & start QA ===== */
 listenForPlayers() {
  if (!this.playersRef || !this.roomRef) { console.error("listenForPlayers: refs missing"); return; }

  // Ensure we don't attach duplicate handlers
  this.playersRef.off();

  // One 'value' listener to render the entire list and update player cache
  this.playersRef.on("value", snapshot => {
    const obj = snapshot.val() || {};
    // update cache
    this.playersCache = Object.assign({}, this.playersCache, obj);

    // render list once
    const listEl = document.getElementById("playerList");
    if (listEl) {
      listEl.innerHTML = "";
      Object.keys(obj).forEach(key => {
        const pdata = obj[key] || {};
        const li = document.createElement("li");
        li.dataset.key = key;
        li.textContent = pdata.name || "Player";
        listEl.appendChild(li);
      });
    }

    // update count and host begin button visibility
    const players = Object.keys(obj);
    const countEl = document.getElementById("playersCount");
    if (countEl) countEl.textContent = `${players.length} / ${this.expectedPlayers || "?"} joined`;

    if (this.isHost) {
      const beginBtn = document.getElementById("beginBtn");
      if (beginBtn) {
        // only show begin when host sees enough players
        if (players.length >= this.expectedPlayers) beginBtn.classList.remove("hidden");
        else beginBtn.classList.add("hidden");
      }
    }
  });

  // Attach a single listener to gameStarted (phase entry point)
  this.roomRef.child("gameStarted").off();
  this.roomRef.child("gameStarted").on("value", snap => {
    if (snap.val() === true) {
      console.log("gameStarted -> startGame");
      this.startGame();
    }
  });
}

  startGame() {
    console.log("startGame -> QA");
    const waiting = this.$$(["waitingRoom"]); const gamePhase = this.$$(["gamePhase"]);
    if (waiting) waiting.classList.add("hidden"); if (gamePhase) gamePhase.classList.remove("hidden");
    try { if (this.roomRef) this.roomRef.update({ phase: "qa" }); } catch (e) {}
    this.startQA();
  }

  /* ===== Q&A flow ===== */
  startQA() {
    this.qaIndex = 0; this.qaTotal = QUESTIONS.length;
    const qc = document.getElementById("questionCard");
    if (!qc) { console.error("questionCard missing"); return; }
    qc.innerHTML = '<div class="qa-stage" id="qaStageInner"></div>';
    this.qaStageInner = document.getElementById("qaStageInner");
    this.renderNextQuestion();
  }
  renderNextQuestion() {
  // If we've answered all questions, mark QA complete and show waiting UI
  if (this.qaIndex >= this.qaTotal) {
    try {
      const pid = this.myPlayerKey || this.playerName || `p_${Date.now()}`;
      if (this.db && this.roomCode) {
        this.db.ref(`rooms/${this.roomCode}/qaCompletions/${pid}`).set(true).catch(()=>{});
      }
    } catch (e) {
      console.warn("qa write failed", e);
    }

    // Show waiting UI and ensure clients listen for phase changes
    this.showWaitingAfterQA();
    if (this.db && this.roomCode) this.listenForGuessingPhase();
    return;
  }

  // Otherwise render the next question tile
  const q = QUESTIONS[this.qaIndex];
  const tile = document.createElement("div");
  tile.className = "qa-tile";
  tile.dataset.qindex = this.qaIndex;
  tile.innerHTML = `
    <div class="qa-card">
      <h3>${escapeHtml(q.text)}</h3>
      <div class="qa-options">
        ${q.options.map((opt, i) => `<button class="option-btn" data-opt="${i}">${escapeHtml(opt)}</button>`).join("")}
      </div>
    </div>
  `;
  if (!this.qaStageInner) {
    console.error("qaStageInner not found");
    return;
  }
  this.qaStageInner.appendChild(tile);
  requestAnimationFrame(() => requestAnimationFrame(() => tile.classList.add("enter")));

  tile.querySelectorAll(".option-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      // disable buttons
      tile.querySelectorAll(".option-btn").forEach(b => b.disabled = true);
      const idx = parseInt(btn.dataset.opt, 10);
      const pid = this.myPlayerKey || this.playerName || `p_${Date.now()}`;

      // save answer
      if (this.db && this.roomCode) {
        this.db.ref(`rooms/${this.roomCode}/answers/${pid}/${this.qaIndex}`).set({
          optionIndex: idx,
          optionText: q.options[idx],
          ts: Date.now()
        }).catch(e => console.warn("save answer failed:", e));
      }

      // animate out then render next
      tile.classList.remove("enter");
      tile.classList.add("exit");
      const onEnd = (ev) => {
        if (ev.target !== tile) return;
        tile.removeEventListener("transitionend", onEnd);
        if (tile.parentNode) tile.parentNode.removeChild(tile);
        this.qaIndex += 1;
        this.renderNextQuestion();
      };
      tile.addEventListener("transitionend", onEnd);
    });
  });
}

  /* ===== Guessing prep & ready ===== */
// robust showGuessPrepUI (improved — host listens for guessReady and starts guessing when readyCount >= expected)
/* ===== Show waiting room after Q&A and host-only Begin button ===== */
showWaitingAfterQA() {
  console.log("showWaitingAfterQA: showing waiting room and live statuses");

  // hide QA UI only
  const gamePhase = document.getElementById("gamePhase");
  if (gamePhase) gamePhase.classList.add("hidden");

  // show the waiting room (visible to everyone)
  const guessWaiting = document.getElementById("guessWaitingRoom");
  if (guessWaiting) guessWaiting.classList.remove("hidden");
  const roomCodeDisp = document.getElementById("roomCodeDisplay_guess");
  if (roomCodeDisp) roomCodeDisp.textContent = this.roomCode || "";

  // host controls
  const hostControls = document.getElementById("hostControls");
  if (hostControls) hostControls.classList.toggle("hidden", !this.isHost);

  // wire host Begin button (host only)
  if (this.isHost) {
    const hostBtn = document.getElementById("hostBeginGuessBtn");
    if (hostBtn) {
      hostBtn.onclick = null;
      hostBtn.addEventListener("click", () => this.hostBeginHandler());
      // ensure hidden until all players completed (we'll reveal it below)
      hostBtn.disabled = true;
      hostBtn.classList.add("muted");
    }
  }

  // ensure the statuses list exists
  const statusList = document.getElementById("guessPlayerStatusList");
  if (statusList) statusList.innerHTML = "";

  // Ensure we are listening for QA completions updates
  if (this.db && this.roomCode) {
    const qaRef = this.db.ref(`rooms/${this.roomCode}/qaCompletions`);
    // remove duplicate handlers
    qaRef.off('value');

    // on every change, update statuses and for host enable Begin when ready
    qaRef.on('value', (snap) => {
      const doneObj = snap.val() || {};
      console.log("qaCompletions updated:", Object.keys(doneObj).length, doneObj);

      // Update status list (pull player names)
      this.db.ref(`rooms/${this.roomCode}/players`).once('value').then(psnap => {
        const players = psnap.val() || {};
        const keys = Object.keys(players);
        // render each player and mark completed/pending
        if (statusList) statusList.innerHTML = "";
        keys.forEach(k => {
          const name = (players[k] && players[k].name) ? players[k].name : k;
          const li = document.createElement('li');
          const status = doneObj && doneObj[k] ? 'completed' : 'pending';
          li.textContent = `${name} — ${status}`;
          if (status === 'completed') li.classList.add('status-completed'); else li.classList.remove('status-completed');
          if (statusList) statusList.appendChild(li);
        });

        // Enable host Begin button only when counts match expectedPlayers
        if (this.isHost) {
          const expectedRef = this.db.ref(`rooms/${this.roomCode}/expectedPlayers`);
          expectedRef.once('value').then(expSnap => {
            const expected = expSnap.exists() ? expSnap.val() : (this.expectedPlayers || 0);
            const doneCount = Object.keys(doneObj).length;
            console.log('Host check: doneCount', doneCount, 'expected', expected);
            const hostBtn = document.getElementById("hostBeginGuessBtn");
            if (hostBtn) {
              if (doneCount >= expected && expected > 0) {
                hostBtn.disabled = false;
                hostBtn.classList.remove('muted');
              } else {
                hostBtn.disabled = true;
                hostBtn.classList.add('muted');
              }
            }
          });
        }
      }).catch(e => console.warn("Failed to load players for status list", e));
    });
  }
}

/* ===== Host clicks Begin Guessing =====
   Host should create guessingOrder and set phase:'guessing'
*/
hostBeginHandler() {
  if (!this.isHost || !this.db || !this.roomCode) {
    console.warn("hostBeginHandler: not allowed or missing refs");
    return;
  }
  const roomRef = this.db.ref(`rooms/${this.roomCode}`);

  // Read players and set order + reset currentGuesserIndex -> 0 and flip phase
  roomRef.child('players').once('value').then(psnap => {
    const playersObj = psnap.val() || {};
    const order = Object.keys(playersObj);
    return roomRef.update({
      guessingOrder: order,
      currentGuesserIndex: 0,
      phase: 'guessing'
    });
  }).then(() => {
    console.log("hostBeginHandler: guessing phase started by host (DB updated)");
    // NO local UI changes here: all clients must react to DB 'phase' change
  }).catch(err => {
    console.error("hostBeginHandler failed:", err);
  });
}

  // robust markReadyToGuess (replace existing)
markReadyToGuess() {
  console.log("markReadyToGuess invoked");
  if (!this.db || !this.roomCode) {
    console.warn("markReadyToGuess: db or roomCode missing");
    return;
  }
  const playerId = this.myPlayerKey || this.playerName || `player_${Date.now()}`;
  this.db.ref(`rooms/${this.roomCode}/guessReady/${playerId}`).set(true)
    .then(() => {
      console.log("Marked readyToGuess for", playerId);
      // hide prep UI if present
      const prep = document.getElementById("guessPrep");
      if (prep) prep.classList.add("hidden");
      // also hide fallback if present
      const fallback = document.getElementById("guessPrepFallback");
      if (fallback) fallback.remove();

      // show guessing waiting room - create fallback if missing
      let guessWaiting = document.getElementById("guessWaitingRoom");
      if (!guessWaiting) {
        console.warn("markReadyToGuess: #guessWaitingRoom missing — creating fallback");
        guessWaiting = document.createElement("div");
        guessWaiting.id = "guessWaitingRoom";
        guessWaiting.innerHTML = `<h2>Waiting for others to be ready...</h2><ul id="guessPlayerStatusList"></ul>`;
        document.body.appendChild(guessWaiting);
      }
      guessWaiting.classList.remove("hidden");

      // ensure statuses are rendered
      if (typeof this.renderGuessingStatuses === "function") this.renderGuessingStatuses();

      // last step: host will init guessing phase when everyone ready
      if (this.isHost) {
        setTimeout(() => this.initGuessingPhaseIfReady(), 400);
      }
    })
    .catch(err => {
      console.error("Failed to mark readyToGuess:", err);
      alert("Could not mark Ready — check console.");
    });
}

  // Host init: check guessReady and set guessingOrder & phase
  initGuessingPhaseIfReady() {
    if (!this.db || !this.roomCode) return;
    const roomRef = this.db.ref(`rooms/${this.roomCode}`);
    roomRef.child('expectedPlayers').once('value').then(expSnap => {
      const expected = expSnap.exists() ? expSnap.val() : (this.expectedPlayers || 0);
      roomRef.child('guessReady').once('value').then(readySnap => {
        const readyObj = readySnap.val() || {}; const readyCount = Object.keys(readyObj).length;
        console.log('initGuessingPhaseIfReady readyCount', readyCount, 'expected', expected);
        if (readyCount >= expected) {
          roomRef.child('players').once('value').then(psnap => {
            const playersObj = psnap.val() || {}; const order = Object.keys(playersObj || {});
            roomRef.update({ guessingOrder: order, currentGuesserIndex: 0, phase: 'guessing' }).then(()=>console.log('Guessing initialized')).catch(e=>console.error('init guess fail',e));
          });
        } else console.log('Not all ready yet');
      });
    }).catch(e=>console.error('initGuessingPhaseIfReady error',e));
  }

  /* ===== Listen & apply guessing phase ===== */
 listenForGuessingPhase() {
  if (!this.db || !this.roomCode) return;
  const roomRef = this.db.ref(`rooms/${this.roomCode}`);

  // ensure single handler
  roomRef.child('phase').off();

  // on phase change, react accordingly
  roomRef.child('phase').on('value', snap => {
    const phase = snap.val();
    console.log('phase ->', phase);
    if (phase === 'guessing') {
      // load guessingOrder and currentGuesserIndex, then apply state
      roomRef.child('guessingOrder').once('value').then(oSnap => {
        this.guessingOrder = oSnap.val() || [];
        return roomRef.child('currentGuesserIndex').once('value');
      }).then(idxSnap => {
        this.currentGuesserIndex = idxSnap.val() || 0;
        // Transition UI for everyone using one method
        this.applyGuessingState();
      }).catch(e => console.error('listenForGuessingPhase error', e));
    } else if (phase === 'qa') {
      // optional: handle going back to QA
      // hide guessing UI, show QA etc.
    } else if (phase === 'done') {
      // optional: show final scores
    }
  });
}

 /* ===== Listen & apply guessing phase ===== */
applyGuessingState() {
  console.log("applyGuessingState running");

  const activeKey = (this.guessingOrder && this.guessingOrder[this.currentGuesserIndex]) || null;
  const isMyTurn = (this.myPlayerKey === activeKey);

  // Hide waiting-room entirely and show the guessPhase section
  const guessWaitingRoom = document.getElementById('guessWaitingRoom');
  const guessPhaseEl = document.getElementById('guessPhase');
  if (guessWaitingRoom) guessWaitingRoom.classList.add('hidden');
  if (guessPhaseEl) guessPhaseEl.classList.remove('hidden');

  // update header/label
  const rcd = document.getElementById('roomCodeDisplay_guess');
  if (rcd) rcd.textContent = this.roomCode;

  const activeLabel = document.getElementById('activeGuesserLabel');
  if (activeLabel) {
    activeLabel.textContent = isMyTurn ? 'You are guessing now' : `${this.getPlayerNameByKey(activeKey) || 'A player'} is guessing — please wait`;
  }

  // Attach watchers defensively (only once)
  if (this.db && this.roomCode) {
    const idxRef = this.db.ref(`rooms/${this.roomCode}/currentGuesserIndex`);
    idxRef.off();
    idxRef.on('value', snap => {
      const idx = snap.val();
      if (typeof idx === 'number' && this.currentGuesserIndex !== idx) {
        this.currentGuesserIndex = idx;
        this.applyGuessingState();
      }
    });

    const compRef = this.db.ref(`rooms/${this.roomCode}/guessCompletions`);
    compRef.off();
    compRef.on('value', () => {
      if (typeof this.renderGuessingStatuses === "function") this.renderGuessingStatuses();
      this.checkAllGuessingComplete();
    });
  }

  // Start guessing flow only if it's this client's turn
  if (isMyTurn) {
    if (typeof this.startGuessingForMe === "function") this.startGuessingForMe();
  }
}

/* ===== render guessing statuses ===== */
renderGuessingStatuses() {
  const listEl = document.getElementById('guessPlayerStatusList');
  if (!listEl || !this.db || !this.roomCode) return;

  listEl.innerHTML = '';
  this.db.ref(`rooms/${this.roomCode}/players`).once('value').then(psnap => {
    const players = psnap.val() || {};
    this.db.ref(`rooms/${this.roomCode}/guessCompletions`).once('value').then(csnap => {
      const comps = csnap.val() || {};
      Object.keys(players).forEach(pid => {
        const li = document.createElement('li');
        const name = players[pid].name || pid;
        const status = comps && comps[pid] ? 'completed' : 'pending';
        li.textContent = `${name} — ${status}`;
        listEl.appendChild(li);
      });
    });
  });
}

/* ===== Get player name safely ===== */
getPlayerNameByKey(key) {
  if (!key) return null;
  if (this.playersCache && this.playersCache[key]) return this.playersCache[key].name;
  if (this.db && this.roomCode) {
    this.db.ref(`rooms/${this.roomCode}/players/${key}`).once('value').then(s => {
      const v = s.val();
      if (!this.playersCache) this.playersCache = {};
      this.playersCache[key] = v;
    });
  }
  return null;
}

/* ===== Active guesser flow ===== */
startGuessingForMe() {
  if (!this.db || !this.roomCode) return;

  this.db.ref(`rooms/${this.roomCode}/players`).once('value').then(psnap => {
    const playersObj = psnap.val() || {};
    const allKeys = Object.keys(playersObj);
    this.guessTargets = allKeys.filter(k => k !== this.myPlayerKey);
    this.currentTargetIdx = 0;
    this.currentTargetQIndex = 0;

    // If there are no targets (only one player), finish immediately
    if (!this.guessTargets || this.guessTargets.length === 0) {
      // mark completion and advance
      this.finishMyGuessingTurn();
      return;
    }

    // ensure my score exists
    this.db.ref(`rooms/${this.roomCode}/scores/${this.myPlayerKey}`)
      .transaction(curr => curr || 0);

    // start rendering
    this.renderNextGuessTile();
  });
}

/* ===== Render next guess tile ===== */
renderNextGuessTile() {
  if (!this.guessTargets || this.currentTargetIdx >= this.guessTargets.length) {
    this.finishMyGuessingTurn();
    return;
  }

  const targetKey = this.guessTargets[this.currentTargetIdx];
  const qIndex = this.currentTargetQIndex;
  const question = QUESTIONS[qIndex];

  this.db.ref(`rooms/${this.roomCode}/answers/${targetKey}/${qIndex}`).once('value')
    .then(ansSnap => {
      const realAnswer = ansSnap.val();
      const stage = document.getElementById('guessCard');
      if (!stage) return;

      stage.innerHTML = '<div class="qa-stage" id="guessQAStage"></div>';
      const stageInner = document.getElementById('guessQAStage');

      const tile = document.createElement('div');
      tile.className = 'qa-tile';
      tile.dataset.qindex = qIndex;
      tile.dataset.targetKey = targetKey;

      const targetName = this.getPlayerNameByKey(targetKey) || 'Player';

      tile.innerHTML = `
        <div class="qa-card">
          <h3>Guess for ${escapeHtml(targetName)} — Q${qIndex + 1}</h3>
          <p>${escapeHtml(question.text)}</p>
          <div class="qa-options">
            ${question.options.map((opt,i)=>`<button class="option-btn" data-opt="${i}">${escapeHtml(opt)}</button>`).join('')}
          </div>
          <div class="guess-feedback" style="margin-top:12px;"></div>
        </div>
      `;

      stageInner.appendChild(tile);
      // trigger enter animation
      requestAnimationFrame(() => requestAnimationFrame(() => tile.classList.add('enter')));

      tile.querySelectorAll('.option-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          // disable all buttons immediately
          tile.querySelectorAll('.option-btn').forEach(b=>b.disabled=true);

          const guessedIndex = parseInt(btn.dataset.opt, 10);
          const correct = !!realAnswer && (realAnswer.optionIndex === guessedIndex);
          const feedback = tile.querySelector('.guess-feedback');
          feedback.innerHTML = correct
            ? `<span class="guess-result guess-correct">✓</span> Correct`
            : `<span class="guess-result guess-wrong">✕</span> Wrong`;

          // save guess
          this.db.ref(`rooms/${this.roomCode}/guesses/${this.myPlayerKey}/${targetKey}/${qIndex}`)
            .set({ guessedIndex, correct, ts: Date.now() })
            .catch(e => console.warn('save guess fail', e));

          // update score
          this.db.ref(`rooms/${this.roomCode}/scores/${this.myPlayerKey}`)
            .transaction(curr => (curr||0) + (correct ? 1 : -1));

          // Immediately start exit animation and move to next tile on transitionend
          tile.classList.remove('enter');
          tile.classList.add('exit');

          tile.addEventListener('transitionend', () => {
            if (tile.parentNode) tile.parentNode.removeChild(tile);
            this.advanceGuessIndices();
            // render next immediately
            this.renderNextGuessTile();
          }, { once: true });

          // Fallback: if no CSS transitionend is fired within 400ms, advance anyway
          setTimeout(() => {
            if (tile.parentNode) {
              // ensure we don't double-advance (only if still present)
              tile.parentNode.removeChild(tile);
              this.advanceGuessIndices();
              this.renderNextGuessTile();
            }
          }, 400);
        });
      });
    })
    .catch(err => {
      console.error('fetch real answer error', err);
      // skip fragile case
      this.advanceGuessIndices();
      this.renderNextGuessTile();
    });
}

/* ===== Advance guess indices ===== */
advanceGuessIndices() {
  this.currentTargetQIndex += 1;
  if (this.currentTargetQIndex >= QUESTIONS.length) {
    this.currentTargetQIndex = 0;
    this.currentTargetIdx += 1;
  }
}

/* ===== Finish my guessing turn ===== */
finishMyGuessingTurn() {
  if (!this.db || !this.roomCode) return;

  const myKey = this.myPlayerKey;
  const roomRef = this.db.ref(`rooms/${this.roomCode}`);

  // mark my completion
  this.db.ref(`rooms/${this.roomCode}/guessCompletions/${myKey}`).set(true).catch(e => console.warn('set completion fail', e));

  // Read guessingOrder length and advance index safely (host writes DB so everyone sees same result)
  roomRef.child('guessingOrder').once('value').then(orderSnap => {
    const order = orderSnap.val() || [];
    const totalGuessers = order.length;

    // Use transaction to update currentGuesserIndex and possibly end phase
    return roomRef.transaction(current => {
      if (!current) return current;
      const currIdx = (current.currentGuesserIndex || 0);
      const nextIdx = currIdx + 1;

      if (nextIdx >= totalGuessers) {
        // All guessers have finished -> mark done
        current.currentGuesserIndex = nextIdx;
        current.phase = 'done';
      } else {
        current.currentGuesserIndex = nextIdx;
      }
      return current;
    });
  }).then(() => {
    console.log('finishMyGuessingTurn: requested advancement of currentGuesserIndex');
  }).catch(err => {
    console.error('finishMyGuessingTurn error', err);
  });

/* ===== instantiate ===== */
let gameInstance = null;
document.addEventListener("DOMContentLoaded", () => {
  if (!window.db) console.warn("window.db falsy; check firebase-config.js");
  gameInstance = new MultiplayerIfIWereGame();
});


    

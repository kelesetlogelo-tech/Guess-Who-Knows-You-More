// script.js - integrated, cleaned guessing + waiting flow
// Multiplayer: lobby -> Q&A -> Pre-Guess Waiting -> Guessing -> Post-Guess Waiting -> Done

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
  { text: "If I were a warning label, I'd be ....", options: ["Caution: May spontaneously break into song", "Warning: Contains high levels of optimism and creative ideas, but only after caffeine", "Contents may cause uncontrollable giggles", "Warning: Do not operate on an empty stomach", "Warning: Will talk your ear off about random facts", "May contain traces of impulsive decisions", "Caution: Do not interrupt before first cup of coffee", "Warning: Do not approach before first cup of coffee"] },
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

    // small local guards
    this.isGuessingActive = false;   // prevents re-entrancy for active guesser
    this._finishRequested = false;   // prevents duplicate finish writes
    this._autoStartTimeout = null;
    this._autoStarted = false;

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

  // tiny selector helper (returns first matching id)
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

    // Wire Done Guessing button (exists in HTML)
    const doneBtn = document.getElementById('doneGuessingBtn');
    if (doneBtn) {
      doneBtn.onclick = null;
      // button visibility/wiring is handled by showDoneGuessButton
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

    this.roomRef.set({ host: hostName, expectedPlayers: expectedPlayers, gameStarted: false, phase: "lobby" })
      .then(() => {
        const p = this.playersRef.push();
        return p.set({ name: hostName, joinedAt: Date.now(), isHost: true }).then(() => {
          this.myPlayerKey = p.key;
          this.playersCache[this.myPlayerKey] = { name: hostName, isHost: true };
          console.log("Host added with key:", this.myPlayerKey);
          this.showWaitingUI();
          this.listenForPlayers();
          this.listenForGuessingPhase();
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
        this.listenForGuessingPhase();
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

    // make sure no duplicates
    try { this.playersRef.off(); } catch (e) {}

    this.playersRef.on("value", snapshot => {
      const obj = snapshot.val() || {};
      this.playersCache = Object.assign({}, this.playersCache, obj);

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

      const players = Object.keys(obj);
      const countEl = document.getElementById("playersCount");
      if (countEl) countEl.textContent = `${players.length} / ${this.expectedPlayers || "?"} joined`;

      if (this.isHost) {
        const beginBtn = document.getElementById("beginBtn");
        if (beginBtn) {
          if (players.length >= this.expectedPlayers) beginBtn.classList.remove("hidden");
          else beginBtn.classList.add("hidden");
        }
      }
    });

    // listen for host starting game
    try { this.roomRef.child("gameStarted").off(); } catch (e) {}
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
    if (waiting) waiting.classList.add("hidden");
    if (gamePhase) gamePhase.classList.remove("hidden");
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
    // all answered -> mark QA completion and show pre-guess waiting
    if (this.qaIndex >= this.qaTotal) {
      try {
        const pid = this.myPlayerKey || this.playerName || `p_${Date.now()}`;
        if (this.db && this.roomCode) {
          this.db.ref(`rooms/${this.roomCode}/qaCompletions/${pid}`).set(true).catch(()=>{});
        }
      } catch (e) { console.warn("qa write failed", e); }

      // show waiting after QA and ensure clients listen for guessing-phase
      this.showWaitingAfterQA();
      if (this.db && this.roomCode) this.listenForGuessingPhase();
      return;
    }

    const q = QUESTIONS[this.qaIndex];
    const tile = document.createElement("div");
    tile.className = "qa-tile";
    tile.dataset.qindex = this.qaIndex;
    tile.innerHTML = `
      <div class="qa-card">
        <h3>${escapeHtml(q.text)}</h3>
        <div class="qa-options">${q.options.map((opt,i)=>`<button class="option-btn" data-opt="${i}">${escapeHtml(opt)}</button>`).join("")}</div>
      </div>
    `;
    if (!this.qaStageInner) { console.error("qaStageInner not found"); return; }
    this.qaStageInner.appendChild(tile);
    requestAnimationFrame(()=>requestAnimationFrame(()=>tile.classList.add("enter")));

    tile.querySelectorAll(".option-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        tile.querySelectorAll(".option-btn").forEach(b=>b.disabled=true);
        const idx = parseInt(btn.dataset.opt, 10);
        const pid = this.myPlayerKey || this.playerName || `p_${Date.now()}`;
        if (this.db && this.roomCode) {
          this.db.ref(`rooms/${this.roomCode}/answers/${pid}/${this.qaIndex}`).set({
            optionIndex: idx, optionText: q.options[idx], ts: Date.now()
          }).catch(e=>console.warn("save answer failed:", e));
        }
        tile.classList.remove("enter"); tile.classList.add("exit");
        const onEnd = ev => { if (ev.target !== tile) return; tile.removeEventListener("transitionend", onEnd); if (tile.parentNode) tile.parentNode.removeChild(tile); this.qaIndex += 1; this.renderNextQuestion(); };
        tile.addEventListener("transitionend", onEnd);
      });
    });
  }

  /* ===== Pre-Guess waiting room (after Q&A) ===== */
  showWaitingAfterQA() {
    console.log("showWaitingAfterQA: showing waiting room and live statuses (defensive)");

    // Hide QA UI region only
    const gamePhase = document.getElementById("gamePhase");
    if (gamePhase) gamePhase.classList.add("hidden");

    // Ensure guessWaitingRoom exists & visible
    let guessWaiting = document.getElementById("guessWaitingRoom");
    if (!guessWaiting) {
      console.warn("showWaitingAfterQA: creating #guessWaitingRoom fallback");
      guessWaiting = document.createElement("section");
      guessWaiting.id = "guessWaitingRoom";
      guessWaiting.innerHTML = `<h2>Waiting for everyone to finish Q&A</h2>
        <p>Room code: <span id="roomCodeDisplay_guess"></span></p>
        <ul id="guessPlayerStatusList"></ul>
        <div id="hostControls" class="hidden"><button id="hostBeginGuessBtn" class="teal-btn muted" disabled>Begin Guessing (host)</button></div>`;
      document.body.appendChild(guessWaiting);
      // wire the host button if present
      const hostBtn = document.getElementById("hostBeginGuessBtn");
      if (hostBtn) hostBtn.addEventListener("click", () => this.hostBeginHandler());
    }
    guessWaiting.classList.remove("hidden");

    const roomCodeDisp = document.getElementById("roomCodeDisplay_guess");
    if (roomCodeDisp) roomCodeDisp.textContent = this.roomCode || "";

    // ensure hostControls exist and visibility matches
    const hostControls = document.getElementById("hostControls");
    if (hostControls) hostControls.classList.toggle("hidden", !this.isHost);

    // Status list update on QA completions
    if (this.db && this.roomCode) {
      const qaRef = this.db.ref(`rooms/${this.roomCode}/qaCompletions`);
      try { qaRef.off('value'); } catch(e) {}
      qaRef.on('value', snap => {
        const doneObj = snap.val() || {};
        const doneCount = Object.keys(doneObj).length;
        console.log("qaCompletions updated:", doneCount, doneObj);

        // Read players and render list
        this.db.ref(`rooms/${this.roomCode}/players`).once('value').then(psnap => {
          const players = psnap.val() || {};
          const keys = Object.keys(players || {});
          const playersCount = keys.length;

          const statusList = document.getElementById("guessPlayerStatusList");
          if (statusList) {
            statusList.innerHTML = "";
            keys.forEach(k => {
              const name = players[k] && players[k].name ? players[k].name : k;
              const li = document.createElement("li");
              const status = (doneObj && doneObj[k]) ? 'completed' : 'pending';
              li.textContent = `${name} — ${status}`;
              if (status === 'completed') li.classList.add('status-completed'); else li.classList.remove('status-completed');
              statusList.appendChild(li);
            });
          }

          // If host, enable hostBegin button only when ready
          if (this.isHost) {
            const hostBtn = document.getElementById("hostBeginGuessBtn");
            if (hostBtn) {
              if (playersCount > 0 && doneCount >= playersCount) { hostBtn.disabled = false; hostBtn.classList.remove('muted'); }
              else { hostBtn.disabled = true; hostBtn.classList.add('muted'); }
            }

            // Optional: auto-start (guarded) to avoid manual click – runs once per room
            if (!this._autoStarted && playersCount > 0 && doneCount >= playersCount) {
              this._autoStarted = true;
              if (this._autoStartTimeout) clearTimeout(this._autoStartTimeout);
              this._autoStartTimeout = setTimeout(() => {
                // double-check DB just before flipping
                this.db.ref(`rooms/${this.roomCode}/qaCompletions`).once('value').then(checkSnap => {
                  const checkDone = checkSnap.val() || {};
                  if (Object.keys(checkDone).length >= playersCount) {
                    // compute alphabetic order and flip phase
                    return this.db.ref(`rooms/${this.roomCode}/players`).once('value').then(ps2 => {
                      const pObj = ps2.val() || {};
                      const items = Object.keys(pObj).map(key => {
                        const nm = (pObj[key] && pObj[key].name) ? pObj[key].name : '';
                        const firstName = (nm || '').split(/\s+/)[0] || nm || key;
                        return { key, firstName };
                      });
                      items.sort((a,b) => a.firstName.localeCompare(b.firstName, undefined, { sensitivity: 'base' }));
                      const order = items.map(x => x.key);
                      return this.db.ref(`rooms/${this.roomCode}`).update({ guessingOrder: order, currentGuesserIndex: 0, phase: 'guessing' })
                        .then(() => console.log('Auto-started guessing phase (host)'));
                    });
                  } else {
                    console.log('Auto-start aborted: completions changed during debounce');
                    this._autoStarted = false;
                  }
                }).catch(e => { console.warn('Auto-start check failed', e); this._autoStarted = false; });
              }, 400);
            }
          }
        }).catch(e => console.warn("showWaitingAfterQA: failed to load players for status list", e));
      });
    }
    // also ensure we react to phase changes
    if (this.db && this.roomCode) this.listenForGuessingPhase();
  }

  /* ===== Host begins guessing (manual alternative to auto-start) ===== */
  hostBeginHandler() {
    if (!this.isHost || !this.db || !this.roomCode) {
      console.warn("hostBeginHandler: not allowed or missing refs");
      return;
    }
    const roomRef = this.db.ref(`rooms/${this.roomCode}`);
    roomRef.child('players').once('value').then(psnap => {
      const playersObj = psnap.val() || {};
      const items = Object.keys(playersObj).map(key => {
        const nm = (playersObj[key] && playersObj[key].name) ? playersObj[key].name : '';
        const firstName = (nm || '').split(/\s+/)[0] || nm || key;
        return { key, firstName };
      });
      items.sort((a,b) => a.firstName.localeCompare(b.firstName, undefined, { sensitivity: 'base' }));
      const order = items.map(x => x.key);
      return roomRef.update({ guessingOrder: order, currentGuesserIndex: 0, phase: 'guessing' });
    }).then(() => console.log("hostBeginHandler: guessing phase started by host"))
      .catch(err => console.error("hostBeginHandler failed:", err));
  }

  /* ===== Listen & apply guessing phase ===== */
  listenForGuessingPhase() {
    if (!this.db || !this.roomCode) return;
    const roomRef = this.db.ref(`rooms/${this.roomCode}`);
    try { roomRef.child('phase').off(); } catch(e) {}
    roomRef.child('phase').on('value', snap => {
      const phase = snap.val();
      console.log('phase ->', phase);
      if (!phase || phase === 'qa') {
        const gamePhase = document.getElementById('gamePhase');
        if (gamePhase) gamePhase.classList.remove('hidden');
        const guessWaiting = document.getElementById('guessWaitingRoom');
        if (guessWaiting) guessWaiting.classList.add('hidden');
        return;
      }
      if (phase === 'guessing') {
        // everyone should show pre-guess waiting room (will toggle active guesser to guessPhase)
        const gamePhase = document.getElementById('gamePhase'); if (gamePhase) gamePhase.classList.add('hidden');
        const guessWaiting = document.getElementById('guessWaitingRoom'); if (guessWaiting) guessWaiting.classList.remove('hidden');
        if (typeof this.renderGuessingStatuses === "function") this.renderGuessingStatuses();
        roomRef.child('guessingOrder').once('value').then(oSnap => {
          this.guessingOrder = oSnap.val() || [];
          return roomRef.child('currentGuesserIndex').once('value');
        }).then(idxSnap => {
          this.currentGuesserIndex = idxSnap.val() || 0;
          // apply state to determine active player
          this.applyGuessingState();
        }).catch(err => console.error('listenForGuessingPhase error', err));
        return;
      }
      if (phase === 'done') {
        console.log('phase done - final state reached');
        // optional: show final scoreboard
      }
    });
  }

  /* ===== Apply guessing state for this client (who is active?) ===== */
  applyGuessingState() {
    console.log("applyGuessingState running");

    if (!this.db || !this.roomCode) { console.warn("applyGuessingState: missing db or roomCode"); return; }
    const activeKey = (this.guessingOrder && this.guessingOrder[this.currentGuesserIndex]) || null;

    // read completions to see if active already finished
    this.db.ref(`rooms/${this.roomCode}/guessCompletions`).once('value').then(snap => {
      const comps = snap.val() || {};
      const activeCompleted = !!(activeKey && comps[activeKey]);
      const iAmCompleted = !!(this.myPlayerKey && comps[this.myPlayerKey]);

      if (activeCompleted) {
        console.warn('applyGuessingState: activeKey already completed; waiting for DB advance');
        if (iAmCompleted) {
          this.showPostGuessWaitingUI();
        } else {
          const guessWaiting = document.getElementById('guessWaitingRoom'); if (guessWaiting) guessWaiting.classList.remove('hidden');
          const guessPhaseEl = document.getElementById('guessPhase'); if (guessPhaseEl) guessPhaseEl.classList.add('hidden');
        }
        return;
      }

      const isMyTurn = (this.myPlayerKey === activeKey);

      // detach previous watchers defensively
      try {
        this.db.ref(`rooms/${this.roomCode}/currentGuesserIndex`).off();
        this.db.ref(`rooms/${this.roomCode}/guessCompletions`).off();
      } catch(e) {}

      // attach watchers for live updates (only one each)
      const idxRef = this.db.ref(`rooms/${this.roomCode}/currentGuesserIndex`);
      idxRef.on('value', snapIdx => {
        const idx = snapIdx.val();
        if (typeof idx === 'number' && this.currentGuesserIndex !== idx) {
          this.currentGuesserIndex = idx;
          this.isGuessingActive = false;
          this._finishRequested = false;
          this.applyGuessingState();
        }
      });

      const gcRef = this.db.ref(`rooms/${this.roomCode}/guessCompletions`);
      gcRef.on('value', () => {
        if (typeof this.renderGuessingStatuses === "function") this.renderGuessingStatuses();
        if (typeof this.checkAllGuessingComplete === "function") this.checkAllGuessingComplete();
      });

      // UI: update labels and show/hide regions
      const rcd = document.getElementById('roomCodeDisplay_guess');
      if (rcd) rcd.textContent = this.roomCode || '';
      const activeLabel = document.getElementById('activeGuesserLabel');
      if (activeLabel) activeLabel.textContent = isMyTurn ? 'You are guessing now — guess every other player' : `${this.getPlayerNameByKey(activeKey) || 'A player'} is guessing — please wait`;

      const guessWaitingRoom = document.getElementById('guessWaitingRoom');
      const guessPhaseEl = document.getElementById('guessPhase');
      if (guessWaitingRoom) guessWaitingRoom.classList.toggle('hidden', isMyTurn);
      if (guessPhaseEl) guessPhaseEl.classList.toggle('hidden', !isMyTurn);

      // Start guessing flow if this client is the active guesser
      if (isMyTurn) {
        if (!this.isGuessingActive) {
          this.isGuessingActive = true;
          this._finishRequested = false;
          this.startGuessingForMe();
        } else {
          console.log("applyGuessingState: already active — ignoring re-entry");
        }
      } else {
        // Clear any local guess UI for non-active clients
        const guessCard = document.getElementById('guessCard');
        if (guessCard) guessCard.innerHTML = '';
        this.isGuessingActive = false;
      }
    }).catch(e => {
      console.warn('applyGuessingState: failed to read completions', e);
    });
  }

  /* ===== render guessing statuses for pre-guess waiting room ===== */
  renderGuessingStatuses() {
    if (!this.db || !this.roomCode) return;
    const listEl = document.getElementById('guessPlayerStatusList');
    if (!listEl) return;
    listEl.innerHTML = '';

    Promise.all([
      this.db.ref(`rooms/${this.roomCode}/players`).once('value'),
      this.db.ref(`rooms/${this.roomCode}/guessCompletions`).once('value'),
      this.db.ref(`rooms/${this.roomCode}/guessingOrder`).once('value'),
      this.db.ref(`rooms/${this.roomCode}/currentGuesserIndex`).once('value')
    ]).then(([psnap, csnap, osnap, isnap]) => {
      const players = psnap.val() || {};
      const comps = csnap.val() || {};
      const order = osnap.val() || [];
      const cur = isnap.val() || 0;
      const currentKey = order[cur] || null;

      Object.keys(players).forEach(pid => {
        const li = document.createElement('li');
        const name = players[pid].name || pid;
        let status = 'pending';
        if (comps && comps[pid]) status = 'completed';
        else if (pid === currentKey) status = 'guessing';
        li.textContent = `${name} — ${status}`;
        listEl.appendChild(li);
      });
    }).catch(e => console.warn('renderGuessingStatuses failed', e));
  }

  getPlayerNameByKey(key) {
    if (!key) return null;
    if (this.playersCache && this.playersCache[key]) return this.playersCache[key].name;
    if (this.db && this.roomCode) {
      this.db.ref(`rooms/${this.roomCode}/players/${key}`).once('value').then(s => {
        const v = s.val();
        if (!this.playersCache) this.playersCache = {};
        this.playersCache[key] = v;
      }).catch(()=>{});
    }
    return null;
  }

  /* ===== Active guesser flow ===== */
  startGuessingForMe() {
    if (!this.db || !this.roomCode) return;
    if (this.isGuessingActive && (this.guessTargets && this.guessTargets.length > 0)) {
      console.log("startGuessingForMe: already active — skipping");
      return;
    }
    this.db.ref(`rooms/${this.roomCode}/players`).once('value').then(psnap => {
      const playersObj = psnap.val() || {};
      const allKeys = Object.keys(playersObj);
      this.guessTargets = allKeys.filter(k => k !== this.myPlayerKey);
      this.currentTargetIdx = 0;
      this.currentTargetQIndex = 0;

      if (!this.guessTargets || this.guessTargets.length === 0) {
        this.showDoneGuessButton();
        return;
      }

      this.db.ref(`rooms/${this.roomCode}/scores/${this.myPlayerKey}`).transaction(curr => curr || 0);
      this.isGuessingActive = true;
      this.renderNextGuessTile();
    }).catch(e => console.error("startGuessingForMe failed:", e));
  }

  renderNextGuessTile() {
    if (!this.isGuessingActive) { console.log("renderNextGuessTile: not active — exiting"); return; }

    if (!this.guessTargets || this.currentTargetIdx >= this.guessTargets.length) {
      // done with everyone else: show "Done Guessing" button
      this.showDoneGuessButton();
      return;
    }

    const targetKey = this.guessTargets[this.currentTargetIdx];
    const qIndex = this.currentTargetQIndex;
    const question = QUESTIONS[qIndex];

    this.db.ref(`rooms/${this.roomCode}/answers/${targetKey}/${qIndex}`).once('value').then(ansSnap => {
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
          <div class="qa-options">${question.options.map((opt,i)=>`<button class="option-btn" data-opt="${i}">${escapeHtml(opt)}</button>`).join('')}</div>
          <div class="guess-feedback" style="margin-top:12px;"></div>
        </div>
      `;
      stageInner.appendChild(tile);
      requestAnimationFrame(()=>requestAnimationFrame(()=>tile.classList.add('enter')));

      tile.querySelectorAll('.option-btn').forEach(btn => {
        btn.onclick = null;
        btn.addEventListener('click', () => {
          tile.querySelectorAll('.option-btn').forEach(b=>b.disabled=true);
          const guessedIndex = parseInt(btn.dataset.opt, 10);
          const correct = !!realAnswer && (realAnswer.optionIndex === guessedIndex);
          const feedback = tile.querySelector('.guess-feedback');
          feedback.innerHTML = correct ? `<span class="guess-result guess-correct">✓</span> Correct` : `<span class="guess-result guess-wrong">✕</span> Wrong`;

          // save guess & update score
          this.db.ref(`rooms/${this.roomCode}/guesses/${this.myPlayerKey}/${targetKey}/${qIndex}`).set({ guessedIndex, correct, ts: Date.now() }).catch(e=>console.warn('save guess fail', e));
          this.db.ref(`rooms/${this.roomCode}/scores/${this.myPlayerKey}`).transaction(curr => (curr||0) + (correct ? 1 : -1));

          // exit and move to next
          tile.classList.remove('enter');
          tile.classList.add('exit');
          const onTransitionEnd = () => {
            tile.removeEventListener('transitionend', onTransitionEnd);
            if (tile.parentNode) tile.parentNode.removeChild(tile);
            this.advanceGuessIndices();
            this.renderNextGuessTile();
          };
          tile.addEventListener('transitionend', onTransitionEnd, { once: true });

          // fallback
          setTimeout(() => {
            if (stageInner.contains(tile)) {
              try { tile.removeEventListener('transitionend', onTransitionEnd); } catch(e) {}
              if (tile.parentNode) tile.parentNode.removeChild(tile);
              this.advanceGuessIndices();
              this.renderNextGuessTile();
            }
          }, 400);
        });
      });
    }).catch(err => {
      console.error('fetch real answer error', err);
      this.advanceGuessIndices();
      this.renderNextGuessTile();
    });
  }

  showDoneGuessButton() {
    const btn = document.getElementById('doneGuessingBtn');
    if (!btn) {
      console.warn("showDoneGuessButton: #doneGuessingBtn not found");
      return;
    }
    const activeKey = (this.guessingOrder && this.guessingOrder[this.currentGuesserIndex]) || null;
    const isMyTurn = (this.myPlayerKey === activeKey);
    if (!isMyTurn) { btn.classList.add('hidden'); return; }

    btn.classList.remove('hidden');
    btn.disabled = false;
    btn.onclick = null;
    btn.addEventListener('click', () => {
      btn.disabled = true;
      btn.classList.add('hidden');
      this.isGuessingActive = false;
      this.showPostGuessWaitingUI();
      // mark completion + advance (idempotent via guard)
      this.finishMyGuessingTurn();
    }, { once: true });
  }

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
    if (this._finishRequested) { console.log("finishMyGuessingTurn: already requested"); return; }
    this._finishRequested = true;

    const myKey = this.myPlayerKey;
    const roomRef = this.db.ref(`rooms/${this.roomCode}`);

    // mark completion visible to all
    roomRef.child(`guessCompletions/${myKey}`).set(true).catch(e => console.warn('set completion fail', e));

    // Host should advance to next not-completed player
    // Use transaction to avoid races (but transaction may be heavy; we keep it simple here)
    if (this.isHost) {
      this.advanceGuesserIfNeeded();
    } else {
      // non-hosts just rely on host (or a host auto-advance) — but we still attempt to nudge DB safely
      // fetch snapshot and if host missing advancement, non-hosts won't write currentGuesserIndex
    }

    // show post-guess waiting UI for this player
    this.showPostGuessWaitingUI();
  }

  /* ===== Host: advance to next non-completed guesser OR finish ===== */
  advanceGuesserIfNeeded() {
    if (!this.db || !this.roomCode) return;
    const roomRef = this.db.ref(`rooms/${this.roomCode}`);
    // run a transaction to advance currentGuesserIndex to next not-completed player
    roomRef.transaction(current => {
      if (!current) return current;
      const order = current.guessingOrder || [];
      const comps = current.guessCompletions || {};
      const total = order.length;
      let idx = current.currentGuesserIndex || 0;

      // find next index after current that is not completed
      let nextIdx = idx + 1;
      while (nextIdx < total && comps && comps[ order[nextIdx] ]) nextIdx++;
      if (nextIdx >= total) {
        // everyone done -> mark done
        current.currentGuesserIndex = nextIdx;
        current.phase = 'done';
      } else {
        current.currentGuesserIndex = nextIdx;
      }
      return current;
    }).then(() => {
      console.log('advanceGuesserIfNeeded: transaction applied');
    }).catch(e => console.error('advanceGuesserIfNeeded error', e));
  }

  checkAllGuessingComplete() {
    if (!this.db || !this.roomCode) return;
    this.db.ref(`rooms/${this.roomCode}/guessCompletions`).once('value').then(snap => {
      const comps = snap.val() || {};
      const count = Object.keys(comps).length;
      if (count >= this.expectedPlayers && this.expectedPlayers > 0) {
        this.db.ref(`rooms/${this.roomCode}`).update({ phase: 'done' }).catch(e => console.warn('set done fail', e));
      }
    }).catch(e => console.warn('checkAllGuessingComplete fail', e));
  }

  /* ===== Post-guess waiting UI ===== */
  showPostGuessWaitingUI() {
    // hide guessPhase region
    const guessPhase = document.getElementById('guessPhase');
    if (guessPhase) guessPhase.classList.add('hidden');
    // hide pre-guess waiting
    const guessWaiting = document.getElementById('guessWaitingRoom');
    if (guessWaiting) guessWaiting.classList.add('hidden');

    // create or show post-guess container
    let post = document.getElementById('postGuessWaitingRoom');
    if (!post) {
      post = document.createElement('section');
      post.id = 'postGuessWaitingRoom';
      post.innerHTML = '<h2>Waiting for other players to finish guessing...</h2><ul id="postGuessStatusList"></ul>';
      document.body.appendChild(post);
    }
    post.classList.remove('hidden');
    this.renderPostGuessStatuses();
  }

  renderPostGuessStatuses() {
    const list = document.getElementById('postGuessStatusList');
    if (!list || !this.db || !this.roomCode) return;
    list.innerHTML = '';
    Promise.all([
      this.db.ref(`rooms/${this.roomCode}/players`).once('value'),
      this.db.ref(`rooms/${this.roomCode}/guessCompletions`).once('value'),
      this.db.ref(`rooms/${this.roomCode}/guessingOrder`).once('value'),
      this.db.ref(`rooms/${this.roomCode}/currentGuesserIndex`).once('value')
    ]).then(([psnap, csnap, osnap, isnap]) => {
      const players = psnap.val() || {};
      const comps = csnap.val() || {};
      const order = osnap.val() || [];
      const curIdx = isnap.val() || 0;
      const activeKey = order[curIdx] || null;

      Object.keys(players).forEach(k => {
        const li = document.createElement('li');
        const name = players[k].name || k;
        let status = 'pending';
        if (comps && comps[k]) status = 'completed';
        else if (k === activeKey) status = 'guessing';
        li.textContent = `${name} — ${status}`;
        list.appendChild(li);
      });
    }).catch(e => console.warn('renderPostGuessStatuses failed', e));
  }
}

/* ===== instantiate ===== */
let gameInstance = null;
document.addEventListener("DOMContentLoaded", () => {
  if (!window.db) console.warn("window.db falsy; check firebase-config.js");
  gameInstance = new MultiplayerIfIWereGame();
});

// script.js - full replacement (copy & paste entire file)
// Purpose: multiplayer waiting room, Q&A tiles, guessing phase with scoring, firebase writes

/* ========= Question bank (10 questions) ========= */
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

/* ========= small helper ========= */
function escapeHtml(str) {
  return (str + '').replace(/[&<>"']/g, function (m) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m];
  });
}

console.log("script.js loaded");

/* ========= Main game class ========= */
class MultiplayerIfIWereGame {
  constructor() {
    // firebase DB MUST be exposed on window.db by firebase-config.js
    this.db = window.db || null;

    // room & player state
    this.roomCode = null;
    this.roomRef = null;
    this.playersRef = null;
    this.myPlayerKey = null; // set when push() succeeds
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

    // small cache
    this.playersCache = {};

    // attach UI on DOM ready
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", () => this.hookUI());
    } else {
      this.hookUI();
    }

    console.log("MultiplayerIfIWereGame constructed — db present?", !!this.db);
  }

  /* safe selector with fallbacks */
  $$(ids) {
    for (const id of ids) {
      const el = document.getElementById(id);
      if (el) return el;
    }
    return null;
  }

  hookUI() {
    console.log("hookUI: wiring UI elements");
    const createBtn = this.$$(["createRoomBtn", "createRoom"]);
    const joinBtn = this.$$(["joinRoomBtn", "joinRoom"]);
    const beginBtn = this.$$(["beginBtn", "beginGame"]);
    if (createBtn) createBtn.addEventListener("click", () => this.handleCreateClick());
    if (joinBtn) joinBtn.addEventListener("click", () => this.handleJoinClick());
    if (beginBtn) beginBtn.addEventListener("click", () => this.handleBeginClick());
  }

  handleCreateClick() {
    console.log("Create clicked");
    if (!this.db) {
      alert("Firebase not initialized. See console.");
      return;
    }
    const hostNameEl = this.$$(["hostName"]);
    const playerCountEl = this.$$(["playerCount", "numPlayers"]);

    if (!hostNameEl || !playerCountEl) {
      alert("Host name or player count input missing in HTML.");
      return;
    }

    const hostName = (hostNameEl.value || "").trim();
    const count = parseInt(playerCountEl.value, 10);
    if (!hostName || isNaN(count) || count < 2 || count > 8) {
      alert("Enter host name and a valid player count (2–8).");
      return;
    }

    this.createRoom(hostName, count);
  }

  handleJoinClick() {
    console.log("Join clicked");
    if (!this.db) {
      alert("Firebase not initialized. See console.");
      return;
    }
    const playerNameEl = this.$$(["playerName"]);
    const roomCodeEl = this.$$(["roomCodeInput", "roomCode", "joinCode"]);
    if (!playerNameEl || !roomCodeEl) {
      alert("Join inputs missing.");
      return;
    }
    const name = (playerNameEl.value || "").trim();
    const code = (roomCodeEl.value || "").trim().toUpperCase();
    if (!name || !code) {
      alert("Enter your name and room code.");
      return;
    }
    this.joinRoom(name, code);
  }

  handleBeginClick() {
    console.log("Begin clicked");
    if (!this.isHost || !this.roomRef) return;
    this.roomRef.update({ gameStarted: true, phase: "qa" })
      .then(() => console.log("gameStarted set"))
      .catch(err => console.error("Failed to set gameStarted:", err));
  }

  /* ===== room creation & joining ===== */
  generateRoomCode() {
    return Math.random().toString(36).substring(2, 7).toUpperCase();
  }

  createRoom(hostName, expectedPlayers) {
    this.isHost = true;
    this.playerName = hostName;
    this.expectedPlayers = expectedPlayers;
    this.roomCode = this.generateRoomCode();
    this.roomRef = this.db.ref(`rooms/${this.roomCode}`);
    this.playersRef = this.roomRef.child("players");

    this.roomRef.set({
      host: hostName,
      expectedPlayers: expectedPlayers,
      gameStarted: false,
      phase: "lobby"
    }).then(() => {
      const p = this.playersRef.push();
      return p.set({ name: hostName, joinedAt: Date.now(), isHost: true }).then(() => {
        this.myPlayerKey = p.key;
        this.playersCache[this.myPlayerKey] = { name: hostName, isHost: true };
        console.log("Host added with key:", this.myPlayerKey);
        this.showWaitingUI();
        this.listenForPlayers();
      });
    }).catch(err => {
      console.error("createRoom error:", err);
      alert("Failed to create room. See console.");
    });
  }

  joinRoom(playerName, roomCode) {
    this.playerName = playerName;
    this.roomCode = roomCode;
    this.roomRef = this.db.ref(`rooms/${this.roomCode}`);
    this.playersRef = this.roomRef.child("players");

    this.roomRef.once("value").then(snap => {
      if (!snap.exists()) {
        alert("Room not found.");
        throw new Error("Room not found");
      }
      const p = this.playersRef.push();
      return p.set({ name: playerName, joinedAt: Date.now(), isHost: false }).then(() => {
        this.myPlayerKey = p.key;
        this.playersCache[this.myPlayerKey] = { name: playerName, isHost: false };
        console.log("Joined with key:", this.myPlayerKey);
        this.showWaitingUI();
        this.listenForPlayers();
      });
    }).catch(err => {
      console.error("joinRoom error:", err);
    });
  }

  showWaitingUI() {
    const landing = this.$$(["landing"]);
    const waiting = this.$$(["waitingRoom"]);
    const roomCodeDisplay = this.$$(["roomCodeDisplay", "roomCode"]);
    if (landing) landing.classList.add("hidden");
    if (waiting) waiting.classList.remove("hidden");
    if (roomCodeDisplay) roomCodeDisplay.textContent = this.roomCode;
  }

  /* ===== listen & update players ===== */
  listenForPlayers() {
    if (!this.playersRef || !this.roomRef) {
      console.error("listenForPlayers called without refs");
      return;
    }

    // child_added for fast updates
    this.playersRef.on("child_added", snapshot => {
      const pdata = snapshot.val();
      const pkey = snapshot.key;
      this.playersCache[pkey] = pdata;
      const listEl = document.getElementById("playerList");
      if (listEl) {
        const li = document.createElement("li");
        li.dataset.key = pkey;
        li.textContent = pdata && pdata.name ? pdata.name : ("Player");
        listEl.appendChild(li);
      }
    });

    // full value to compute counts and show Begin button
    this.playersRef.on("value", snapshot => {
      const obj = snapshot.val() || {};
      const players = Object.values(obj).map(p => p.name || "Unnamed");
      const listEl = document.getElementById("playerList");
      if (listEl) {
        listEl.innerHTML = "";
        players.forEach(n => {
          const li = document.createElement("li");
          li.textContent = n;
          listEl.appendChild(li);
        });
      }
      const countEl = document.getElementById("playersCount");
      if (countEl) countEl.textContent = `${players.length} / ${this.expectedPlayers || "?"} joined`;
      if (this.isHost && players.length >= this.expectedPlayers) {
        const beginBtn = document.getElementById("beginBtn");
        if (beginBtn) beginBtn.classList.remove("hidden");
      }
    });

    // listen for start of QA
    this.roomRef.child("gameStarted").on("value", snap => {
      if (snap.val() === true) {
        console.log("gameStarted detected -> starting QA");
        this.startGame();
      }
    });
  }

  /* ===== startGame -> switch to Q&A (calls startQA) ===== */
  startGame() {
    console.log("startGame: transition to QA");
    const waiting = this.$$(["waitingRoom"]);
    const gamePhase = this.$$(["gamePhase"]);
    if (waiting) waiting.classList.add("hidden");
    if (gamePhase) gamePhase.classList.remove("hidden");
    // set phase to 'qa' (if not set)
    try {
      if (this.roomRef) this.roomRef.update({ phase: "qa" });
    } catch (e) {}
    this.startQA();
  }

  /* ===== Q&A methods ===== */
  startQA() {
    this.qaIndex = 0;
    this.qaTotal = QUESTIONS.length;
    const qc = document.getElementById("questionCard");
    if (!qc) {
      console.error("questionCard element missing");
      return;
    }
    qc.innerHTML = '<div class="qa-stage" id="qaStageInner"></div>';
    this.qaStageInner = document.getElementById("qaStageInner");
    this.renderNextQuestion();
  }

  renderNextQuestion() {
    if (this.qaIndex >= this.qaTotal) {
      // write completion to DB
      try {
        const pid = this.myPlayerKey || this.playerName || `p_${Date.now()}`;
        if (this.db && this.roomCode) {
          this.db.ref(`rooms/${this.roomCode}/qaCompletions/${pid}`).set(true);
        }
      } catch (e) {}
      // Show a completion tile then call initGuessingPhaseIfReady() for host to initialize guessing
      this.qaStageInner.innerHTML = `<div class="qa-tile enter"><div class="qa-card"><h3>All done!</h3><p>You completed all questions.</p></div></div>`;
      // small delay then attempt to init guessing
      setTimeout(() => {
        if (this.isHost && this.db && this.roomCode) {
          // host attempts to init guessing phase
          this.initGuessingPhaseIfReady();
        }
        // all clients should start listening for guessing phase now
        if (this.db && this.roomCode) {
          this.listenForGuessingPhase();
        }
      }, 600);
      return;
    }

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
    this.qaStageInner.appendChild(tile);
    requestAnimationFrame(() => requestAnimationFrame(() => tile.classList.add("enter")));
    tile.querySelectorAll(".option-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        // disable buttons
        tile.querySelectorAll(".option-btn").forEach(b => b.disabled = true);
        const idx = parseInt(btn.dataset.opt, 10);
        const playerId = this.myPlayerKey || this.playerName || `p_${Date.now()}`;
        // save answer
        if (this.db && this.roomCode) {
          this.db.ref(`rooms/${this.roomCode}/answers/${playerId}/${this.qaIndex}`).set({
            optionIndex: idx,
            optionText: q.options[idx],
            ts: Date.now()
          }).catch(e => console.warn("save answer failed:", e));
        }
        // animate out then next
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

  /* ===== Guessing phase init & listeners ===== */

  // Host creates guessing order and flips phase to 'guessing' when ready
  initGuessingPhaseIfReady() {
    if (!this.db || !this.roomCode) return;
    const roomRef = this.db.ref(`rooms/${this.roomCode}`);
    roomRef.child('qaCompletions').once('value').then(snap => {
      const obj = snap.val() || {};
      const completedCount = Object.keys(obj).length;
      console.log('QA completions:', completedCount);
      if (completedCount >= this.expectedPlayers) {
        // build order from players keys
        roomRef.child('players').once('value').then(psnap => {
          const playersObj = psnap.val() || {};
          const order = Object.keys(playersObj || {});
          roomRef.update({
            guessingOrder: order,
            currentGuesserIndex: 0,
            phase: 'guessing'
          }).then(() => console.log('Guessing phase initialized'))
            .catch(err => console.error('init guessing error', err));
        });
      } else {
        console.log('Not all QA completions present yet');
      }
    }).catch(err => console.error('initGuessingPhaseIfReady error', err));
  }

  listenForGuessingPhase() {
    if (!this.db || !this.roomCode) return;
    const roomRef = this.db.ref(`rooms/${this.roomCode}`);
    roomRef.child('phase').on('value', snap => {
      const phase = snap.val();
      console.log('phase changed ->', phase);
      if (phase === 'guessing') {
        roomRef.child('guessingOrder').once('value').then(oSnap => {
          this.guessingOrder = oSnap.val() || [];
          return roomRef.child('currentGuesserIndex').once('value');
        }).then(idxSnap => {
          this.currentGuesserIndex = idxSnap.val() || 0;
          this.applyGuessingState();
        }).catch(err => console.error('listenForGuessingPhase error', err));
      }
    });
  }

  applyGuessingState() {
    const activeKey = (this.guessingOrder && this.guessingOrder[this.currentGuesserIndex]) || null;
    const isMyTurn = (this.myPlayerKey === activeKey);
    console.log('applyGuessingState activeKey', activeKey, 'isMyTurn', isMyTurn);
    document.getElementById('guessWaitingRoom')?.classList.toggle('hidden', false);
    document.getElementById('guessPhase')?.classList.toggle('hidden', !isMyTurn);
    const rcd = document.getElementById('roomCodeDisplay_guess');
    if (rcd) rcd.textContent = this.roomCode;
    this.renderGuessingStatuses();
    const activeLabel = document.getElementById('activeGuesserLabel');
    if (activeLabel) {
      if (isMyTurn) activeLabel.textContent = 'You are guessing now — guess every other player';
      else {
        const nm = this.getPlayerNameByKey(activeKey) || 'A player';
        activeLabel.textContent = `${nm} is guessing — please wait`;
      }
    }
    // start or stop listening for currentGuesserIndex
    this.db.ref(`rooms/${this.roomCode}/currentGuesserIndex`).on('value', snap => {
      const idx = snap.val();
      if (typeof idx === 'number') {
        this.currentGuesserIndex = idx;
        // if index changed we need to re-apply state
        this.applyGuessingState();
      }
    });
    // listen for completions
    this.db.ref(`rooms/${this.roomCode}/guessCompletions`).on('value', () => {
      this.renderGuessingStatuses();
      // check all done
      this.checkAllGuessingComplete();
    });
    if (isMyTurn) {
      this.startGuessingForMe();
    }
  }

  renderGuessingStatuses() {
    const listEl = document.getElementById('guessPlayerStatusList');
    if (!listEl) return;
    listEl.innerHTML = '';
    this.db.ref(`rooms/${this.roomCode}/players`).once('value').then(psnap => {
      const players = psnap.val() || {};
      this.db.ref(`rooms/${this.roomCode}/guessCompletions`).once('value').then(csnap => {
        const comps = csnap.val() || {};
        Object.keys(players).forEach(pid => {
          const li = document.createElement('li');
          const pname = players[pid].name || pid;
          const status = comps && comps[pid] ? 'completed' : 'pending';
          li.textContent = `${pname} — ${status}`;
          listEl.appendChild(li);
        });
      });
    });
  }

  getPlayerNameByKey(key) {
    if (!key) return null;
    if (this.playersCache && this.playersCache[key]) return this.playersCache[key].name;
    // fetch once
    if (this.db && this.roomCode) {
      this.db.ref(`rooms/${this.roomCode}/players/${key}`).once('value').then(s => {
        const v = s.val();
        if (!this.playersCache) this.playersCache = {};
        this.playersCache[key] = v;
      });
    }
    return null;
  }

  /* ===== active guesser flow ===== */
  startGuessingForMe() {
    // build targets list
    this.db.ref(`rooms/${this.roomCode}/players`).once('value').then(psnap => {
      const playersObj = psnap.val() || {};
      const allKeys = Object.keys(playersObj);
      this.guessTargets = allKeys.filter(k => k !== this.myPlayerKey);
      this.currentTargetIdx = 0;
      this.currentTargetQIndex = 0;
      // ensure scores object exists for me
      this.db.ref(`rooms/${this.roomCode}/scores/${this.myPlayerKey}`).transaction(curr => curr || 0);
      this.renderNextGuessTile();
    });
  }

  renderNextGuessTile() {
    if (!this.guessTargets || this.currentTargetIdx >= this.guessTargets.length) {
      this.finishMyGuessingTurn();
      return;
    }
    const targetKey = this.guessTargets[this.currentTargetIdx];
    const qIndex = this.currentTargetQIndex;
    const question = QUESTIONS[qIndex];
    // fetch real answer
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
          <div class="qa-options">
            ${question.options.map((opt, i) => `<button class="option-btn" data-opt="${i}">${escapeHtml(opt)}</button>`).join('')}
          </div>
          <div class="guess-feedback" style="margin-top:12px;"></div>
        </div>
      `;
      stageInner.appendChild(tile);
      requestAnimationFrame(() => requestAnimationFrame(() => tile.classList.add('enter')));
      tile.querySelectorAll('.option-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          // disable
          tile.querySelectorAll('.option-btn').forEach(b => b.disabled = true);
          const guessedIndex = parseInt(btn.dataset.opt, 10);
          const correct = !!realAnswer && (realAnswer.optionIndex === guessedIndex);
          const feedback = tile.querySelector('.guess-feedback');
          feedback.innerHTML = correct ? `<span class="guess-result guess-correct">✓</span> Correct` : `<span class="guess-result guess-wrong">✕</span> Wrong`;
          // save guess
          const guessRef = this.db.ref(`rooms/${this.roomCode}/guesses/${this.myPlayerKey}/${targetKey}/${qIndex}`);
          guessRef.set({ guessedIndex, correct, ts: Date.now() }).catch(e => console.warn('save guess fail', e));
          // update score
          const scoreRef = this.db.ref(`rooms/${this.roomCode}/scores/${this.myPlayerKey}`);
          scoreRef.transaction(curr => (curr || 0) + (correct ? 1 : -1));
          // animate out after short pause
          setTimeout(() => {
            tile.classList.remove('enter');
            tile.classList.add('exit');
            tile.addEventListener('transitionend', () => {
              if (tile.parentNode) tile.parentNode.removeChild(tile);
              this.advanceGuessIndices();
              this.renderNextGuessTile();
            }, { once: true });
          }, 700);
        });
      });
    }).catch(err => {
      console.error('fetch real answer error', err);
      // allow user to guess even if answer missing
      this.renderNextGuessTile(); // skip fragile case
    });
  }

  advanceGuessIndices() {
    this.currentTargetQIndex += 1;
    if (this.currentTargetQIndex >= QUESTIONS.length) {
      this.currentTargetQIndex = 0;
      this.currentTargetIdx += 1;
    }
  }

  finishMyGuessingTurn() {
    if (!this.db || !this.roomCode) return;
    const myKey = this.myPlayerKey;
    this.db.ref(`rooms/${this.roomCode}/guessCompletions/${myKey}`).set(true).catch(e => console.warn('set completion fail', e));
    // atomically increment currentGuesserIndex
    const roomRef = this.db.ref(`rooms/${this.roomCode}`);
    roomRef.transaction(current => {
      if (!current) return current;
      const idx = (current.currentGuesserIndex || 0) + 1;
      current.currentGuesserIndex = idx;
      return current;
    }).then(() => console.log('requested increment of currentGuesserIndex'))
      .catch(err => console.error('increment currentGuesserIndex failed', err));
  }

  checkAllGuessingComplete() {
    if (!this.db || !this.roomCode) return;
    this.db.ref(`rooms/${this.roomCode}/guessCompletions`).once('value').then(snap => {
      const comps = snap.val() || {};
      const count = Object.keys(comps).length;
      if (count >= this.expectedPlayers) {
        this.db.ref(`rooms/${this.roomCode}`).update({ phase: 'done' }).catch(e => console.warn('set phase done fail', e));
      }
    }).catch(e => console.warn('checkAllGuessingComplete fail', e));
  }
}

/* ===== instantiate when DOM ready ===== */
let gameInstance = null;
document.addEventListener("DOMContentLoaded", () => {
  if (!window.db) console.warn("window.db falsy; check firebase-config.js");
  gameInstance = new MultiplayerIfIWereGame();
  // optionally, if user already joined a room in previous session you can rehydrate:
  // if (someSavedRoomCode) { gameInstance.roomCode = someSavedRoomCode; ... }
});

    

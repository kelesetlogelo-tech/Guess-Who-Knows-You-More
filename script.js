// small QA bank (10)
const QUESTIONS = [
  { text: "If I were a sound effect, I'd be ....", options: ["The frantic hoot of a Siyaya (taxi)","Evil laugh!","A mix of Kwaito & Amapiano basslines from a shebeen","Ta-da!","Dramatic gasp","The hiss of a shaken carbonated drink"] },
  { text: "If I were a weather-forecast, I'd be ....", options: ["Partly dramatic with a chance of chaos","Sudden tornado of opinions","100% chill","Heatwave in Limpopo","The calm before the storm: I'm a quiet observer until I have had too much coffee!","Severe weather alert for a sudden unexplainable urge to reorganize my entire livingspace"] },
  { text: "If I were a bedtime excuse, I'd be ....", options: ["I need to find the remote","I need to search for \"Pillow\"","Trying to find my way out of this rabbit hole of YouTube videos","I need water","There's something in my closet","Just one more episode","There's a spider in my room"] },
  { text: "If I were a breakfast cereal, I'd be ....", options: ["Jungle Oats","Weetbix","The weird healthy one that keeps piling up in the pantry","Rice Krispies","Bokomo Cornflakes","MorVite"] },
  { text: "If I were a villain in a movie, I'd be ....", options: ["Thanos","Grinch","Scarlet Overkill","A mosquito in your room at night","Darth Vader","Doctor Doom","Emperor Palpatine"] },
  { text: "If I were a kitchen appliance, I'd be ....", options: ["A blender on high speed with no lid","A toaster that only pops when no one’s looking","A microwave that screams when it’s done","A fridge that judges your snack choices"] },
  { text: "If I were a dance move, I'd be ....", options: ["The sprinkler: I'm a little awkward, a little stiff and probably hitting the person next to me!","The moonwalk: I'm trying to move forward, but somehow end up where I started...","The “I thought no one was watching” move","The knee-pop followed by a regretful sit-down","The Macarena: I know I can do it, but I'm not quite sure why","That \"running to the bathroom\" shuffle: the desperate high-speed march with clenched-up posture and wild eyes"] },
  { text: "If I were a text message, I'd be ....", options: ["A typo-ridden voice-to-text disaster","A three-hour late \"LOL\"","A group chat gif spammer","A mysterious \"K.\" with no context"] },
  { text: "If I were a warning label, I'd be ....", options: ["Caution: May spontaneously break into song","Warning: Contains high levels of optimism and creative ideas, but only after caffeine","Contents may cause uncontrollable giggles","Warning: Do not operate on an empty stomach","Warning: Will talk your ear off about random facts","May contain traces of impulsive decisions","Caution: Do not interrupt during a new K-Pop music video release","Warning: Do not approach before first cup of coffee"] },
  { text: "If I were a type of chair, I'd be ....", options: ["That sofa at Phala Phala","A creaky antique that screams when you sit","One of those folding chairs that attack your fingers","The overstuffed armchair covered in snack crumbs","The velvet fainting couch - I'm a little dramatic... a lot extra actually!"] }
];

// tiny HTML escape helper
function escapeHtml(str) {
  return (str + '').replace(/[&<>"']/g, function(m) {
    return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m];
  });
}

console.log("script.js loaded");

class MultiplayerIfIWereGame {
  constructor() {
    // firebase DB (should be set by firebase-config.js as window.db)
    this.db = window.db || null;

    // room/player state
    this.roomCode = null;
    this.roomRef = null;
    this.playersRef = null;
    this.myPlayerKey = null; // push key for this player
    this.isHost = false;
    this.playerName = "";
    this.expectedPlayers = 0;

    // QA state
    this.qaIndex = 0;
    this.qaTotal = QUESTIONS.length;
    this.qaStageInner = null;

    // attach UI after DOM ready
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", () => this.hookUI());
    } else {
      this.hookUI();
    }

    console.log("MultiplayerIfIWereGame constructed — db present?", !!this.db);
  }

  // helper to try multiple ids
  $$(ids) {
    for (const id of ids) {
      const el = document.getElementById(id);
      if (el) return el;
    }
    return null;
  }

  hookUI() {
    console.log("hookUI: wiring UI");

    const createBtn = this.$$(["createRoomBtn","createRoom","create-room-button"]);
    const joinBtn   = this.$$(["joinRoomBtn","joinRoom","join-room-button"]);
    const beginBtn  = this.$$(["beginBtn","beginGame","begin-game-btn"]);

    if (!createBtn) console.warn("Create button not found. Expected id createRoomBtn/createRoom");
    if (!joinBtn) console.warn("Join button not found. Expected id joinRoomBtn/joinRoom");
    if (!beginBtn) console.warn("Begin button may be missing (host only)");

    if (createBtn) createBtn.addEventListener("click", () => this.handleCreateClick());
    if (joinBtn)   joinBtn.addEventListener("click", () => this.handleJoinClick());
    if (beginBtn)  beginBtn.addEventListener("click", () => this.handleBeginClick());

    console.log("hookUI complete. Elements found:", {
      createBtn: !!createBtn,
      joinBtn: !!joinBtn,
      beginBtn: !!beginBtn
    });
  }

  handleCreateClick() {
    console.log("Create button clicked");
    if (!this.db) {
      console.error("Firebase DB (window.db) not found.");
      alert("Firebase not initialized. See console.");
      return;
    }

    const hostNameEl = this.$$(["hostName","host-name","host-name-input"]);
    const playerCountEl = this.$$(["playerCount","playerCount","numPlayers","player-count-input"]);

    if (!hostNameEl || !playerCountEl) {
      alert("Host inputs missing in the DOM. Check input element IDs.");
      return;
    }

    const hostName = (hostNameEl.value || "").trim();
    const count = parseInt(playerCountEl.value, 10);

    if (!hostName || isNaN(count) || count < 2 || count > 8) {
      alert("Enter host name and number of players (2–8).");
      return;
    }

    this.createRoom(hostName, count);
  }

  handleJoinClick() {
    console.log("Join button clicked");
    if (!this.db) {
      console.error("Firebase DB (window.db) not found.");
      alert("Firebase not initialized. See console.");
      return;
    }

    const playerNameEl = this.$$(["playerName","player-name","player-name-input"]);
    const roomCodeEl = this.$$(["roomCodeInput","roomCode","room-code-input","joinCode"]);

    if (!playerNameEl || !roomCodeEl) {
      alert("Join inputs missing in the DOM. Check input element IDs.");
      return;
    }

    const playerName = (playerNameEl.value || "").trim();
    const roomCode = (roomCodeEl.value || "").trim().toUpperCase();

    if (!playerName || !roomCode) {
      alert("Enter your name and room code.");
      return;
    }

    this.joinRoom(playerName, roomCode);
  }

  handleBeginClick() {
    console.log("Begin clicked");
    if (!this.isHost || !this.roomRef) {
      console.warn("Begin clicked but not host or no roomRef");
      return;
    }
    this.roomRef.update({ gameStarted: true })
      .then(() => console.log("gameStarted flag set"))
      .catch(err => console.error("Failed to set gameStarted:", err));
  }

  // generate code
  generateRoomCode() {
    return Math.random().toString(36).substring(2, 7).toUpperCase();
  }

  // create room and push host into players (store myPlayerKey)
  createRoom(hostName, expectedPlayers) {
    this.isHost = true;
    this.playerName = hostName;
    this.expectedPlayers = expectedPlayers;
    this.roomCode = this.generateRoomCode();

    this.roomRef = this.db.ref(`rooms/${this.roomCode}`);
    this.playersRef = this.roomRef.child("players");

    // set metadata, then push host player entry
    this.roomRef.set({
      host: hostName,
      expectedPlayers: expectedPlayers,
      gameStarted: false
    }).then(() => {
      const p = this.playersRef.push();
      return p.set({ name: hostName, joinedAt: Date.now(), isHost: true }).then(() => {
        this.myPlayerKey = p.key;
        console.log("Host added with key:", this.myPlayerKey);
        this.showWaitingUI();
        this.listenForPlayers();
      });
    }).catch(err => {
      console.error("createRoom error:", err);
      alert("Could not create room. See console.");
    });
  }

     joinRoom(playerName, roomCode) {
     console.log("joinRoom called with", playerName, roomCode);

  if (!this.db) {
    console.error("joinRoom: window.db not available");
    alert("Firebase not initialized. Check console.");
    return;
  }
  this.playerName = playerName;
  this.roomCode = roomCode;
  this.roomRef = this.db.ref(`rooms/${this.roomCode}`);
  this.playersRef = this.roomRef.child("players");

  // Check room exists first
  this.roomRef.once("value")
    .then(snapshot => {
      if (!snapshot.exists()) {
        alert("Room not found. Check the code and try again.");
        throw new Error("Room not found: " + this.roomCode);
      }

      // push the player and store the push key on success
      const newPlayerRef = this.playersRef.push();
      return newPlayerRef.set({
        name: playerName,
        joinedAt: Date.now(),
        isHost: false
      }).then(() => {
        this.myPlayerKey = newPlayerRef.key;
        console.log("Player pushed with key:", this.myPlayerKey);

        // Show waiting UI and start listening for players + gameStarted
        this.showWaitingUI();
        this.listenForPlayers();

        // optional: write lastSeen or client info
        try {
          this.roomRef.child(`lastJoinEvents/${this.myPlayerKey}`).set({
            name: playerName,
            ts: Date.now()
          });
        } catch (e) { /* ignore write failure */ }
      });
    })
    .catch(err => {
      // already alerted above for not found; log other errors
      if (err && err.message) console.error("joinRoom error:", err);
    });
}


  // show waiting room UI
  showWaitingUI() {
    const landing = this.$$(["landing","landing-screen"]);
    const waiting = this.$$(["waitingRoom","waiting-room"]);
    const roomCodeDisplay = this.$$(["roomCodeDisplay","roomCode","room-code-display"]);

    if (landing) landing.classList.add("hidden");
    if (waiting) waiting.classList.remove("hidden");
    if (roomCodeDisplay) roomCodeDisplay.textContent = this.roomCode;
  }

  // listen for players and start flag
  listenForPlayers() {
  if (!this.roomRef || !this.playersRef) {
    console.error("listenForPlayers: missing refs", this.roomRef, this.playersRef);
    return;
  }

  console.log("listenForPlayers: attaching listeners for", this.roomCode);

  // Fast incremental update: child_added so UI shows new player immediately
  this.playersRef.on("child_added", snapshot => {
    const pdata = snapshot.val();
    const pkey = snapshot.key;
    console.log("child_added:", pkey, pdata);

    // Update UI incrementally
    const playerListEl = document.getElementById("playerList");
    if (playerListEl) {
      const li = document.createElement("li");
      li.dataset.key = pkey;
      li.textContent = pdata && pdata.name ? pdata.name : ("Player " + pkey);
      playerListEl.appendChild(li);
    }
  });

  // Full snapshot to recalc counts and ensure no dupes
  this.playersRef.on("value", snapshot => {
    const obj = snapshot.val() || {};
    const players = Object.values(obj).map(p => p.name || "Unnamed");
    console.log("players.value snapshot:", players);

    // dedupe UI list and rebuild (robust approach)
    const listEl = document.getElementById("playerList");
    if (listEl) {
      listEl.innerHTML = "";
      players.forEach(name => {
        const li = document.createElement("li");
        li.textContent = name;
        listEl.appendChild(li);
      });
    }

    // Update count if host provided expectedPlayers
    const countEl = document.getElementById("playersCount");
    if (countEl) countEl.textContent = `${players.length} / ${this.expectedPlayers || "?"} joined`;

    // If I'm the host and we've reached expected players, show Begin
    if (this.isHost && players.length >= this.expectedPlayers) {
      const beginBtn = document.getElementById("beginBtn") || document.getElementById("beginGame");
      if (beginBtn) beginBtn.classList.remove("hidden");
    }
  });

  // Listen for gameStarted flag
  this.roomRef.child("gameStarted").on("value", snap => {
    if (snap.val() === true) {
      console.log("listenForPlayers: gameStarted true -> startGame");
      this.startGame();
    }
  });
}


  // startGame transitions to QA (uses startQA)
  startGame() {
    console.log("startGame invoked");
    const waiting = this.$$(["waitingRoom","waiting-room"]);
    const gamePhase = this.$$(["gamePhase","game-phase","gameArea"]);
    if (waiting) waiting.classList.add("hidden");
    if (gamePhase) gamePhase.classList.remove("hidden");
    // begin QA
    this.startQA();
  }

  // ---------- Q&A methods ----------
  startQA() {
    this.qaIndex = 0;
    this.qaTotal = QUESTIONS.length;
    this.qaStageInner = document.getElementById("questionCard");
    if (!this.qaStageInner) {
      console.error("questionCard element not found");
      return;
    }
    this.qaStageInner.innerHTML = '<div class="qa-stage" id="qaStageInner"></div>';
    this.qaStageInner = document.getElementById("qaStageInner");
    this.renderNextQuestion();
  }

  renderNextQuestion() {
    if (this.qaIndex >= this.qaTotal) {
      this.onQAComplete();
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

    // enter animation
    requestAnimationFrame(() => requestAnimationFrame(() => tile.classList.add("enter")));

    // attach handlers
    tile.querySelectorAll(".option-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        this.handleOptionSelected(tile, parseInt(btn.dataset.opt, 10));
      });
    });
  }

  handleOptionSelected(tileEl, optionIndex) {
    // disable options
    tileEl.querySelectorAll(".option-btn").forEach(b => b.disabled = true);

    const qIndex = parseInt(tileEl.dataset.qindex, 10);
    const q = QUESTIONS[qIndex];
    const selectedText = q.options[optionIndex];

    // save answer to Firebase (if available)
    try {
      const playerId = this.myPlayerKey || this.playerName || `player_${Date.now()}`;
      if (this.db && this.roomCode) {
        const answerRef = this.db.ref(`rooms/${this.roomCode}/answers/${playerId}/${qIndex}`);
        answerRef.set({ optionIndex, optionText: selectedText, ts: Date.now() })
          .catch(err => console.warn("Failed saving answer:", err));
      }
    } catch (err) {
      console.warn("Error saving answer:", err);
    }

    // animate out
    tileEl.classList.remove("enter");
    tileEl.classList.add("exit");

    const onTransitionEnd = (ev) => {
      if (ev.target !== tileEl) return;
      tileEl.removeEventListener("transitionend", onTransitionEnd);
      if (tileEl.parentNode) tileEl.parentNode.removeChild(tileEl);

      // next question
      this.qaIndex += 1;
      this.renderNextQuestion();
    };
    tileEl.addEventListener("transitionend", onTransitionEnd);
  }

  onQAComplete() {
    // show completion tile
    this.qaStageInner.innerHTML = `
      <div class="qa-tile enter">
        <div class="qa-card">
          <h3>All done!</h3>
          <p>You completed all ${this.qaTotal} questions. Thanks!</p>
        </div>
      </div>
    `;
    // mark completion in firebase
    try {
      const playerId = this.myPlayerKey || this.playerName || `player_${Date.now()}`;
      if (this.db && this.roomCode) {
        this.db.ref(`rooms/${this.roomCode}/completions/${playerId}`).set({ completedAt: Date.now() });
      }
    } catch (err) { /* ignore */ }
  }
  // ---------- end Q&A methods ----------
}

// instantiate once DOM is ready
let gameInstance = null;
document.addEventListener("DOMContentLoaded", () => {
  if (!window.db) console.warn("window.db falsy; check firebase-config.js");
  gameInstance = new MultiplayerIfIWereGame();

/* ========== Guessing phase methods - paste inside MultiplayerIfIWereGame class ========== */

/**
 * Called when QA phase is finished for all players.
 * Host/first client should initialize guessingOrder and set phase='guessing'
 * Logic: anyone who sees phase === 'guessing' will begin listening.
 */
initGuessingPhaseIfReady() {
  // Called after QA completions were written. Host can set guessing order when all QA done.
  const roomRef = this.db.ref(`rooms/${this.roomCode}`);
  roomRef.child('qaCompletions').once('value').then(snap => {
    const obj = snap.val() || {};
    const completedCount = Object.keys(obj).length;
    console.log('QA completions count:', completedCount, 'expected:', this.expectedPlayers);
    if (completedCount >= this.expectedPlayers) {
      // build guessing order from players list, stable order: use players keys array
      this.db.ref(`rooms/${this.roomCode}/players`).once('value').then(psnap => {
        const playersObj = psnap.val() || {};
        const order = Object.keys(playersObj || {});
        // store order and set phase
        roomRef.update({
          guessingOrder: order,
          currentGuesserIndex: 0,
          phase: 'guessing'
        }).then(() => console.log('Guessing phase initialized with order:', order))
          .catch(err => console.error('Failed to init guessing phase:', err));
      });
    }
  }).catch(err => console.error('initGuessingPhaseIfReady error:', err));
}

/**
 * All clients should call this to start listening for phase changes
 */
listenForGuessingPhase() {
  const roomRef = this.db.ref(`rooms/${this.roomCode}`);
  roomRef.child('phase').on('value', snap => {
    const phase = snap.val();
    console.log('phase changed ->', phase);
    if (phase === 'guessing') {
      // load order and current index, and enter appropriate UI
      roomRef.child('guessingOrder').once('value').then(oSnap => {
        const order = oSnap.val() || [];
        this.guessingOrder = order;
        roomRef.child('currentGuesserIndex').once('value').then(idxSnap => {
          this.currentGuesserIndex = idxSnap.val() || 0;
          this.applyGuessingState(); // show UI or wait
        });
      });
    }
  });
}

/**
 * Called after we got guessingOrder and currentGuesserIndex.
 * If this client is the active guesser, show guess UI; else show waiting room with statuses.
 */
applyGuessingState() {
  const activeKey = this.guessingOrder && this.guessingOrder[this.currentGuesserIndex];
  const isMyTurn = (this.myPlayerKey === activeKey);
  console.log('Active guesser key:', activeKey, 'isMyTurn?', isMyTurn);

  // show/hide sections
  document.getElementById('gamePhase')?.classList.add('hidden'); // hide QA gamePhase if present
  document.getElementById('guessWaitingRoom')?.classList.remove('hidden');
  document.getElementById('guessPhase')?.classList.toggle('hidden', !isMyTurn);

  // show room code on waiting UI
  const rcd = document.getElementById('roomCodeDisplay_guess'); if (rcd) rcd.textContent = this.roomCode;

  // show statuses and who is active
  this.renderGuessingStatuses();

  // if it's my turn start guessing flow
  if (isMyTurn) {
    document.getElementById('activeGuesserLabel').textContent = `You are guessing now — make guesses for all players`;
    this.startGuessingForMe();
  } else {
    // show who is active
    const name = this.getPlayerNameByKey(activeKey) || 'Another player';
    document.getElementById('activeGuesserLabel').textContent = `${name} is guessing now — please wait`;
  }

  // also listen for changes to currentGuesserIndex to react when host increments it
  this.db.ref(`rooms/${this.roomCode}/currentGuesserIndex`).on('value', snap => {
    const idx = snap.val();
    if (typeof idx === 'number') {
      this.currentGuesserIndex = idx;
      // re-apply state so UI updates when turn moves
      this.applyGuessingState();
    }
  });

  // listen for completions to update waiting room statuses
  this.db.ref(`rooms/${this.roomCode}/guessCompletions`).on('value', snap => {
    this.renderGuessingStatuses();
  });
}

/**
 * Render the Guessing Waiting Room statuses
 */
renderGuessingStatuses() {
  const listEl = document.getElementById('guessPlayerStatusList');
  if (!listEl) return;
  listEl.innerHTML = '';

  // read players then completions
  this.db.ref(`rooms/${this.roomCode}/players`).once('value').then(psnap => {
    const players = psnap.val() || {};
    this.db.ref(`rooms/${this.roomCode}/guessCompletions`).once('value').then(csnap => {
      const comps = csnap.val() || {};
      // players is an object keyed by playerId
      Object.keys(players).forEach(pid => {
        const li = document.createElement('li');
        const pname = players[pid].name || pid;
        const status = comps && comps[pid] ? 'completed' : 'pending';
        li.textContent = `${pname} — ${status}`;
        if (comps && comps[pid]) {
          li.style.opacity = '0.7';
        }
        listEl.appendChild(li);
      });
    });
  });
}

/**
 * Utility: get player display name by Firebase key
 */
getPlayerNameByKey(key) {
  // we assume players were loaded earlier; if not, fetch once
  // try to read cached players map
  if (this.playersCache && this.playersCache[key]) return this.playersCache[key].name;
  // else fetch
  this.db.ref(`rooms/${this.roomCode}/players/${key}`).once('value').then(s => {
    const v = s.val(); if (!this.playersCache) this.playersCache = {}; this.playersCache[key] = v;
  });
  return null;
}

/**
 * Active guesser: start guessing for self. The flow:
 *  - Build list of targets (all players except self)
 *  - For each target, for qIndex 0..(QUESTIONS.length-1), present the tile and accept guess.
 */
startGuessingForMe() {
  // build list of target player keys
  this.db.ref(`rooms/${this.roomCode}/players`).once('value').then(psnap => {
    const playersObj = psnap.val() || {};
    const allKeys = Object.keys(playersObj);
    // exclude self
    const myKey = this.myPlayerKey;
    this.guessTargets = allKeys.filter(k => k !== myKey);
    this.currentTargetIdx = 0;
    this.currentTargetQIndex = 0;
    // show first guess tile
    this.renderNextGuessTile();
  }).catch(err => console.error('startGuessingForMe error:', err));
}

/**
 * Render next guess tile for active guesser (for current target and question)
 */
renderNextGuessTile() {
  const totalTargets = this.guessTargets.length;
  if (this.currentTargetIdx >= totalTargets) {
    // finished all targets -> mark completion
    this.finishMyGuessingTurn();
    return;
  }

  const targetKey = this.guessTargets[this.currentTargetIdx];
  const qIndex = this.currentTargetQIndex;
  const question = QUESTIONS[qIndex];

  // fetch target's real answer to compare later (but do not show it)
  this.db.ref(`rooms/${this.roomCode}/answers/${targetKey}/${qIndex}`).once('value')
    .then(ansSnap => {
      const realAnswer = ansSnap.val(); // { optionIndex, optionText, ts } or null
      // build tile UI (reuse QA tile markup / animations)
      const stage = document.getElementById('guessCard');
      if (!stage) return;
      stage.innerHTML = `<div class="qa-stage" id="guessQAStage"></div>`;
      const stageInner = document.getElementById('guessQAStage');

      const tile = document.createElement('div');
      tile.className = 'qa-tile';
      tile.dataset.qindex = qIndex;
      tile.dataset.targetKey = targetKey;

      const targetName = this.getPlayerNameByKey(targetKey) || 'Player';

      tile.innerHTML = `
        <div class="qa-card">
          <h3>Guess for ${escapeHtml(targetName)} — question ${qIndex + 1}</h3>
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
          const guessedIndex = parseInt(btn.dataset.opt, 10);
          const correct = realAnswer && (realAnswer.optionIndex === guessedIndex);
          // show immediate feedback (green check / red x)
          const feedback = tile.querySelector('.guess-feedback');
          feedback.innerHTML = correct
            ? `<span class="guess-result guess-correct">✓</span> Correct`
            : `<span class="guess-result guess-wrong">✕</span> Wrong`;
          // save guess in DB
          const guessRef = this.db.ref(`rooms/${this.roomCode}/guesses/${this.myPlayerKey}/${targetKey}/${qIndex}`);
          guessRef.set({ guessedIndex, correct, ts: Date.now() })
            .catch(e => console.warn('Failed to save guess:', e));

          // adjust score: +1 / -1 for guesser
          const scoreRef = this.db.ref(`rooms/${this.roomCode}/scores/${this.myPlayerKey}`);
          scoreRef.transaction(curr => (curr || 0) + (correct ? 1 : -1));

          // animate tile out after a short delay
          setTimeout(() => {
            tile.classList.remove('enter');
            tile.classList.add('exit');
            tile.addEventListener('transitionend', () => {
              // advance to next question/target
              this.advanceGuessIndices();
              // clear stage and render next tile
              stageInner.innerHTML = '';
              this.renderNextGuessTile();
            }, { once: true });
          }, 700);
        });
      });
    }).catch(err => {
      console.error('Error fetching real answer:', err);
      // still allow guessing (treat as unknown -> always wrong)
      // implement similar UI but handle null realAnswer as always incorrect
    });
}

/**
 * Advance indices after successful selection
 */
advanceGuessIndices() {
  this.currentTargetQIndex += 1;
  if (this.currentTargetQIndex >= QUESTIONS.length) {
    this.currentTargetQIndex = 0;
    this.currentTargetIdx += 1;
  }
}

/**
 * Mark this guesser as complete and advance currentGuesserIndex (in DB) to next player.
 */
finishMyGuessingTurn() {
  const myKey = this.myPlayerKey;
  // set completion flag
  this.db.ref(`rooms/${this.roomCode}/guessCompletions/${myKey}`).set(true);

  // increment currentGuesserIndex atomically (transaction)
  const roomRef = this.db.ref(`rooms/${this.roomCode}`);
  roomRef.transaction(current => {
    if (!current) return current;
    const idx = (current.currentGuesserIndex || 0) + 1;
    current.currentGuesserIndex = idx;
    return current;
  }).then(() => {
    console.log('Requested increment of currentGuesserIndex');
  }).catch(err => console.error('Failed to increment currentGuesserIndex:', err));
}

/**
 * Utility: called by any client periodically or after changes to show waiting status
 * When all players have guessCompletions true, set phase='done' (game over)
 */
checkAllGuessingComplete() {
  this.db.ref(`rooms/${this.roomCode}/guessCompletions`).once('value').then(snap => {
    const comps = snap.val() || {};
    const count = Object.keys(comps).length;
    if (count >= this.expectedPlayers) {
      // finalize phase
      this.db.ref(`rooms/${this.roomCode}`).update({ phase: 'done' });
    }
  });
}




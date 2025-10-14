// Purpose: attach UI handlers only after DOM is ready and guard against missing elements / missing Firebase.

console.log("script.js loaded");

// ---------- Q&A bank (add at top of script.js, before the class) ----------
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

// very small helper to escape question text (prevent accidental HTML injection)
function escapeHtml(str) {
  return (str + '').replace(/[&<>"']/g, function(m) {
    return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m];
  });
}

class MultiplayerIfIWereGame {
  constructor() {
    this.db = window.db || null;
    this.roomCode = null;
    this.roomRef = null;
    this.playersRef = null;
    this.isHost = false;
    this.expectedPlayers = 0;
    this.playerName = "";

    // Don't attach UI until DOM is ready
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", () => this.hookUI());
    } else {
      this.hookUI();
    }

    console.log("MultiplayerIfIWereGame constructed — db present?", !!this.db);
  }

  // Safe element getter with multiple id fallbacks
  $$(ids) {
    for (const id of ids) {
      const el = document.getElementById(id);
      if (el) return el;
    }
    return null;
  }

  hookUI() {
    console.log("hookUI: DOM ready — wiring UI");

    // Try multiple common IDs so this file is resilient to small id differences
    const createBtn = this.$$(["createRoomBtn", "createRoom", "create-room-button"]);
    const joinBtn   = this.$$(["joinRoomBtn", "joinRoom", "join-room-button"]);
    const beginBtn  = this.$$(["beginBtn", "beginGame", "begin-game-btn"]);

    if (!createBtn) console.error("Create button not found. Expected id: createRoomBtn/createRoom/create-room-button");
    if (!joinBtn)   console.error("Join button not found. Expected id: joinRoomBtn/joinRoom/join-room-button");
    if (!beginBtn)  console.warn("Begin button not found (host UI). Expected id: beginBtn/beginGame/begin-game-btn");

    // Attach listeners if elements exist
    if (createBtn) createBtn.addEventListener("click", (e) => this.handleCreate(e));
    if (joinBtn)   joinBtn.addEventListener("click", (e) => this.handleJoin(e));
    if (beginBtn)  beginBtn.addEventListener("click", (e) => this.handleBegin(e));

    // Also log useful DOM references for debugging
    console.log("hookUI complete. Found elements:", { createBtn: !!createBtn, joinBtn: !!joinBtn, beginBtn: !!beginBtn });
  }

  // Handler wrappers
  handleCreate(e) {
    console.log("Create button clicked");
    if (!this.db) {
      console.error("Firebase DB (window.db) not found. Make sure firebase-config.js runs before script.js and sets window.db = firebase.database()");
      alert("Firebase not initialized. See console.");
      return;
    }

    const hostNameEl = this.$$(["hostName", "host-name", "host-name-input"]);
    const playerCountEl = this.$$(["playerCount","playerCount","numPlayers","player-count-input"]);

    if (!hostNameEl || !playerCountEl) {
      console.error("Host name or player count element missing. hostNameEl:", !!hostNameEl, "playerCountEl:", !!playerCountEl);
      alert("Host input fields missing. Check HTML IDs.");
      return;
    }

    const hostName = (hostNameEl.value || "").trim();
    const count = parseInt(playerCountEl.value, 10);

    if (!hostName || isNaN(count) || count < 2 || count > 8) {
      alert("Please enter a host name and a valid player count (2–8).");
      return;
    }

    this.createRoom(hostName, count);
  }

  handleJoin(e) {
    console.log("Join button clicked");
    if (!this.db) {
      console.error("Firebase DB (window.db) not found.");
      alert("Firebase not initialized. See console.");
      return;
    }

    const playerNameEl = this.$$(["playerName","player-name","player-name-input"]);
    const roomCodeEl   = this.$$(["roomCodeInput","roomCode","room-code-input","joinCode"]);

    if (!playerNameEl || !roomCodeEl) {
      console.error("Join inputs missing. playerNameEl:", !!playerNameEl, "roomCodeEl:", !!roomCodeEl);
      alert("Join input fields missing. Check HTML IDs.");
      return;
    }

    const name = (playerNameEl.value || "").trim();
    const code = (roomCodeEl.value || "").trim().toUpperCase();

    if (!name || !code) {
      alert("Please enter your name and the room code.");
      return;
    }

    this.joinRoom(name, code);
  }

  handleBegin(e) {
    console.log("Begin button clicked");
    if (!this.isHost) {
      console.warn("Begin clicked by non-host — ignoring");
      return;
    }
    if (!this.roomRef) {
      console.error("Room ref missing; cannot begin");
      return;
    }

    this.roomRef.update({ gameStarted: true })
      .then(() => console.log("Game started flag set in DB"))
      .catch(err => console.error("Failed to set gameStarted:", err));
  }

  // Core flows
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

    const p = this.playersRef.push();
      p.set({ name: hostName, joinedAt: Date.now(), isHost: true })
      .then(() => {
    this.myPlayerKey = p.key;
   })
      .catch(err => console.warn("Failed to add host player:", err));

    this.roomRef.set({
      host: hostName,
      expectedPlayers: expectedPlayers,
      gameStarted: false
    }).then(() => {
      return this.playersRef.push().set({ name: hostName, joinedAt: Date.now(), isHost: true });
    }).then(() => {
      console.log("Room created:", this.roomCode);
      // show code in UI if spot exists
      const roomCodeDisplay = this.$$(["roomCodeDisplay","roomCode","room-code-display"]);
      if (roomCodeDisplay) roomCodeDisplay.textContent = this.roomCode;
      this.showWaitingUI();
      this.listenForPlayers();
    }).catch(err => {
      console.error("createRoom error:", err);
      alert("Failed to create room — check console.");
    });
  }

  joinRoom(playerName, roomCode) {
    this.playerName = playerName;
    this.roomCode = roomCode;

    this.roomRef = this.db.ref(`rooms/${this.roomCode}`);
    this.playersRef = this.roomRef.child("players");

    // ensure room exists
    this.roomRef.once("value").then(snap => {
      if (!snap.exists()) {
        alert("Room not found.");
        throw new Error("Room not found: " + this.roomCode);
      }
      return this.playersRef.push().set({ name: playerName, joinedAt: Date.now(), isHost: false });
    }).then(() => {
      console.log("Joined room:", this.roomCode);
      // show the code
      const roomCodeDisplay = this.$$(["roomCodeDisplay","roomCode","room-code-display"]);
      if (roomCodeDisplay) roomCodeDisplay.textContent = this.roomCode;
      this.showWaitingUI();
      this.listenForPlayers();
    }).catch(err => {
      console.error("joinRoom error:", err);
    });
  }

  showWaitingUI() {
    // hide landing
    const landing = this.$$(["landing","landing-screen"]);
    const waiting = this.$$(["waitingRoom","waiting-room"]);
    if (landing) landing.classList.add("hidden");
    if (waiting) waiting.classList.remove("hidden");
  }

  listenForPlayers() {
    if (!this.playersRef || !this.roomRef) {
      console.error("listenForPlayers called without refs", this.playersRef, this.roomRef);
      return;
    }

    console.log("Listening for players on room:", this.roomCode);

    this.playersRef.on("value", snap => {
      const playersObj = snap.val() || {};
      const players = Object.values(playersObj).map(p => p.name || "Unnamed");

      const p = this.playersRef.push();
            p.set({ name: playerName, joinedAt: Date.now(), isHost: false })
            .then(() => {
      this.myPlayerKey = p.key;
  })
  .catch(err => console.warn("Failed to add player:", err));


      // update UI
      const listEl = this.$$(["playerList","player-list","playerListEl","playersList"]);
      if (listEl) {
        listEl.innerHTML = "";
        players.forEach(n => {
          const li = document.createElement("li");
          li.textContent = n;
          listEl.appendChild(li);
        });
      }

      // update players count if element present
      const countEl = this.$$(["playersCount","players-count","playersCountEl"]);
      if (countEl) countEl.textContent = `${players.length} / ${this.expectedPlayers || "?"} joined`;

      // If host and we've reached expected players, show begin
      if (this.isHost && players.length >= this.expectedPlayers) {
        const beginBtn = this.$$(["beginBtn","beginGame","begin-game-btn"]);
        if (beginBtn) beginBtn.classList.remove("hidden");
      }
    });

    // watch gameStarted
    this.roomRef.child("gameStarted").on("value", s => {
      if (s.val() === true) {
        console.log("Game started flag seen — starting game locally");
        this.startGame();
      }
    });
  }

  startGame() {
  // hide waiting, show game phase
  const waiting = document.getElementById("waitingRoom");
  const gamePhase = document.getElementById("gamePhase");
  if (waiting) waiting.classList.add("hidden");
  if (gamePhase) gamePhase.classList.remove("hidden");

  // begin QA flow
  this.startQA();

  // initialize QA state
  this.qaIndex = 0;
  this.qaTotal = QUESTIONS.length;

  // the 'questionCard' div in index.html becomes our stage
  this.qaStageEl = document.getElementById("questionCard");
  this.qaStageEl.innerHTML = '<div class="qa-stage" id="qaStageInner"></div>';
  this.qaStageInner = document.getElementById("qaStageInner");

  // render first question
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

  // Force reflow so CSS transitions trigger
  requestAnimationFrame(() => requestAnimationFrame(() => {
    tile.classList.add("enter");
  }));

  // Attach click handlers
  tile.querySelectorAll(".option-btn").forEach(btn => {
    btn.addEventListener("click", (e) => {
      const idx = parseInt(btn.dataset.opt, 10);
      this.handleOptionSelected(tile, idx);
    });
  });
}

handleOptionSelected(tileEl, optionIndex) {
  // disable buttons to prevent double clicks
  tileEl.querySelectorAll(".option-btn").forEach(b => b.disabled = true);

  const qIndex = parseInt(tileEl.dataset.qindex, 10);
  const q = QUESTIONS[qIndex];
  const selectedText = q.options[optionIndex];

  // Save to Firebase answers path if available
  try {
    const playerId = this.myPlayerKey || this.playerName || `player_${Date.now()}`;
    if (this.db && this.roomCode) {
      const answerRef = this.db.ref(`rooms/${this.roomCode}/answers/${playerId}/${qIndex}`);
      answerRef.set({ optionIndex, optionText: selectedText, ts: Date.now() })
        .catch(err => console.warn("Failed to save answer:", err));
    }
  } catch (err) {
    console.warn("Saving answer error:", err);
  }

  // animate current tile out
  tileEl.classList.remove("enter");
  tileEl.classList.add("exit");

  const onTransitionEnd = (ev) => {
    if (ev.target !== tileEl) return;
    tileEl.removeEventListener("transitionend", onTransitionEnd);
    if (tileEl.parentNode) tileEl.parentNode.removeChild(tileEl);

    // advance index and render next tile
    this.qaIndex += 1;
    this.renderNextQuestion();
  };
  tileEl.addEventListener("transitionend", onTransitionEnd);
}

onQAComplete() {
  // replace stage with completion message
  this.qaStageInner.innerHTML = `
    <div class="qa-tile enter">
      <div class="qa-card">
        <h3>All done!</h3>
        <p>Thanks — you completed all ${this.qaTotal} questions.</p>
      </div>
    </div>
  `;

  // mark completion in Firebase if available
  try {
    const playerId = this.myPlayerKey || this.playerName || `player_${Date.now()}`;
    if (this.db && this.roomCode) {
      this.db.ref(`rooms/${this.roomCode}/completions/${playerId}`).set({ completedAt: Date.now() });
    }
  } catch (err) { /* ignore */ }
    }
  }
}

// create instance once DOM loaded
let gameInstance = null;
document.addEventListener("DOMContentLoaded", () => {
  console.log("DOMContentLoaded: creating game instance");
  if (!window.db) console.warn("window.db is falsy — firebase-config.js may not have run yet");
  gameInstance = new MultiplayerIfIWereGame();
});


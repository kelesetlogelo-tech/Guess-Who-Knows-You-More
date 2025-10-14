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

  // join a room and push player record (store myPlayerKey)
  joinRoom(playerName, roomCode) {
    this.playerName = playerName;
    this.roomCode = roomCode;

    this.roomRef = this.db.ref(`rooms/${this.roomCode}`);
    this.playersRef = this.roomRef.child("players");

    // validate existence, then push
    this.roomRef.once("value").then(snap => {
      if (!snap.exists()) {
        alert("Room not found. Check the code.");
        throw new Error("Room not found: " + this.roomCode);
      }
      const p = this.playersRef.push();
      return p.set({ name: playerName, joinedAt: Date.now(), isHost: false }).then(() => {
        this.myPlayerKey = p.key;
        console.log("Joined room; myPlayerKey:", this.myPlayerKey);
        this.showWaitingUI();
        this.listenForPlayers();
      });
    }).catch(err => {
      console.error("joinRoom error:", err);
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
    if (!this.playersRef || !this.roomRef) {
      console.error("listenForPlayers called without refs:", this.playersRef, this.roomRef);
      return;
    }

    console.log("listenForPlayers on", `rooms/${this.roomCode}/players`);

    // update players list
    this.playersRef.on("value", snapshot => {
      const obj = snapshot.val() || {};
      const players = Object.values(obj).map(p => p.name || "Unnamed");
      console.log("players:", players);

      const listEl = this.$$(["playerList","playersList","players-list","playersCountEl"]);
      if (listEl) {
        listEl.innerHTML = "";
        players.forEach(n => {
          const li = document.createElement("li");
          li.textContent = n;
          listEl.appendChild(li);
        });
      }

      // update count text if present
      const countEl = this.$$(["playersCount","players-count","playersCountEl"]);
      if (countEl) countEl.textContent = `${players.length} / ${this.expectedPlayers || "?"} joined`;

      // If host and reached expected players, show Begin
      if (this.isHost && players.length >= this.expectedPlayers) {
        const beginBtn = this.$$(["beginBtn","beginGame","begin-game-btn"]);
        if (beginBtn) beginBtn.classList.remove("hidden");
      }
    });

    // listen for gameStarted flag
    this.roomRef.child("gameStarted").on("value", s => {
      if (s.val() === true) {
        console.log("gameStarted observed -> startGame");
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
});



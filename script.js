/* script.js - parallel guessing flow, manual host reveal, short tile animation.
   Expects `window.db` to be set by firebase-config.js. */

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

function escapeHtml(str) {
  return (str + '').replace(/[&<>"']/g, m => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[m]));
}

console.log("script.js loaded");

class MultiplayerIfIWereGame {
  constructor(){
    this.db = window.db || null;
    // room/player
    this.roomCode = null; this.roomRef = null; this.playersRef = null;
    this.myPlayerKey = null; this.playerName = ""; this.isHost = false; this.expectedPlayers = 0;
    // QA
    this.qaIndex = 0; this.qaTotal = QUESTIONS.length; this.qaStageInner = null;
    // Guessing
    this.guessTargets = []; this.currentTargetIdx = 0; this.currentTargetQIndex = 0; this.isGuessingActive = false;
    // guards & cache
    this._finishRequested = false; this.playersCache = {};
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", ()=>this.hookUI()); else this.hookUI();
    console.log("MultiplayerIfIWereGame constructed — db present?", !!this.db);
  }

  $$(ids){ for (const id of ids){ const el = document.getElementById(id); if (el) return el; } return null; }

  hookUI(){
    console.log("hookUI wiring UI");
    const createBtn = this.$$(["createRoomBtn","createRoom"]);
    const joinBtn = this.$$(["joinRoomBtn","joinRoom"]);
    const beginBtn = this.$$(["beginBtn","beginGame"]);
    if (createBtn){ createBtn.onclick = null; createBtn.addEventListener("click", ()=>this.handleCreateClick()); }
    if (joinBtn){ joinBtn.onclick = null; joinBtn.addEventListener("click", ()=>this.handleJoinClick()); }
    if (beginBtn){ beginBtn.onclick = null; beginBtn.addEventListener("click", ()=>this.handleBeginClick()); }
    const revealBtn = document.getElementById('hostRevealBtn'); if (revealBtn) { revealBtn.onclick = null; revealBtn.addEventListener('click', ()=>this.hostRevealScores()); }
  }

  /* Lobby */
  handleCreateClick(){
    console.log("Create clicked");
    if (!this.db){ alert("Firebase not initialized. See console."); return; }
    const hostNameEl = this.$$(["hostName"]); const playerCountEl = this.$$(["playerCount","numPlayers"]);
    if (!hostNameEl || !playerCountEl){ alert("Host inputs missing"); return; }
    const hostName = (hostNameEl.value||"").trim(); const count = parseInt(playerCountEl.value,10);
    if (!hostName || isNaN(count) || count < 2){ alert("Enter host name and player count >=2"); return; }
    this.createRoom(hostName,count);
  }

  handleJoinClick(){
    console.log("Join clicked");
    if (!this.db){ alert("Firebase not initialized."); return; }
    const playerNameEl = this.$$(["playerName"]); const roomCodeEl = this.$$(["roomCodeInput","roomCode","joinCode"]);
    if (!playerNameEl || !roomCodeEl){ alert("Join inputs missing"); return; }
    const name = (playerNameEl.value||"").trim(); const code = (roomCodeEl.value||"").trim().toUpperCase();
    if (!name || !code) { alert("Enter name and room code"); return; }
    this.joinRoom(name,code);
  }

  handleBeginClick(){
    console.log("Begin clicked");
    if (!this.isHost || !this.roomRef) return;
    this.roomRef.update({ gameStarted:true, phase:"qa" }).then(()=>console.log("gameStarted set")).catch(e=>console.error(e));
  }

  generateRoomCode(){ return Math.random().toString(36).substring(2,7).toUpperCase(); }

  createRoom(hostName, expectedPlayers){
    this.isHost = true; this.playerName = hostName; this.expectedPlayers = expectedPlayers;
    this.roomCode = this.generateRoomCode(); this.roomRef = this.db.ref(`rooms/${this.roomCode}`); this.playersRef = this.roomRef.child("players");
    this.roomRef.set({ host: hostName, expectedPlayers, gameStarted:false, phase:"lobby" })
      .then(()=> {
        const p = this.playersRef.push(); return p.set({ name: hostName, joinedAt: Date.now(), isHost:true }).then(()=> {
          this.myPlayerKey = p.key; this.playersCache[this.myPlayerKey] = { name: hostName, isHost:true };
          console.log("Host added with key:", this.myPlayerKey);
          this.showWaitingUI(); this.listenForPlayers(); this.listenForPhaseChanges();
        });
      }).catch(err=>{ console.error("createRoom error",err); alert("Could not create room — see console."); });
  }

  joinRoom(playerName, roomCode){
    this.playerName = playerName; this.roomCode = roomCode; this.roomRef = this.db.ref(`rooms/${this.roomCode}`); this.playersRef = this.roomRef.child("players");
    this.roomRef.once('value').then(snap => {
      if (!snap.exists()) { alert("Room not found"); throw new Error("not found"); }
      const p = this.playersRef.push();
      return p.set({ name: playerName, joinedAt: Date.now(), isHost:false }).then(()=> {
        this.myPlayerKey = p.key; this.playersCache[this.myPlayerKey] = { name: playerName, isHost:false };
        console.log("Joined with key:", this.myPlayerKey);
        this.showWaitingUI(); this.listenForPlayers(); this.listenForPhaseChanges();
      });
    }).catch(e=>console.error("joinRoom error", e));
  }

  showWaitingUI(){
    const landing = this.$$(["landing"]); const waiting = this.$$(["waitingRoom"]);
    if (landing) landing.classList.add('hidden'); if (waiting) waiting.classList.remove('hidden');
    const r = document.getElementById('roomCode'); if (r) r.textContent = this.roomCode || '';
  }

  listenForPlayers(){
    if (!this.playersRef || !this.roomRef) { console.error("listenForPlayers: refs missing"); return; }
    try { this.playersRef.off(); } catch(e){}
    this.playersRef.on('value', snapshot => {
      const obj = snapshot.val() || {}; this.playersCache = Object.assign({}, this.playersCache, obj);
      const listEl = document.getElementById('playerList'); if (listEl){ listEl.innerHTML = ''; Object.keys(obj).forEach(k=>{ const p = obj[k]||{}; const li=document.createElement('li'); li.textContent = p.name||'Player'; listEl.appendChild(li); }); }
      const players = Object.keys(obj); const countEl = document.getElementById('playersCount'); if (countEl) countEl.textContent = `${players.length} / ${this.expectedPlayers||'?'}`;
      if (this.isHost){ const beginBtn = document.getElementById('beginBtn'); if (beginBtn){ if (players.length >= this.expectedPlayers) beginBtn.classList.remove('hidden'); else beginBtn.classList.add('hidden'); } }
    });
    try { this.roomRef.child('gameStarted').off(); } catch(e){}
    this.roomRef.child('gameStarted').on('value', snap => { if (snap.val()===true) { console.log("gameStarted -> startGame"); this.startGame(); }});
  }

  startGame(){
    console.log("startGame -> QA");
    const waiting = this.$$(["waitingRoom"]); const gamePhase = this.$$(["gamePhase"]);
    if (waiting) waiting.classList.add('hidden'); if (gamePhase) gamePhase.classList.remove('hidden');
    try { if (this.roomRef) this.roomRef.update({ phase: 'qa' }); } catch(e){}
    this.startQA();
  }

  startQA(){
    this.qaIndex = 0; this.qaTotal = QUESTIONS.length;
    const qc = document.getElementById('questionCard'); if (!qc) { console.error("questionCard missing"); return; }
    qc.innerHTML = '<div class="qa-stage" id="qaStageInner"></div>'; this.qaStageInner = document.getElementById('qaStageInner');
    this.renderNextQuestion();
  }

  renderNextQuestion(){
    if (this.qaIndex >= this.qaTotal) {
      try {
        const pid = this.myPlayerKey || this.playerName || `p_${Date.now()}`;
        if (this.db && this.roomCode) this.db.ref(`rooms/${this.roomCode}/qaCompletions/${pid}`).set(true).catch(()=>{});
      } catch(e){ console.warn("qa write failed", e); }
      // hide QA, show guess UI and start guessing (parallel)
      const gamePhase = document.getElementById('gamePhase'); if (gamePhase) gamePhase.classList.add('hidden');
      const guessPhase = document.getElementById('guessPhase'); if (guessPhase) guessPhase.classList.remove('hidden');
      this.startGuessingForMe(); this.showPreGuessWaitingRoom();
      return;
    }

    const q = QUESTIONS[this.qaIndex];
    const tile = document.createElement('div'); tile.className = 'qa-tile'; tile.dataset.qindex = this.qaIndex;
    tile.innerHTML = `<div class="qa-card"><h3>${escapeHtml(q.text)}</h3><div class="qa-options">${q.options.map((opt,i)=>`<button class="option-btn" data-opt="${i}">${escapeHtml(opt)}</button>`).join('')}</div></div>`;
    if (!this.qaStageInner){ console.error("qaStageInner not found"); return; }
    this.qaStageInner.appendChild(tile);
    requestAnimationFrame(()=>requestAnimationFrame(()=>tile.classList.add('enter')));
    tile.querySelectorAll('.option-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        tile.querySelectorAll('.option-btn').forEach(b=>b.disabled=true);
        const idx = parseInt(btn.dataset.opt,10); const pid = this.myPlayerKey || this.playerName || `p_${Date.now()}`;
        if (this.db && this.roomCode) { this.db.ref(`rooms/${this.roomCode}/answers/${pid}/${this.qaIndex}`).set({ optionIndex: idx, optionText: q.options[idx], ts: Date.now() }).catch(e=>console.warn('save answer failed', e)); }
        tile.classList.remove('enter'); tile.classList.add('exit');
        const onEnd = ev => { if (ev.target !== tile) return; tile.removeEventListener('transitionend', onEnd); if (tile.parentNode) tile.parentNode.removeChild(tile); this.qaIndex += 1; this.renderNextQuestion(); };
        tile.addEventListener('transitionend', onEnd);
      });
    });
  }

  /* Pre-guess waiting UI */
  showPreGuessWaitingRoom(){
    const guessWaiting = document.getElementById('guessWaitingRoom'); if (guessWaiting) guessWaiting.classList.remove('hidden');
    const rcd = document.getElementById('roomCodeDisplay_guess'); if (rcd) rcd.textContent = this.roomCode || '';
    if (this.db && this.roomCode) {
      this.db.ref(`rooms/${this.roomCode}/players`).on('value', ()=>this.renderPreGuessStatuses());
      this.db.ref(`rooms/${this.roomCode}/qaCompletions`).on('value', ()=>this.renderPreGuessStatuses());
      this.db.ref(`rooms/${this.roomCode}/guessCompletions`).on('value', ()=>this.renderPreGuessStatuses());
    }
    this.renderPreGuessStatuses();
    this.updateHostRevealButton(); 
  }

  renderPreGuessStatuses(){
    if (!this.db || !this.roomCode) return;
    const list = document.getElementById('guessPlayerStatusList'); if (!list) return;
    list.innerHTML = '';
    Promise.all([
      this.db.ref(`rooms/${this.roomCode}/players`).once('value'),
      this.db.ref(`rooms/${this.roomCode}/qaCompletions`).once('value'),
      this.db.ref(`rooms/${this.roomCode}/guessCompletions`).once('value')
    ]).then(([psnap, qcsnap, gcsnap])=>{
      const players = psnap.val() || {}; const qcs = qcsnap.val() || {}; const gcs = gcsnap.val() || {};
      const keys = Object.keys(players);
      keys.forEach(k => {
        const li = document.createElement('li');
        const name = players[k].name || k;
        const statusParts = [];
        statusParts.push(qcs && qcs[k] ? 'QA done' : 'QA pending');
        statusParts.push(gcs && gcs[k] ? 'Guess done' : 'Guess pending');
        li.textContent = `${name} — ${statusParts.join(' | ')}`;
        list.appendChild(li);
      });
      // host enable reveal button when all players have guessCompletions
      if (this.isHost) {
        const revealBtn = document.getElementById('hostRevealBtn');
        const expected = this.expectedPlayers || keys.length;
        const doneCount = Object.keys(gcs || {}).length;
        if (revealBtn) { if (expected > 0 && doneCount >= expected) revealBtn.classList.remove('hidden'); else revealBtn.classList.add('hidden'); }
      }
    }).catch(e=>console.warn('renderPreGuessStatuses failed',e));
  }

  startGuessingForMe(){
    if (!this.db || !this.roomCode || !this.myPlayerKey) return;
    if (this.isGuessingActive) return;
    this.db.ref(`rooms/${this.roomCode}/players`).once('value').then(psnap=>{
      const playersObj = psnap.val() || {}; const allKeys = Object.keys(playersObj);
      this.guessTargets = allKeys.filter(k => k !== this.myPlayerKey);
      this.currentTargetIdx = 0; this.currentTargetQIndex = 0;
      this.db.ref(`rooms/${this.roomCode}/scores/${this.myPlayerKey}`).transaction(curr=>curr||0);
      const guessPhase = document.getElementById('guessPhase'); if (guessPhase) guessPhase.classList.remove('hidden');
      const guessWaiting = document.getElementById('guessWaitingRoom'); if (guessWaiting) guessWaiting.classList.add('hidden');
      this.isGuessingActive = true;
      this.renderNextGuessTile();
    }).catch(e=>console.error("startGuessingForMe failed", e));
  }

  renderNextGuessTile(){
    if (!this.isGuessingActive) return;
    if (!this.guessTargets || this.currentTargetIdx >= this.guessTargets.length) { this.showDoneGuessButton(); return; }
    const targetKey = this.guessTargets[this.currentTargetIdx];
    const qIndex = this.currentTargetQIndex; const question = QUESTIONS[qIndex];
    this.db.ref(`rooms/${this.roomCode}/answers/${targetKey}/${qIndex}`).once('value').then(ansSnap=>{
      const realAnswer = ansSnap.val();
      const stage = document.getElementById('guessCard'); if (!stage) return;
      stage.innerHTML = '<div class="qa-stage" id="guessQAStage"></div>'; const stageInner = document.getElementById('guessQAStage');
      const tile = document.createElement('div'); tile.className='qa-tile'; tile.dataset.qindex = qIndex; tile.dataset.targetKey = targetKey;
      const targetName = (this.playersCache && this.playersCache[targetKey] && this.playersCache[targetKey].name) ? this.playersCache[targetKey].name : 'Player';
      tile.innerHTML = `<div class="qa-card"><h4>Guess for ${escapeHtml(targetName)} — Q${qIndex+1}</h4><p>${escapeHtml(question.text)}</p><div class="qa-options">${question.options.map((opt,i)=>`<button class="option-btn" data-opt="${i}">${escapeHtml(opt)}</button>`).join('')}</div><div class="guess-feedback" style="margin-top:8px"></div></div>`;
      stageInner.appendChild(tile); requestAnimationFrame(()=>requestAnimationFrame(()=>tile.classList.add('enter')));
      tile.querySelectorAll('.option-btn').forEach(btn=>{
        btn.onclick=null;
        btn.addEventListener('click', ()=>{
          tile.querySelectorAll('.option-btn').forEach(b=>b.disabled=true);
          const guessedIndex = parseInt(btn.dataset.opt,10);
          const correct = !!realAnswer && (realAnswer.optionIndex === guessedIndex);
          const feedback = tile.querySelector('.guess-feedback'); feedback.innerHTML = correct ? '<span style="color:green">✓ Correct</span>' : '<span style="color:red">✕ Wrong</span>';
          this.db.ref(`rooms/${this.roomCode}/guesses/${this.myPlayerKey}/${targetKey}/${qIndex}`).set({ guessedIndex, correct, ts: Date.now() }).catch(()=>{});
          this.db.ref(`rooms/${this.roomCode}/scores/${this.myPlayerKey}`).transaction(curr => (curr||0) + (correct?1:-1));
          tile.classList.remove('enter'); tile.classList.add('exit');
          const onEnd = ()=>{ try{ tile.removeEventListener('transitionend', onEnd); }catch(e){} if (tile.parentNode) tile.parentNode.removeChild(tile); this.advanceGuessIndices(); this.renderNextGuessTile(); };
          tile.addEventListener('transitionend', onEnd, { once:true });
          setTimeout(()=>{ if (stage.contains(tile)) { try{ tile.removeEventListener('transitionend', onEnd); }catch(e){} if (tile.parentNode) tile.parentNode.removeChild(tile); this.advanceGuessIndices(); this.renderNextGuessTile(); } }, 220);
        });
      });
    }).catch(err=>{ console.error('fetch real answer error', err); this.advanceGuessIndices(); this.renderNextGuessTile(); });
  }

  advanceGuessIndices(){ this.currentTargetQIndex += 1; if (this.currentTargetQIndex >= QUESTIONS.length){ this.currentTargetQIndex = 0; this.currentTargetIdx += 1; } }

  showDoneGuessButton(){
    const btn = document.getElementById('doneGuessingBtn'); if (!btn) { console.warn('no done btn'); return; }
    btn.classList.remove('hidden'); btn.disabled = false; btn.onclick = null;
    btn.addEventListener('click', ()=>{
      btn.disabled = true; btn.classList.add('hidden'); this.isGuessingActive = false;
      const myKey = this.myPlayerKey;
      if (this.db && this.roomCode && myKey) this.db.ref(`rooms/${this.roomCode}/guessCompletions/${myKey}`).set(true).catch(e=>console.warn('set completion fail', e));
      this.showPostGuessWaitingUI();
    }, { once:true });
  }

  showPostGuessWaitingUI(){
    const guessPhase = document.getElementById('guessPhase'); if (guessPhase) guessPhase.classList.add('hidden');
    let post = document.getElementById('postGuessWaitingRoom'); if (!post){ post = document.getElementById('postGuessWaitingRoom'); }
    if (post) post.classList.remove('hidden');
    if (this.db && this.roomCode) { this.db.ref(`rooms/${this.roomCode}/guessCompletions`).on('value', ()=>this.renderPostGuessStatuses()); this.db.ref(`rooms/${this.roomCode}/players`).on('value', ()=>this.renderPostGuessStatuses()); }
    this.renderPostGuessStatuses();
    this.updateHostRevealButton(); 
  }

  renderPostGuessStatuses(){
    if (!this.db || !this.roomCode) return;
    const list = document.getElementById('postGuessStatusList'); if (!list) return;
    list.innerHTML = '';
    Promise.all([ this.db.ref(`rooms/${this.roomCode}/players`).once('value'), this.db.ref(`rooms/${this.roomCode}/guessCompletions`).once('value') ])
      .then(([psnap, csnap])=>{
        const players = psnap.val() || {}; const comps = csnap.val() || {};
        Object.keys(players).forEach(k=>{
          const li = document.createElement('li'); const name = players[k].name || k; const status = comps && comps[k] ? 'completed' : 'pending';
          li.textContent = `${name} — ${status}`; list.appendChild(li);
        });
        if (this.isHost) {
          const revealBtn = document.getElementById('hostRevealBtn');
          const expected = this.expectedPlayers || Object.keys(players).length;
          const doneCount = Object.keys(comps||{}).length;
          if (revealBtn) { if (expected>0 && doneCount >= expected) revealBtn.classList.remove('hidden'); else revealBtn.classList.add('hidden'); }
        }
      }).catch(e=>console.warn('renderPostGuessStatuses failed',e));
  }

  /* ===== Host reveal helper: enable reveal button when all players finished guessing ===== */
updateHostRevealButton() {
  // Only hosts care about this; quick no-op otherwise
  if (!this.isHost || !this.db || !this.roomCode) return;

  const revealBtn = document.getElementById('hostRevealBtn');
  if (!revealBtn) return;

  // Query authoritative counts from DB
  Promise.all([
    this.db.ref(`rooms/${this.roomCode}/players`).once('value'),
    this.db.ref(`rooms/${this.roomCode}/guessCompletions`).once('value')
  ]).then(([psnap, csnap]) => {
    const players = psnap.val() || {};
    const comps = csnap.val() || {};
    const playersCount = Object.keys(players).length;
    const doneCount = Object.keys(comps).length;

    // Show the button only when everyone has completed guessing
    if (playersCount > 0 && doneCount >= playersCount) {
      revealBtn.classList.remove('hidden');
      revealBtn.disabled = false;
      // Ensure it is wired (idempotent)
      if (!revealBtn._wiredToHostReveal) {
        revealBtn._wiredToHostReveal = true;
        revealBtn.onclick = null;
        revealBtn.addEventListener('click', () => {
          // double-check before firing
          revealBtn.disabled = true;
          this.hostRevealScores();
        });
      }
    } else {
      revealBtn.classList.add('hidden');
      revealBtn.disabled = true;
    }
  }).catch(e => {
    console.warn('updateHostRevealButton failed', e);
  });
}

   // Host computes scores and sets phase='reveal' (manual only)
  hostRevealScores(){
    if (!this.isHost || !this.db || !this.roomCode) return;
    const roomRef = this.db.ref(`rooms/${this.roomCode}`);
    Promise.all([ roomRef.child('scores').once('value'), roomRef.child('players').once('value') ])
      .then(([ssnap, psnap])=>{
        const scores = ssnap.val() || {}; const players = psnap.val() || {};
        const items = Object.keys(players).map(key=>({ key, name:(players[key]&&players[key].name)?players[key].name:key, score: (scores && typeof scores[key] === 'number') ? scores[key] : ((scores && scores[key])?scores[key]:0) }));
        items.sort((a,b)=> b.score - a.score);
        const top = items.length ? items[0].score : 0; const winners = items.filter(it => it.score === top).map(it=>it.key);
        return roomRef.update({ scoresSnapshot: items, winner: winners, phase: 'reveal' }).then(()=>console.log('scores snapshot + reveal'));
      }).catch(e=>console.error('hostRevealScores failed', e));
  }
 
  listenForPhaseChanges(){
    if (!this.db || !this.roomCode) return;
    const roomRef = this.db.ref(`rooms/${this.roomCode}`);
    try{ roomRef.child('phase').off(); }catch(e){}
    roomRef.child('phase').on('value', snap=>{
      const phase = snap.val(); console.log('phase ->', phase);
      if (phase === 'reveal') this.showRevealUI();
    });
  }

  showRevealUI(){
    if (!this.db || !this.roomCode) return;
    const guessPhase = document.getElementById('guessPhase'); if (guessPhase) guessPhase.classList.add('hidden');
    const guessWaiting = document.getElementById('guessWaitingRoom'); if (guessWaiting) guessWaiting.classList.add('hidden');
    const post = document.getElementById('postGuessWaitingRoom'); if (post) post.classList.add('hidden');
    let board = document.getElementById('revealBoard'); if (!board){ board = document.createElement('section'); board.id='revealBoard'; board.className='card'; document.body.appendChild(board); }
    board.classList.remove('hidden'); board.innerHTML = '<h3>Scores</h3><div id="scoreList">Loading…</div>';
    this.db.ref(`rooms/${this.roomCode}/scoresSnapshot`).once('value').then(ssnap=>{
      const items = ssnap.val() || [];
      return Promise.all([Promise.resolve(items), this.db.ref(`rooms/${this.roomCode}/winner`).once('value')]);
    }).then(([items, wsnap])=>{
      const winners = (wsnap && wsnap.val()) || [];
      const list = document.getElementById('scoreList'); if (!list) return;
      if (!items || items.length === 0) { list.innerHTML = '<p>No scores found.</p>'; return; }
      const ol = document.createElement('ol');
      items.forEach(it => { const li = document.createElement('li'); const isWinner = winners && winners.indexOf(it.key) !== -1; li.innerHTML = `${escapeHtml(it.name)} — ${it.score} ${isWinner?'<strong>(Winner)</strong>':''}`; ol.appendChild(li); });
      list.innerHTML = ''; list.appendChild(ol);
    }).catch(e=>console.warn('showRevealUI failed', e));
  }
}

// instantiate
let gameInstance = null;
document.addEventListener('DOMContentLoaded', ()=>{
  if (!window.db) console.warn('window.db falsy; ensure firebase-config.js sets window.db = firebase.database()');
  gameInstance = new MultiplayerIfIWereGame();
});

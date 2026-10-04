const cursor = document.querySelector(".cursor");
const scoreEl = document.querySelector(".score span");
const countdown = document.querySelector(".countdown span");
const holes = [...document.querySelectorAll(".hole")];
const pauseBtn = document.querySelector(".pauseBtn");
let score = 0;
const sound = new Audio("./assets/smash.mp3");
let timeLeft = 30;
let isPaused = false;

// Progressive Levels & Game State
let currentLevel = 1;
let highestLevel = 1;
let whacksInCurrentLevel = 0;
const WHACKS_PER_LEVEL = 10;
const activeMoles = new Map(); // hole -> { timeout, isGolden, img }
let levelUpTimer = null;

// Web Audio API synthesizer for arcade sound effects
let audioCtx = null;
function getAudioContext() {
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

function playLevelUpChime() {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now + idx * 0.08);
      gain.gain.setValueAtTime(0.2, now + idx * 0.08);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.08 + 0.25);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + idx * 0.08);
      osc.stop(now + idx * 0.08 + 0.25);
    });
  } catch (e) {}
}

function playGoldenHitChime() {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const notes = [987.77, 1318.51]; // B5, E6
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + idx * 0.07);
      gain.gain.setValueAtTime(0.18, now + idx * 0.07);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.07 + 0.2);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + idx * 0.07);
      osc.stop(now + idx * 0.07 + 0.2);
    });
  } catch (e) {}
}

function playBuzzerSound() {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(160, now);
    osc.frequency.linearRampToValueAtTime(95, now + 0.22);
    gain.gain.setValueAtTime(0.25, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.22);
  } catch (e) {}
}

// Multi-Language Support (IT, EN, FR, DE)
const TRANSLATIONS = {
  IT: {
    start: "Gioca",
    leaderboard: "Classifica",
    back: "Indietro",
    scoreLabel: "Punti",
    levelLabel: "Livello",
    timeLabel: "Tempo",
    pause: "Pausa",
    resume: "Riprendi",
    progressText: (cur, max, nextLv) => `${cur}/${max} talpe al Livello ${nextLv}`,
    levelUpTitle: "LEVEL UP!",
    levelUpSub: (lv, spd) => `Livello ${lv} • Velocità ${spd}x!`,
    levelUpBonus: (sec) => `+${sec}s Bonus Tempo! ⏱️`,
    gameOverTitle: "Partita Terminata!",
    finalScoreLabel: "Punteggio Finale:",
    highestLevelReached: (lv) => `🏆 Livello Raggiunto: Livello ${lv}`,
    restart: "Ricomincia",
    top10Title: "🎉 Top 10 Globale! Inserisci il tuo nome:",
    namePlaceholder: "Il tuo nome",
    submitBtn: "Invia",
    globalLeaderboardTitle: "🌍 Classifica Globale (Top 10)",
    rankCol: "Pos",
    nameCol: "Nome",
    scoreCol: "Punti",
    levelCol: "Livello",
    dateCol: "Data",
    offlineNotice: (n) => `⏳ ${n} punteggio/i in attesa offline — sincronizzazione automatica alla connessione.`,
    adBadge: "Sponsor / Annuncio",
    adEndGameTitle: "🎉 Partita Terminata!",
    adDesc: (pts) => `Visualizza questo breve messaggio pubblicitario per accedere alla classifica e salvare il tuo punteggio di <strong>${pts} punti</strong>.`,
    adWaitText: (s) => `Attendi ${s}s per visualizzare la classifica...`,
    adContinueText: "Continua alla Classifica ➡️"
  },
  EN: {
    start: "Start",
    leaderboard: "Leaderboard",
    back: "Back",
    scoreLabel: "Score",
    levelLabel: "Level",
    timeLabel: "Time",
    pause: "Pause",
    resume: "Resume",
    progressText: (cur, max, nextLv) => `${cur}/${max} moles to Level ${nextLv}`,
    levelUpTitle: "LEVEL UP!",
    levelUpSub: (lv, spd) => `Level ${lv} • Speed ${spd}x!`,
    levelUpBonus: (sec) => `+${sec}s Time Bonus! ⏱️`,
    gameOverTitle: "Game Over!",
    finalScoreLabel: "Final Score:",
    highestLevelReached: (lv) => `🏆 Highest Level Reached: Level ${lv}`,
    restart: "Restart",
    top10Title: "🎉 Global Top 10! Enter your name:",
    namePlaceholder: "Your name",
    submitBtn: "Submit",
    globalLeaderboardTitle: "🌍 Global Leaderboard (Top 10)",
    rankCol: "Rank",
    nameCol: "Name",
    scoreCol: "Score",
    levelCol: "Level",
    dateCol: "Date",
    offlineNotice: (n) => `⏳ ${n} score(s) queued offline — will sync once connected.`,
    adBadge: "Sponsor / Ad",
    adEndGameTitle: "🎉 Game Finished!",
    adDesc: (pts) => `View this short message to access the leaderboard and save your score of <strong>${pts} points</strong>.`,
    adWaitText: (s) => `Please wait ${s}s to view the leaderboard...`,
    adContinueText: "Continue to Leaderboard ➡️"
  },
  FR: {
    start: "Jouer",
    leaderboard: "Classement",
    back: "Retour",
    scoreLabel: "Score",
    levelLabel: "Niveau",
    timeLabel: "Temps",
    pause: "Pause",
    resume: "Reprendre",
    progressText: (cur, max, nextLv) => `${cur}/${max} taupes au Niveau ${nextLv}`,
    levelUpTitle: "NIVEAU SUPÉRIEUR!",
    levelUpSub: (lv, spd) => `Niveau ${lv} • Vitesse ${spd}x!`,
    levelUpBonus: (sec) => `+${sec}s Bonus de Temps! ⏱️`,
    gameOverTitle: "Partie Terminée!",
    finalScoreLabel: "Score Final:",
    highestLevelReached: (lv) => `🏆 Niveau Atteint: Niveau ${lv}`,
    restart: "Recommencer",
    top10Title: "🎉 Top 10 Mondial! Entrez votre nom:",
    namePlaceholder: "Votre nom",
    submitBtn: "Envoyer",
    globalLeaderboardTitle: "🌍 Classement Mondial (Top 10)",
    rankCol: "Rang",
    nameCol: "Nom",
    scoreCol: "Score",
    levelCol: "Niveau",
    dateCol: "Date",
    offlineNotice: (n) => `⏳ ${n} score(s) en attente hors ligne — synchronisation à la connexion.`,
    adBadge: "Sponsor / Annonce",
    adEndGameTitle: "🎉 Partie Terminée!",
    adDesc: (pts) => `Regardez ce court message pour accéder au classement et enregistrer vos <strong>${pts} points</strong>.`,
    adWaitText: (s) => `Attendez ${s}s pour voir le classement...`,
    adContinueText: "Continuer vers le Classement ➡️"
  },
  DE: {
    start: "Starten",
    leaderboard: "Bestenliste",
    back: "Zurück",
    scoreLabel: "Punkte",
    levelLabel: "Level",
    timeLabel: "Zeit",
    pause: "Pause",
    resume: "Fortsetzen",
    progressText: (cur, max, nextLv) => `${cur}/${max} Maulwürfe bis Level ${nextLv}`,
    levelUpTitle: "LEVEL UP!",
    levelUpSub: (lv, spd) => `Level ${lv} • Tempo ${spd}x!`,
    levelUpBonus: (sec) => `+${sec}s Zeitbonus! ⏱️`,
    gameOverTitle: "Spiel Vorbei!",
    finalScoreLabel: "Endstand:",
    highestLevelReached: (lv) => `🏆 Erreichtes Level: Level ${lv}`,
    restart: "Neustart",
    top10Title: "🎉 Globale Top 10! Gib deinen Namen ein:",
    namePlaceholder: "Dein Name",
    submitBtn: "Senden",
    globalLeaderboardTitle: "🌍 Globale Bestenliste (Top 10)",
    rankCol: "Rang",
    nameCol: "Name",
    scoreCol: "Punkte",
    levelCol: "Level",
    dateCol: "Datum",
    offlineNotice: (n) => `⏳ ${n} Punktestand(e) offline in der Warteschlange — Synchronisierung bei Verbindung.`,
    adBadge: "Sponsor / Anzeige",
    adEndGameTitle: "🎉 Spiel Beendet!",
    adDesc: (pts) => `Sieh dir diese kurze Anzeige an, um zur Bestenliste zu gelangen und deine <strong>${pts} Punkte</strong> zu speichern.`,
    adWaitText: (s) => `Warte ${s}s, um die Bestenliste zu sehen...`,
    adContinueText: "Weiter zur Bestenliste ➡️"
  }
};

let currentLang = localStorage.getItem('whackAMoleLang') || 'IT';
function t() {
  return TRANSLATIONS[currentLang] || TRANSLATIONS['IT'];
}

function setLanguage(lang) {
  if (!TRANSLATIONS[lang]) return;
  currentLang = lang;
  localStorage.setItem('whackAMoleLang', lang);
  applyTranslations();
}

let cachedLeaderboard = null;
let currentAdRemainingSeconds = 5;
let currentAdScoreValue = 0;

function applyTranslations() {
  const tr = t();
  document.documentElement.lang = currentLang.toLowerCase();

  // Active button highlight
  document.querySelectorAll('.lang-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.lang === currentLang);
  });

  // Buttons
  if (typeof startBtn !== 'undefined' && startBtn) startBtn.textContent = tr.start;
  if (typeof leaderboardBtn !== 'undefined' && leaderboardBtn) leaderboardBtn.textContent = tr.leaderboard;
  if (typeof backBtn !== 'undefined' && backBtn) backBtn.textContent = tr.back;
  if (typeof pauseBtn !== 'undefined' && pauseBtn) pauseBtn.textContent = isPaused ? tr.resume : tr.pause;

  const restartBtn = document.querySelector('.restartBtn');
  if (restartBtn) restartBtn.textContent = tr.restart;

  // HUD Labels
  const scoreLbl = document.querySelector('.stat-score-label');
  if (scoreLbl) scoreLbl.textContent = tr.scoreLabel;
  const levelLbl = document.querySelector('.stat-level-label');
  if (levelLbl) levelLbl.textContent = tr.levelLabel;
  const timeLbl = document.querySelector('.stat-time-label');
  if (timeLbl) timeLbl.textContent = tr.timeLabel;

  // Level Up Toast Title
  const levelUpTitle = document.getElementById('levelUpTitle');
  if (levelUpTitle) levelUpTitle.textContent = tr.levelUpTitle;

  // Progress text
  updateLevelUI();

  // Update Top 10 Name Input screen if currently visible
  const nameInputEl = document.querySelector('.name-input');
  if (nameInputEl) {
    const h2 = nameInputEl.querySelector('h2');
    if (h2) h2.textContent = tr.top10Title;
    const input = nameInputEl.querySelector('input');
    if (input) input.placeholder = tr.namePlaceholder;
    const submitBtn = nameInputEl.querySelector('.submitBtn');
    if (submitBtn) submitBtn.textContent = tr.submitBtn;
  }

  // Update Final Score screen if currently visible
  const finalScoreEl = document.querySelector('.finalScore');
  if (finalScoreEl && finalScoreEl.style.display !== 'none' && finalScoreEl.children.length > 0) {
    const h3 = finalScoreEl.querySelector('h3');
    if (h3) h3.textContent = tr.gameOverTitle;
    const h1 = finalScoreEl.querySelector('h1');
    if (h1) h1.textContent = `${score} ${tr.scoreLabel}`;
    const badge = finalScoreEl.querySelector('.final-level-badge');
    if (badge) badge.textContent = tr.highestLevelReached(highestLevel);
  }

  // Update Ad Interstitial if currently visible
  const adEl = document.querySelector('.ad-interstitial-container');
  if (adEl) {
    const badge = adEl.querySelector('.ad-notice-badge');
    if (badge) badge.textContent = tr.adBadge;
    const title = adEl.querySelector('.ad-notice-title');
    if (title) title.textContent = tr.adEndGameTitle;
    const desc = adEl.querySelector('.ad-notice-desc');
    if (desc) desc.innerHTML = tr.adDesc(currentAdScoreValue || score);
    const continueBtn = adEl.querySelector('#adContinueBtn');
    if (continueBtn) {
      if (continueBtn.disabled) {
        continueBtn.textContent = tr.adWaitText(currentAdRemainingSeconds || 5);
      } else {
        continueBtn.textContent = tr.adContinueText;
      }
    }
  }

  // Update Leaderboard if currently visible (either on leaderboardScreen or on game screen)
  const existingLeaderboard = document.querySelector('.leaderboard');
  if (existingLeaderboard && cachedLeaderboard) {
    showLeaderboard(cachedLeaderboard);
  } else if (typeof leaderboardScreen !== 'undefined' && leaderboardScreen && !leaderboardScreen.classList.contains('hidden')) {
    getLeaderboard().then(showLeaderboard);
  }
}

// Google AdSense config
const ADSENSE_CONFIG = {
  client: "ca-pub-5034717836472110", // ID Editore AdSense configurato
  slot: "1234567890",                // Sostituisci con il tuo Ad Slot ID specifico appena creato nel pannello AdSense
  interstitialWaitSeconds: 5          // Secondi di attesa prima di poter procedere
};

// Firebase config - REPLACE WITH YOUR OWN CONFIG FROM FIREBASE CONSOLE
const FIREBASE_CONFIG = {
  apiKey: "AIzaSyCXisNORHqPej7rAaNM1DfBMzfxDnC-lt8",
  authDomain: "whack-a-mole-97aae.firebaseapp.com",
  databaseURL: "https://whack-a-mole-97aae-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "whack-a-mole-97aae",
  storageBucket: "whack-a-mole-97aae.firebasestorage.app",
  messagingSenderId: "478528765923",
  appId: "1:478528765923:web:39cdeb3a9c7f0018a4ead6"
};

// Initialize Firebase
let db = null;
let firebaseReady = false;

function getPendingScores() {
  try {
    const raw = localStorage.getItem('whackAMolePendingSync');
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

function savePendingScores(scores) {
  try {
    localStorage.setItem('whackAMolePendingSync', JSON.stringify(scores));
  } catch (e) {
    console.error('Failed to save pending scores to localStorage', e);
  }
}

let isSyncing = false;
async function syncPendingScores() {
  if (!firebaseReady || !db || isSyncing) return;
  const pending = getPendingScores();
  if (pending.length === 0) return;

  isSyncing = true;
  console.log(`Syncing ${pending.length} pending offline score(s) to Firebase...`);
  const remaining = [];
  for (const item of pending) {
    try {
      const { tempId, ...entryToSave } = item;
      await db.ref('leaderboard').push(entryToSave);
      console.log('Successfully synced score to Firebase:', entryToSave);
    } catch (e) {
      console.warn('Sync failed for item, keeping in queue:', item, e);
      remaining.push(item);
    }
  }
  savePendingScores(remaining);
  isSyncing = false;

  if (remaining.length < pending.length) {
    try {
      const snapshot = await db.ref('leaderboard').orderByChild('score').once('value');
      const data = snapshot.val() || {};
      const entries = Object.entries(data).sort((a, b) => b[1].score - a[1].score);
      if (entries.length > 100) {
        for (const [key] of entries.slice(100)) {
          await db.ref('leaderboard').child(key).remove();
        }
      }
    } catch (e) {
      console.warn('Trim leaderboard error:', e);
    }
  }
}

function initFirebase() {
  if (typeof firebase !== 'undefined') {
    try {
      firebase.initializeApp(FIREBASE_CONFIG);
      db = firebase.database();
      firebaseReady = true;
      console.log('Firebase initialized');

      // Listen for connection state changes to automatically sync pending offline scores
      const connectedRef = db.ref('.info/connected');
      connectedRef.on('value', (snap) => {
        if (snap.val() === true) {
          console.log('Firebase connected: syncing pending offline scores...');
          syncPendingScores();
        }
      });
    } catch (e) {
      console.warn('Firebase init error, using localStorage fallback:', e);
      firebaseReady = false;
    }
  } else {
    console.warn('Firebase SDK not loaded, using localStorage fallback');
    firebaseReady = false;
  }
}

window.addEventListener('online', () => {
  if (firebaseReady && db) {
    syncPendingScores();
  }
});

// Leaderboard functions
async function getLeaderboard() {
  if (firebaseReady && db) {
    try {
      // Sync any queued offline scores first
      await syncPendingScores();

      const fetchPromise = db.ref('leaderboard').orderByChild('score').limitToLast(10).once('value');
      const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('Firebase timeout')), 2500));
      const snapshot = await Promise.race([fetchPromise, timeoutPromise]);
      const data = snapshot.val() || {};
      const leaderboard = Object.values(data).sort((a, b) => b.score - a.score);
      localStorage.setItem('whackAMoleLeaderboard', JSON.stringify(leaderboard));
      return leaderboard;
    } catch (e) {
      console.warn('Firebase read error or timeout, falling back to localStorage:', e);
    }
  }
  // Fallback to localStorage combined with pending un-synced scores
  const localLeaderboard = getLocalLeaderboard();
  const pending = getPendingScores();
  const combined = [...localLeaderboard];
  for (const p of pending) {
    if (!combined.some(e => e.name === p.name && e.score === p.score && e.date === p.date)) {
      combined.push({ name: p.name, score: p.score, date: p.date });
    }
  }
  combined.sort((a, b) => b.score - a.score);
  return combined.slice(0, 10);
}

async function saveToLeaderboard(name, score, level) {
  const date = new Date();
  const europeanDate = `${date.getDate().toString().padStart(2, '0')}/${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getFullYear()}`;
  const entry = { name, score, level: level || 1, date: europeanDate };

  let savedToFirebase = false;

  if (firebaseReady && db) {
    try {
      // Push new entry with timeout
      const pushPromise = db.ref('leaderboard').push(entry);
      const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('Firebase timeout')), 2500));
      await Promise.race([pushPromise, timeoutPromise]);
      savedToFirebase = true;

      // Sync any pending items
      syncPendingScores();

      const snapshot = await db.ref('leaderboard').orderByChild('score').once('value');
      const data = snapshot.val() || {};
      const entries = Object.entries(data).sort((a, b) => b[1].score - a[1].score);
      if (entries.length > 100) {
        const toRemove = entries.slice(100);
        for (const [key] of toRemove) {
          await db.ref('leaderboard').child(key).remove();
        }
      }
    } catch (e) {
      console.warn('Firebase write failed, queueing for sync when reachable:', e);
    }
  }

  // If not saved to Firebase directly, queue for automatic sync when reachable
  if (!savedToFirebase) {
    const pending = getPendingScores();
    pending.push({ ...entry, tempId: Date.now() + '-' + Math.random().toString(36).substring(2, 7) });
    savePendingScores(pending);
  }

  // Also maintain local leaderboard cache
  const localLeaderboard = getLocalLeaderboard();
  localLeaderboard.push(entry);
  localLeaderboard.sort((a, b) => b.score - a.score);
  localStorage.setItem('whackAMoleLeaderboard', JSON.stringify(localLeaderboard.slice(0, 10)));
  return entry;
}

function getLocalLeaderboard() {
  const leaderboard = localStorage.getItem('whackAMoleLeaderboard');
  return leaderboard ? JSON.parse(leaderboard) : [];
}

async function isTopTen(score) {
  const leaderboard = await getLeaderboard();
  if (leaderboard.length < 10) return true;
  return score > leaderboard[9].score;
}

async function showLeaderboard(leaderboard) {
  cachedLeaderboard = leaderboard;
  // Remove existing leaderboard if any
  const existingLeaderboard = document.querySelector('.leaderboard');
  if (existingLeaderboard) existingLeaderboard.remove();

  const tr = t();
  const leaderboardDiv = document.createElement('div');
  leaderboardDiv.classList.add('leaderboard');

  const title = document.createElement('h2');
  title.textContent = tr.globalLeaderboardTitle;
  leaderboardDiv.appendChild(title);

  const pendingScores = getPendingScores();
  if (pendingScores.length > 0) {
    const notice = document.createElement('p');
    notice.style.fontSize = '0.85rem';
    notice.style.color = '#ffd700';
    notice.style.margin = '4px 0 10px 0';
    notice.style.fontWeight = 'bold';
    notice.textContent = tr.offlineNotice(pendingScores.length);
    leaderboardDiv.appendChild(notice);
  }

  const tableWrapper = document.createElement('div');
  tableWrapper.classList.add('leaderboard-table-wrapper');

  const table = document.createElement('table');
  table.innerHTML = `
    <thead>
      <tr>
        <th>${tr.rankCol}</th>
        <th>${tr.nameCol}</th>
        <th>${tr.scoreCol}</th>
        <th>${tr.levelCol}</th>
        <th>${tr.dateCol}</th>
      </tr>
    </thead>
    <tbody>
      ${leaderboard.slice(0, 10).map((entry, index) => `
        <tr>
          <td>${index + 1}</td>
          <td>${entry.name}</td>
          <td>${entry.score}</td>
          <td><span class="level-pill">Lv ${entry.level || 1}</span></td>
          <td>${entry.date}</td>
        </tr>
      `).join('')}
    </tbody>
  `;

  tableWrapper.appendChild(table);
  leaderboardDiv.appendChild(tableWrapper);

  // Append to leaderboardContainer if on leaderboard screen, otherwise to body
  if (leaderboardScreen && leaderboardScreen.style.display !== 'none' && !leaderboardScreen.classList.contains('hidden')) {
    leaderboardContainer.appendChild(leaderboardDiv);
  } else {
    document.body.appendChild(leaderboardDiv);
  }
}

/**
 * Mostra l'annuncio e il messaggio informativo di fine partita prima di passare
 * all'inserimento del nome o alla visualizzazione della classifica.
 */
function showEndGameAd(finalScoreValue, onAdComplete) {
  currentAdScoreValue = finalScoreValue;
  currentAdRemainingSeconds = ADSENSE_CONFIG.interstitialWaitSeconds;

  // Rimuovi eventuali annunci precedenti
  const existingAd = document.querySelector('.ad-interstitial-container');
  if (existingAd) existingAd.remove();

  const tr = t();
  const adContainer = document.createElement('div');
  adContainer.classList.add('ad-interstitial-container');

  adContainer.innerHTML = `
    <div class="ad-notice-header">
      <span class="ad-notice-badge">${tr.adBadge}</span>
      <h2 class="ad-notice-title">${tr.adEndGameTitle}</h2>
      <p class="ad-notice-desc">
        ${tr.adDesc(finalScoreValue)}
      </p>
    </div>
    <div class="ad-box-wrapper">
      <!-- Google AdSense Interstitial / End-Game Unit -->
      <ins class="adsbygoogle"
           style="display:block; width:100%; min-height:180px;"
           data-ad-client="${ADSENSE_CONFIG.client}"
           data-ad-slot="${ADSENSE_CONFIG.slot}"
           data-ad-format="auto"
           data-full-width-responsive="true"></ins>
      <div class="ad-placeholder-preview">
        <span class="ad-placeholder-badge">Google AdSense</span>
        <span>Spazio Pubblicitario Interstitial</span>
        <span class="ad-placeholder-id">${ADSENSE_CONFIG.client}</span>
      </div>
    </div>
    <button class="ad-continue-btn" disabled id="adContinueBtn">
      ${tr.adWaitText(ADSENSE_CONFIG.interstitialWaitSeconds)}
    </button>
  `;

  document.body.appendChild(adContainer);

  // Invia richiesta ad AdSense
  try {
    (window.adsbygoogle = window.adsbygoogle || []).push({});
  } catch (err) {
    console.log('AdSense init error:', err);
  }

  const continueBtn = adContainer.querySelector('#adContinueBtn');
  let remainingSeconds = ADSENSE_CONFIG.interstitialWaitSeconds;
  let countdownTimer = null;

  const proceed = () => {
    if (countdownTimer) clearInterval(countdownTimer);
    adContainer.remove();
    if (typeof onAdComplete === 'function') {
      onAdComplete();
    }
  };

  continueBtn.addEventListener('click', () => {
    if (!continueBtn.disabled) {
      proceed();
    }
  });

  countdownTimer = setInterval(() => {
    remainingSeconds--;
    currentAdRemainingSeconds = remainingSeconds;
    if (remainingSeconds > 0) {
      continueBtn.textContent = t().adWaitText(remainingSeconds);
    } else {
      clearInterval(countdownTimer);
      countdownTimer = null;
      continueBtn.disabled = false;
      continueBtn.textContent = t().adContinueText;
    }
  }, 1000);
}

async function showNameInput() {
  const tr = t();
  const nameInputDiv = document.createElement('div');
  nameInputDiv.classList.add('name-input');

  const title = document.createElement('h2');
  title.textContent = tr.top10Title;

  const input = document.createElement('input');
  input.type = 'text';
  input.placeholder = tr.namePlaceholder;
  input.maxLength = 20;

  const submitBtn = document.createElement('button');
  submitBtn.textContent = tr.submitBtn;
  submitBtn.classList.add('submitBtn');

  submitBtn.addEventListener('click', async () => {
    const name = input.value.trim() || 'Anonymous';
    await saveToLeaderboard(name, score, highestLevel);
    nameInputDiv.remove();
    document.querySelector('.finalScore').style.display = 'none';
    const leaderboard = await getLeaderboard();
    showLeaderboard(leaderboard);
    document.querySelector('.restartBtn').style.display = 'block';
  });

  input.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      submitBtn.click();
    }
  });

  nameInputDiv.appendChild(title);
  nameInputDiv.appendChild(input);
  nameInputDiv.appendChild(submitBtn);
  document.body.appendChild(nameInputDiv);

  input.focus();
}

// Function to show touch effect (boom or missed)
function showTouchEffect(x, y, isHit) {
  const effect = document.createElement('div');
  effect.classList.add('touch-effect');
  effect.classList.add(isHit ? 'boom' : 'missed');
  effect.style.left = x + 'px';
  effect.style.top = y + 'px';
  document.body.appendChild(effect);

  // Remove the effect after animation completes
  setTimeout(() => {
    document.body.removeChild(effect);
  }, 600);
}

let interval = null;

function getLevelConfig(level) {
  // Tempo di permanenza della talpa: parte da 1350ms al Livello 1 e si riduce progressivamente fino a un limite di 450ms
  const duration = Math.max(450, Math.round(1350 - (level - 1) * 160));
  // Tempo in cui resta schiacciata prima di sparire
  const hitDelay = Math.max(180, Math.round(380 - (level - 1) * 35));
  // Punti per talpa normale (aumentano con il livello)
  const basePoints = 10 + (level - 1) * 5;
  // Probabilità di spawn talpa dorata (bonus 3x punti!)
  const goldenChance = Math.min(0.24, 0.08 + level * 0.03);
  // Probabilità di spawn talpa rossa (malus / pericolo!) - appare dal Livello 2 in poi
  let redChance = 0;
  if (level === 2) redChance = 0.16;
  else if (level === 3) redChance = 0.22;
  else if (level === 4) redChance = 0.26;
  else if (level >= 5) redChance = 0.30;
  const redPenalty = 10 + level * 5; // -20 al lv 2, -25 al lv 3, -30 al lv 4...

  // Probabilità di talpa multipla contemporanea
  let multiChance = 0;
  if (level === 2) multiChance = 0.15;
  else if (level === 3) multiChance = 0.30;
  else if (level === 4) multiChance = 0.45;
  else if (level >= 5) multiChance = 0.60;

  return { duration, hitDelay, basePoints, goldenChance, redChance, redPenalty, multiChance };
}

function updateLevelUI() {
  const tr = t();
  const levelDisplay = document.querySelector('.level-display');
  if (levelDisplay) levelDisplay.textContent = currentLevel;

  const progressFill = document.getElementById('levelProgressFill');
  const progressText = document.getElementById('levelProgressText');
  const percent = Math.min(100, Math.round((whacksInCurrentLevel / WHACKS_PER_LEVEL) * 100));

  if (progressFill) progressFill.style.width = `${percent}%`;
  if (progressText) {
    progressText.textContent = tr.progressText(whacksInCurrentLevel, WHACKS_PER_LEVEL, currentLevel + 1);
  }
}

function showLevelUpToast(level, bonusSecs) {
  const tr = t();
  const toast = document.getElementById('levelUpToast');
  const sub = document.getElementById('levelUpSub');
  const bonus = document.getElementById('levelUpBonus');
  if (!toast) return;

  if (sub) {
    const speedMultiplier = (1 + (level - 1) * 0.2).toFixed(1);
    sub.textContent = tr.levelUpSub(level, speedMultiplier);
  }
  if (bonus) {
    bonus.textContent = tr.levelUpBonus(bonusSecs);
  }

  toast.classList.remove('hidden');
  toast.style.animation = 'none';
  toast.offsetHeight; // trigger reflow
  toast.style.animation = null;

  if (levelUpTimer) clearTimeout(levelUpTimer);
  levelUpTimer = setTimeout(() => {
    toast.classList.add('hidden');
  }, 1800);
}

function checkLevelUp() {
  if (whacksInCurrentLevel >= WHACKS_PER_LEVEL) {
    currentLevel++;
    if (currentLevel > highestLevel) {
      highestLevel = currentLevel;
    }
    whacksInCurrentLevel = 0;

    // Bonus tempo abbinato al Level Up (+4 secondi)
    const timeBonus = 4;
    timeLeft = Math.min(99, timeLeft + timeBonus);
    countdown.textContent = timeLeft < 10 ? `0${timeLeft}` : timeLeft;

    updateLevelUI();
    showLevelUpToast(currentLevel, timeBonus);
    playLevelUpChime();
  } else {
    updateLevelUI();
  }
}

function showFloatingScore(x, y, text, isGolden, isPenalty) {
  const floater = document.createElement('div');
  floater.classList.add('floating-score');
  if (isGolden) floater.classList.add('golden');
  if (isPenalty) floater.classList.add('penalty');
  floater.textContent = text;
  floater.style.left = `${x}px`;
  floater.style.top = `${y}px`;
  document.body.appendChild(floater);

  setTimeout(() => {
    if (floater.parentNode) {
      floater.remove();
    }
  }, 750);
}

function clearAllMoles() {
  activeMoles.forEach((data, hole) => {
    if (data.timeout) clearTimeout(data.timeout);
    if (hole.contains(data.img)) {
      hole.removeChild(data.img);
    }
  });
  activeMoles.clear();
}

function spawnMole() {
  if (isPaused || timeLeft <= 0) return;

  const availableHoles = holes.filter(h => !h.querySelector('.mole'));
  if (availableHoles.length === 0) return;

  const config = getLevelConfig(currentLevel);
  const hole = availableHoles[Math.floor(Math.random() * availableHoles.length)];

  // Tipologia talpa: Rossa (malus), Gialla (bonus), oppure Normale
  let moleType = 'normal';
  const rand = Math.random();
  if (rand < config.redChance) {
    moleType = 'red';
  } else if (rand < config.redChance + config.goldenChance) {
    moleType = 'golden';
  }

  const img = document.createElement('img');
  img.classList.add('mole');
  if (moleType === 'golden') {
    img.classList.add('golden-mole');
  } else if (moleType === 'red') {
    img.classList.add('red-mole');
  }
  img.src = './assets/mole.png';

  let whacked = false;

  const handleMoleHit = (e) => {
    e.preventDefault();
    if (whacked || isPaused || timeLeft <= 0) return;
    whacked = true;

    const x = e.clientX || (e.touches ? e.touches[0].clientX : (e.changedTouches ? e.changedTouches[0].clientX : window.innerWidth / 2));
    const y = e.clientY || (e.touches ? e.touches[0].clientY : (e.changedTouches ? e.changedTouches[0].clientY : window.innerHeight / 2));

    if (moleType === 'red') {
      // PENALITÀ TALPA ROSSA: toglie punti!
      score = Math.max(0, score - config.redPenalty);
      scoreEl.textContent = score;

      playBuzzerSound();
      img.src = './assets/mole-whacked.png';
      showTouchEffect(x, y, false);
      showFloatingScore(x, y, `-${config.redPenalty} ⚠️`, false, true);
    } else {
      // TALPA NORMALE O GIALLA (BONUS)
      const earnedPoints = moleType === 'golden' ? config.basePoints * 3 : config.basePoints;
      score += earnedPoints;
      scoreEl.textContent = score;

      whacksInCurrentLevel++;

      if (moleType === 'golden') {
        playGoldenHitChime();
      } else {
        sound.currentTime = 0;
        sound.play().catch(() => {});
      }

      img.src = './assets/mole-whacked.png';
      showTouchEffect(x, y, true);
      showFloatingScore(x, y, `+${earnedPoints}${moleType === 'golden' ? ' ⭐' : ''}`, moleType === 'golden', false);

      checkLevelUp();
    }

    const data = activeMoles.get(hole);
    if (data && data.timeout) {
      clearTimeout(data.timeout);
      data.timeout = null;
    }

    setTimeout(() => {
      if (hole.contains(img)) {
        hole.removeChild(img);
      }
      activeMoles.delete(hole);
      if (timeLeft > 0 && !isPaused && activeMoles.size === 0) {
        runWave();
      }
    }, config.hitDelay);
  };

  img.addEventListener('click', handleMoleHit);
  img.addEventListener('touchstart', handleMoleHit, { passive: false });

  hole.appendChild(img);

  const moleData = {
    img,
    moleType,
    whacked: false,
    timeout: setTimeout(() => {
      if (!whacked && hole.contains(img)) {
        hole.removeChild(img);
      }
      activeMoles.delete(hole);
      if (timeLeft > 0 && !isPaused && activeMoles.size === 0) {
        runWave();
      }
    }, config.duration)
  };

  activeMoles.set(hole, moleData);
}

function runWave() {
  if (isPaused || timeLeft <= 0) return;
  const config = getLevelConfig(currentLevel);

  spawnMole();

  if (Math.random() < config.multiChance && holes.filter(h => !h.querySelector('.mole')).length > 0) {
    setTimeout(() => {
      if (!isPaused && timeLeft > 0) {
        spawnMole();
      }
    }, 120);
  }
}

// Pause/Resume functionality
pauseBtn.addEventListener("click", () => {
  isPaused = !isPaused;
  const tr = t();
  pauseBtn.textContent = isPaused ? tr.resume : tr.pause;

  if (isPaused) {
    activeMoles.forEach((data) => {
      if (data.timeout) {
        clearTimeout(data.timeout);
        data.timeout = null;
      }
    });
  } else if (timeLeft > 0) {
    if (activeMoles.size === 0) {
      runWave();
    } else {
      const config = getLevelConfig(currentLevel);
      activeMoles.forEach((data, hole) => {
        data.timeout = setTimeout(() => {
          if (hole.contains(data.img)) {
            hole.removeChild(data.img);
          }
          activeMoles.delete(hole);
          if (timeLeft > 0 && !isPaused && activeMoles.size === 0) {
            runWave();
          }
        }, config.duration);
      });
    }
  }
});

// Start screen elements
const startScreen = document.getElementById('startScreen');
const gameScreen = document.getElementById('gameScreen');
const leaderboardScreen = document.getElementById('leaderboardScreen');
const startBtn = document.getElementById('startBtn');
const leaderboardBtn = document.getElementById('leaderboardBtn');
const backBtn = document.getElementById('backBtn');
const leaderboardContainer = document.getElementById('leaderboardContainer');

// Start screen event listeners
startBtn.addEventListener('click', startGame);
leaderboardBtn.addEventListener('click', showStartLeaderboard);
backBtn.addEventListener('click', showStartScreen);

async function showStartLeaderboard() {
  startScreen.classList.add('hidden');
  leaderboardScreen.classList.remove('hidden');

  const leaderboard = await getLeaderboard();
  showLeaderboard(leaderboard);
}

function showStartScreen() {
  leaderboardScreen.classList.add('hidden');
  startScreen.classList.remove('hidden');

  leaderboardContainer.innerHTML = '';
  backBtn.blur();
}

function startGame() {
  // Reset game state
  score = 0;
  timeLeft = 30;
  isPaused = false;
  currentLevel = 1;
  highestLevel = 1;
  whacksInCurrentLevel = 0;
  clearAllMoles();

  const tr = t();

  // Update UI
  scoreEl.textContent = '0';
  countdown.textContent = '30';
  pauseBtn.textContent = tr.pause;
  updateLevelUI();

  // Hide level toast if shown
  const toast = document.getElementById('levelUpToast');
  if (toast) toast.classList.add('hidden');

  // Hide start screen, show game screen
  startScreen.classList.add('hidden');
  gameScreen.style.display = 'flex';
  document.querySelector(".board").style.display = "grid";
  document.querySelector(".box").style.display = "block";

  // Clear any existing final score/leaderboard/name input/ad container
  document.querySelector('.finalScore').innerHTML = '';
  document.querySelector('.finalScore').style.display = 'none';
  document.querySelector('.restartBtn').style.display = 'none';
  const existingLeaderboard = document.querySelector('.leaderboard');
  if (existingLeaderboard) existingLeaderboard.remove();
  const existingNameInput = document.querySelector('.name-input');
  if (existingNameInput) existingNameInput.remove();
  const existingAd = document.querySelector('.ad-interstitial-container');
  if (existingAd) existingAd.remove();

  // Restart timer interval
  clearInterval(interval);
  interval = setInterval(() => {
    if (!isPaused) {
      timeLeft--;
      countdown.textContent = timeLeft < 10 ? "0" + timeLeft : timeLeft;

      if (timeLeft <= 0) {
        clearAllMoles();
        document.querySelector(".board").style.display = "none";
        document.querySelector(".box").style.display = "none";
        clearInterval(interval);

        // final score
        const finalScore = document.querySelector(".finalScore");
        const restartBtn = document.querySelector(".restartBtn");
        document.querySelector("body").style.cursor = "default";
        cursor.style.display = "none";

        const currentTr = t();
        finalScore.innerHTML = `
          <h3>${currentTr.gameOverTitle}</h3>
          <h1>${score} ${currentTr.scoreLabel}</h1>
          <div class="final-level-badge">${currentTr.highestLevelReached(highestLevel)}</div>
        `;
        finalScore.style.display = "block";
        restartBtn.textContent = currentTr.restart;

        // Mostra l'annuncio e il messaggio di transizione a fine partita
        showEndGameAd(score, () => {
          // Check if player made it to top 10
          isTopTen(score).then(isTop => {
            if (isTop) {
              showNameInput();
            } else {
              getLeaderboard().then(leaderboard => {
                if (leaderboard.length > 0) {
                  showLeaderboard(leaderboard);
                }
                restartBtn.style.display = "block";
              });
            }
          });
        });

        // restart the game
        restartBtn.onclick = () => {
          window.location.reload();
        };
      }
    }
  }, 1000);

  // Start the game loop
  runWave();
}

function initLanguageSelector() {
  const langButtons = document.querySelectorAll('.lang-btn');
  langButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      setLanguage(btn.dataset.lang);
    });
  });
}

// Initialize on load
document.addEventListener('DOMContentLoaded', () => {
  initFirebase();
  initLanguageSelector();
  applyTranslations();
});

// Run translation immediately as well
initLanguageSelector();
applyTranslations();

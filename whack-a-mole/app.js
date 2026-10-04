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
const WHACKS_PER_LEVEL = 5;
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
  // Remove existing leaderboard if any
  const existingLeaderboard = document.querySelector('.leaderboard');
  if (existingLeaderboard) existingLeaderboard.remove();

  const leaderboardDiv = document.createElement('div');
  leaderboardDiv.classList.add('leaderboard');

  const title = document.createElement('h2');
  title.textContent = '🌍 Global Leaderboard (Top 10)';
  leaderboardDiv.appendChild(title);

  const pendingScores = getPendingScores();
  if (pendingScores.length > 0) {
    const notice = document.createElement('p');
    notice.style.fontSize = '0.85rem';
    notice.style.color = '#ffd700';
    notice.style.margin = '4px 0 10px 0';
    notice.style.fontWeight = 'bold';
    notice.textContent = `⏳ ${pendingScores.length} score(s) queued offline — will sync to Firebase once connected.`;
    leaderboardDiv.appendChild(notice);
  }

  const table = document.createElement('table');
  table.innerHTML = `
    <thead>
      <tr>
        <th>Rank</th>
        <th>Name</th>
        <th>Score</th>
        <th>Level</th>
        <th>Date</th>
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

  leaderboardDiv.appendChild(table);

  // Append to leaderboardContainer if on leaderboard screen, otherwise to body
  if (leaderboardScreen && leaderboardScreen.style.display !== 'none') {
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
  // Rimuovi eventuali annunci precedenti
  const existingAd = document.querySelector('.ad-interstitial-container');
  if (existingAd) existingAd.remove();

  const adContainer = document.createElement('div');
  adContainer.classList.add('ad-interstitial-container');

  adContainer.innerHTML = `
    <div class="ad-notice-header">
      <span class="ad-notice-badge">Sponsor / Annuncio</span>
      <h2 class="ad-notice-title">🎉 Partita Terminata!</h2>
      <p class="ad-notice-desc">
        Visualizza questo breve messaggio pubblicitario per accedere alla classifica e salvare il tuo punteggio di <strong>${finalScoreValue} punti</strong>.
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
      Attendi ${ADSENSE_CONFIG.interstitialWaitSeconds}s per visualizzare la classifica...
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
    if (remainingSeconds > 0) {
      continueBtn.textContent = `Attendi ${remainingSeconds}s per visualizzare la classifica...`;
    } else {
      clearInterval(countdownTimer);
      countdownTimer = null;
      continueBtn.disabled = false;
      continueBtn.textContent = 'Continua alla Classifica ➡️';
    }
  }, 1000);
}

async function showNameInput() {
  const nameInputDiv = document.createElement('div');
  nameInputDiv.classList.add('name-input');

  const title = document.createElement('h2');
  title.textContent = '🎉 Top 10 Globale! Inserisci il tuo nome:';

  const input = document.createElement('input');
  input.type = 'text';
  input.placeholder = 'Il tuo nome';
  input.maxLength = 20;

  const submitBtn = document.createElement('button');
  submitBtn.textContent = 'Invia';
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
  const goldenChance = Math.min(0.25, 0.08 + level * 0.03);
  // Probabilità di talpa multipla contemporanea
  let multiChance = 0;
  if (level === 2) multiChance = 0.15;
  else if (level === 3) multiChance = 0.30;
  else if (level === 4) multiChance = 0.45;
  else if (level >= 5) multiChance = 0.60;

  return { duration, hitDelay, basePoints, goldenChance, multiChance };
}

function updateLevelUI() {
  const levelDisplay = document.querySelector('.level-display');
  if (levelDisplay) levelDisplay.textContent = currentLevel;

  const progressFill = document.getElementById('levelProgressFill');
  const progressText = document.getElementById('levelProgressText');
  const percent = Math.min(100, Math.round((whacksInCurrentLevel / WHACKS_PER_LEVEL) * 100));

  if (progressFill) progressFill.style.width = `${percent}%`;
  if (progressText) {
    progressText.textContent = `${whacksInCurrentLevel}/${WHACKS_PER_LEVEL} talpe al Livello ${currentLevel + 1}`;
  }
}

function showLevelUpToast(level, bonusSecs) {
  const toast = document.getElementById('levelUpToast');
  const sub = document.getElementById('levelUpSub');
  if (!toast) return;

  if (sub) {
    const speedMultiplier = (1 + (level - 1) * 0.2).toFixed(1);
    sub.textContent = `Livello ${level} • Velocità ${speedMultiplier}x!`;
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

function showFloatingScore(x, y, text, isGolden) {
  const floater = document.createElement('div');
  floater.classList.add('floating-score');
  if (isGolden) floater.classList.add('golden');
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
  const isGolden = Math.random() < config.goldenChance;

  const img = document.createElement('img');
  img.classList.add('mole');
  if (isGolden) {
    img.classList.add('golden-mole');
  }
  img.src = './assets/mole.png';

  let whacked = false;

  const handleMoleHit = (e) => {
    e.preventDefault();
    if (whacked || isPaused || timeLeft <= 0) return;
    whacked = true;

    const earnedPoints = isGolden ? config.basePoints * 3 : config.basePoints;
    score += earnedPoints;
    scoreEl.textContent = score;

    whacksInCurrentLevel++;

    if (isGolden) {
      playGoldenHitChime();
    } else {
      sound.currentTime = 0;
      sound.play().catch(() => {});
    }

    img.src = './assets/mole-whacked.png';

    const x = e.clientX || (e.touches ? e.touches[0].clientX : (e.changedTouches ? e.changedTouches[0].clientX : window.innerWidth / 2));
    const y = e.clientY || (e.touches ? e.touches[0].clientY : (e.changedTouches ? e.changedTouches[0].clientY : window.innerHeight / 2));

    showTouchEffect(x, y, true);
    showFloatingScore(x, y, `+${earnedPoints}${isGolden ? ' ⭐' : ''}`, isGolden);

    checkLevelUp();

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
    isGolden,
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
  pauseBtn.textContent = isPaused ? "Resume" : "Pause";

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

// Initialize Firebase on load
document.addEventListener('DOMContentLoaded', initFirebase);

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
  // Hide start screen, show leaderboard screen
  startScreen.classList.add('hidden');
  leaderboardScreen.classList.remove('hidden');

  const leaderboard = await getLeaderboard();
  showLeaderboard(leaderboard);
}

function showStartScreen() {
  // Hide leaderboard screen, show start screen
  leaderboardScreen.classList.add('hidden');
  startScreen.classList.remove('hidden');

  // Clear leaderboard container
  leaderboardContainer.innerHTML = '';

  // Blur the back button to prevent focus/hover state from persisting
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

  // Update UI
  scoreEl.textContent = '0';
  countdown.textContent = '30';
  pauseBtn.textContent = 'Pause';
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

        finalScore.innerHTML = `
          <h3>Partita Terminata!</h3>
          <h1>${score} Punti</h1>
          <div class="final-level-badge">🏆 Livello Raggiunto: Livello ${highestLevel}</div>
        `;
        finalScore.style.display = "block";

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

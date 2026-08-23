const cursor = document.querySelector(".cursor");
const scoreEl = document.querySelector(".score span");
const countdown = document.querySelector(".countdown span");
const holes = [...document.querySelectorAll(".hole")];
const pauseBtn = document.querySelector(".pauseBtn");
let score = 0;
const sound = new Audio("./assets/smash.mp3");
let timeLeft = 30;
let isPaused = false;
let moleTimeout = null;

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

function initFirebase() {
  if (typeof firebase !== 'undefined') {
    firebase.initializeApp(FIREBASE_CONFIG);
    db = firebase.database();
    firebaseReady = true;
    console.log('Firebase initialized');
  } else {
    console.warn('Firebase SDK not loaded, using localStorage fallback');
    firebaseReady = false;
  }
}

// Leaderboard functions
async function getLeaderboard() {
  if (firebaseReady && db) {
    try {
      const snapshot = await db.ref('leaderboard').orderByChild('score').limitToLast(10).once('value');
      const data = snapshot.val() || {};
      const leaderboard = Object.values(data).sort((a, b) => b.score - a.score);
      return leaderboard;
    } catch (e) {
      console.error('Firebase read error:', e);
    }
  }
  // Fallback to localStorage
  const leaderboard = localStorage.getItem('whackAMoleLeaderboard');
  return leaderboard ? JSON.parse(leaderboard) : [];
}

async function saveToLeaderboard(name, score) {
  const date = new Date();
  const europeanDate = `${date.getDate().toString().padStart(2, '0')}/${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getFullYear()}`;
  const entry = { name, score, date: europeanDate };

  if (firebaseReady && db) {
    try {
      // Push new entry
      await db.ref('leaderboard').push(entry);
      // Keep only top 100 to prevent unbounded growth
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
      console.error('Firebase write error:', e);
    }
  }
  // Also save to localStorage as backup
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

  const table = document.createElement('table');
  table.innerHTML = `
    <thead>
      <tr>
        <th>Rank</th>
        <th>Name</th>
        <th>Score</th>
        <th>Date</th>
      </tr>
    </thead>
    <tbody>
      ${leaderboard.slice(0, 10).map((entry, index) => `
        <tr>
          <td>${index + 1}</td>
          <td>${entry.name}</td>
          <td>${entry.score}</td>
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
    await saveToLeaderboard(name, score);
    nameInputDiv.remove();
    document.querySelector('.finalScore').style.display = 'none';
    const leaderboard = await getLeaderboard();
    showLeaderboard(leaderboard);
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

// Pause/Resume functionality
pauseBtn.addEventListener("click", () => {
  isPaused = !isPaused;
  pauseBtn.textContent = isPaused ? "Resume" : "Pause";

  if (isPaused) {
    if (moleTimeout) {
      clearTimeout(moleTimeout);
      moleTimeout = null;
    }
  } else if (timeLeft > 0) {
    run();
  }
});

function run() {
  if (isPaused || timeLeft <= 0) return;

  const i = Math.floor(Math.random() * holes.length);
  let hole = holes[i];

  const img = document.createElement("img");
  img.classList.add("mole");
  img.src = "./assets/mole.png";

  // Function to handle mole hit
  const handleMoleHit = (e) => {
    e.preventDefault();
    score += 10;
    sound.play();
    scoreEl.textContent = score;
    img.src = "./assets/mole-whacked.png";

    // Show boom effect for all devices
    const x = e.clientX || (e.touches ? e.touches[0].clientX : e.changedTouches[0].clientX);
    const y = e.clientY || (e.touches ? e.touches[0].clientY : e.changedTouches[0].clientY);
    showTouchEffect(x, y, true);

    clearTimeout(moleTimeout);
    moleTimeout = null;
    setTimeout(() => {
      hole.removeChild(img);
      if (timeLeft > 0 && !isPaused) {
        run();
      }
    }, 500);
  };

  // Add both click and touch event listeners
  img.addEventListener("click", handleMoleHit);
  img.addEventListener("touchstart", handleMoleHit);

  hole.appendChild(img);

  moleTimeout = setTimeout(() => {
    moleTimeout = null;
    hole.removeChild(img);
    if (timeLeft > 0 && !isPaused) {
      run();
    }
  }, 1500);
}

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
  moleTimeout = null;

  // Update UI
  scoreEl.textContent = '00';
  countdown.textContent = '30';
  pauseBtn.textContent = 'Pause';

  // Hide start screen, show game screen
  startScreen.classList.add('hidden');
  gameScreen.style.display = 'flex';

  // Clear any existing final score/leaderboard/name input
  document.querySelector('.finalScore').innerHTML = '';
  document.querySelector('.finalScore').style.display = 'none';
  document.querySelector('.restartBtn').style.display = 'none';
  const existingLeaderboard = document.querySelector('.leaderboard');
  if (existingLeaderboard) existingLeaderboard.remove();
  const existingNameInput = document.querySelector('.name-input');
  if (existingNameInput) existingNameInput.remove();

  // Restart timer interval
  clearInterval(interval);
  interval = setInterval(() => {
    if (!isPaused) {
      timeLeft--;
      countdown.textContent = timeLeft;

      if (timeLeft < 10) {
        countdown.textContent = "0" + timeLeft;
      }

      if (timeLeft < 0) {
        document.querySelector(".board").style.display = "none";
        document.querySelector(".box").style.display = "none";
        clearInterval(interval);

        // final score
        const finalScore = document.querySelector(".finalScore");
        const restartBtn = document.querySelector(".restartBtn");
        document.querySelector("body").style.cursor = "default";
        finalScore.style.display = "block";
        restartBtn.style.display = "block";
        cursor.style.display = "none";

        const h3 = document.createElement("h3");
        const h1 = document.createElement("h1");
        h3.textContent = "Your Final Score is : ";
        h1.textContent = score;

        finalScore.appendChild(h3);
        finalScore.appendChild(h1);

        // Check if player made it to top 10
        isTopTen(score).then(isTop => {
          if (isTop) {
            showNameInput();
          } else {
            getLeaderboard().then(leaderboard => {
              if (leaderboard.length > 0) {
                showLeaderboard(leaderboard);
              }
            });
          }
        });

        // restart the game
        restartBtn.addEventListener("click", () => {
          window.location.reload();
        });
      }
    }
  }, 1000);

  // Start the game loop
  run();
}

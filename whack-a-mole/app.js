const cursor = document.querySelector(".cursor");
const scoreEl = document.querySelector(".score span");
const countdown = document.querySelector(".countdown span");
const holes = [...document.querySelectorAll(".hole")];
let score = 0;
const sound = new Audio("./assets/smash.mp3");
let timeLeft = 30;

// Leaderboard functions
function getLeaderboard() {
  const leaderboard = localStorage.getItem('whackAMoleLeaderboard');
  return leaderboard ? JSON.parse(leaderboard) : [];
}

function saveToLeaderboard(name, score) {
  const leaderboard = getLeaderboard();
  const date = new Date();
  const europeanDate = `${date.getDate().toString().padStart(2, '0')}/${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getFullYear()}`;
  leaderboard.push({ name, score, date: europeanDate });
  leaderboard.sort((a, b) => b.score - a.score);
  const top10 = leaderboard.slice(0, 10);
  localStorage.setItem('whackAMoleLeaderboard', JSON.stringify(top10));
  return top10;
}

function isTopTen(score) {
  const leaderboard = getLeaderboard();
  if (leaderboard.length < 10) return true;
  return score > leaderboard[9].score;
}

function showLeaderboard(leaderboard) {
  const leaderboardDiv = document.createElement('div');
  leaderboardDiv.classList.add('leaderboard');
  
  const title = document.createElement('h2');
  title.textContent = 'Leaderboard';
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
      ${leaderboard.map((entry, index) => `
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
  document.body.appendChild(leaderboardDiv);
}

function showNameInput() {
  const nameInputDiv = document.createElement('div');
  nameInputDiv.classList.add('name-input');
  
  const title = document.createElement('h2');
  title.textContent = '🎉 Top 10! Enter Your Name:';
  
  const input = document.createElement('input');
  input.type = 'text';
  input.placeholder = 'Your name';
  input.maxLength = 20;
  
  const submitBtn = document.createElement('button');
  submitBtn.textContent = 'Submit';
  submitBtn.classList.add('submitBtn');
  
  submitBtn.addEventListener('click', () => {
    const name = input.value.trim() || 'Anonymous';
    const leaderboard = saveToLeaderboard(name, score);
    nameInputDiv.remove();
    document.querySelector('.finalScore').style.display = 'none';
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

let interval = setInterval(() => {
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
    if (isTopTen(score)) {
      showNameInput();
    } else {
      const leaderboard = getLeaderboard();
      if (leaderboard.length > 0) {
        showLeaderboard(leaderboard);
      }
    }

    // restart the game
    restartBtn.addEventListener("click", () => {
      window.location.reload();
    });
  }
}, 1000);

function run() {
  const i = Math.floor(Math.random() * holes.length);
  let hole = holes[i];
  let timer = null;

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
    
    clearTimeout(timer);
    setTimeout(() => {
      hole.removeChild(img);
      if (timeLeft > 0) {
        run();
      }
    }, 500);
  };

  // Add both click and touch event listeners
  img.addEventListener("click", handleMoleHit);
  img.addEventListener("touchstart", handleMoleHit);

  hole.appendChild(img);

  timer = setTimeout(() => {
    hole.removeChild(img);
    if (timeLeft > 0) {
      run();
    }
  }, 1500);
}

run();

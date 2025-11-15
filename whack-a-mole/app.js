const cursor = document.querySelector(".cursor");
const scoreEl = document.querySelector(".score span");
const countdown = document.querySelector(".countdown span");
const holes = [...document.querySelectorAll(".hole")];
let score = 0;
const sound = new Audio("./assets/smash.mp3");
let timeLeft = 30;

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

    // restart the game
    restartBtn.addEventListener("click", () => {
      window.location.reload();
    });

    finalScore.appendChild(h3);
    finalScore.appendChild(h1);
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

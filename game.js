const tg = Telegram.WebApp;
tg.expand();

let grid = document.getElementById("grid");
let timerEl = document.getElementById("timer");
let statusEl = document.getElementById("status");

let numbers = [];
let marked = new Set();
let currentTarget = null;
let timeLeft = 30;
let gameOver = false;

// ----- ADD THE SIGN RESULT FUNCTION -----
function signResult(data) {
  return btoa(JSON.stringify(data)).slice(0, 16);
}

// Generate grid
function generateGrid() {
  numbers = [];
  grid.innerHTML = "";
  for (let i = 1; i <= 25; i++) numbers.push(i);
  numbers.sort(() => Math.random() - 0.5);

  numbers.forEach(num => {
    let div = document.createElement("div");
    div.className = "cell";
    div.textContent = num;
    div.onclick = () => tapCell(num, div);
    grid.appendChild(div);
  });
}

function nextTarget() {
  currentTarget = numbers[Math.floor(Math.random() * numbers.length)];
  statusEl.textContent = "Tap number: " + currentTarget;
}

function tapCell(num, el) {
  if (gameOver) return;

  if (num === currentTarget && !marked.has(num)) {
    marked.add(num);
    el.classList.add("active");
    checkWin();
    nextTarget();
  } else {
    el.classList.add("wrong");
    setTimeout(() => el.classList.remove("wrong"), 300);
    timeLeft -= 2; // penalty
  }
}

function checkWin() {
  if (marked.size >= 5) {
    endGame(true);
  }
}

function countdown() {
  let interval = setInterval(() => {
    if (timeLeft <= 0) {
      clearInterval(interval);
      endGame(false);
    }
    timerEl.textContent = "Time: " + timeLeft;
    timeLeft--;
  }, 1000);
}

// ----- UPDATED ENDGAME FUNCTION -----
function endGame(win) {
  gameOver = true;

  const payload = {
    result: win ? "WIN" : "LOSE",
    time: timeLeft,
    marks: marked.size,
    mode: new URLSearchParams(window.location.search).get("mode") || "normal"
  };

  payload.sig = signResult(payload);

  tg.sendData(JSON.stringify(payload));

  statusEl.textContent = win ? "🏆 YOU WIN!" : "❌ YOU LOST";
  setTimeout(() => tg.close(), 1500);
}

// Start game
generateGrid();
nextTarget();
countdown();

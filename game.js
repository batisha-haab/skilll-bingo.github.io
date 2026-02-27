// game.js - Fixed Bingo Logic with Target Numbers

let tg;
try {
    tg = window.Telegram.WebApp;
    tg.ready();
    tg.expand();
    tg.enableClosingConfirmation();
    tg.setHeaderColor('#0f172a');
    tg.setBackgroundColor('#0f172a');
} catch (error) {
    console.error('Telegram WebApp not available:', error);
    // Mock for testing
    tg = {
        ready: () => {}, expand: () => {}, enableClosingConfirmation: () => {},
        setHeaderColor: () => {}, setBackgroundColor: () => {},
        sendData: (data) => { console.log('Mock sendData:', data); return Promise.resolve(); },
        close: () => { alert('Game completed!'); },
        showPopup: (params, callback) => { if (callback) callback(true); }
    };
}

// DOM Elements
let grid = document.getElementById("grid");
let timerEl = document.getElementById("timer");
let statusEl = document.getElementById("status");
let targetNumberEl = document.getElementById("targetNumber");
let scoreEl = document.getElementById("score");
let gameModeEl = document.getElementById("gameMode");
let modeDisplayEl = document.getElementById("modeDisplay");
let loadingEl = document.getElementById("loading");
let submitBtn = document.getElementById("submitBtn");
let toastEl = document.getElementById("toast");
let particlesEl = document.getElementById("particles");

// Audio elements
let clickSound = document.getElementById("clickSound");
let correctSound = document.getElementById("correctSound");
let wrongSound = document.getElementById("wrongSound");
let winSound = document.getElementById("winSound");
let loseSound = document.getElementById("loseSound");
let bgMusic = document.getElementById("bgMusic");

// Game state
let numbers = [];
let marked = new Set();
let currentTarget = null;
let timeLeft = 30;
let score = 0;
let gameOver = false;
let timerInterval = null;
let isSoundEnabled = true;
let gameMode = "free";
let gameType = "bingo";

// BINGO CONSTANTS
const BINGO_COLUMNS = {
    'B': { min: 1, max: 15 },
    'I': { min: 16, max: 30 },
    'N': { min: 31, max: 45 },
    'G': { min: 46, max: 60 },
    'O': { min: 61, max: 75 }
};
const COLUMN_LETTERS = ['B', 'I', 'N', 'G', 'O'];

// Winning patterns (coordinates [row, col])
const WINNING_PATTERNS = [
    // Rows
    [[0,0], [0,1], [0,2], [0,3], [0,4]],
    [[1,0], [1,1], [1,2], [1,3], [1,4]],
    [[2,0], [2,1], [2,2], [2,3], [2,4]],
    [[3,0], [3,1], [3,2], [3,3], [3,4]],
    [[4,0], [4,1], [4,2], [4,3], [4,4]],
    // Columns
    [[0,0], [1,0], [2,0], [3,0], [4,0]],
    [[0,1], [1,1], [2,1], [3,1], [4,1]],
    [[0,2], [1,2], [2,2], [3,2], [4,2]],
    [[0,3], [1,3], [2,3], [3,3], [4,3]],
    [[0,4], [1,4], [2,4], [3,4], [4,4]],
    // Diagonals
    [[0,0], [1,1], [2,2], [3,3], [4,4]],
    [[0,4], [1,3], [2,2], [3,1], [4,0]]
];

function initializeGame() {
    const urlParams = new URLSearchParams(window.location.search);
    gameMode = urlParams.get("mode") || "free";
    
    gameModeEl.textContent = gameMode.toUpperCase();
    modeDisplayEl.textContent = gameMode.toUpperCase();
    
    createParticles();
    
    try {
        bgMusic.volume = 0.3;
        if (isSoundEnabled) {
            bgMusic.play().catch(e => console.log('Background music not autoplayed:', e));
        }
    } catch (error) {
        console.log('Music error:', error);
    }
    
    generateBingoCard();
    startTimer();
    
    setTimeout(() => {
        loadingEl.classList.add("hidden");
    }, 1000);
    
    submitBtn.disabled = true;
    submitBtn.style.opacity = "0.5";
    
    window.addEventListener('beforeunload', saveGameState);
    window.addEventListener('pagehide', saveGameState);
    
    restoreGameState();
}

function generateBingoCard() {
    numbers = [];
    grid.innerHTML = "";
    grid.className = "grid bingo-grid";
    
    // Generate proper BINGO card with column ranges
    for (let row = 0; row < 5; row++) {
        for (let col = 0; col < 5; col++) {
            const colLetter = COLUMN_LETTERS[col];
            const range = BINGO_COLUMNS[colLetter];
            
            // Generate unique number for this column
            let num;
            do {
                num = Math.floor(Math.random() * (range.max - range.min + 1)) + range.min;
            } while (numbers.includes(num) && numbers.filter(n => 
                n >= range.min && n <= range.max).length < 15);
            
            numbers.push(num);
            
            const cell = document.createElement("div");
            cell.className = "cell";
            cell.dataset.number = num;
            cell.dataset.row = row;
            cell.dataset.col = col;
            cell.dataset.letter = colLetter;
            
            // FREE space in center
            if (row === 2 && col === 2) {
                cell.textContent = "FREE";
                cell.dataset.number = "FREE";
                marked.add("FREE");
                cell.classList.add("active");
            } else {
                cell.textContent = num;
            }
            
            cell.onclick = () => tapCell(num, cell, row, col);
            grid.appendChild(cell);
        }
    }
    
    // Set first target number
    nextTarget();
}

function nextTarget() {
    if (gameOver) return;
    
    // Get all unmarked numbers (excluding FREE)
    const available = numbers.filter(num => 
        num !== "FREE" && !marked.has(num)
    );
    
    if (available.length === 0) {
        // All numbers marked - check for win
        if (checkBingoWin()) {
            endGame(true);
        }
        return;
    }
    
    // Select random target from available numbers
    currentTarget = available[Math.floor(Math.random() * available.length)];
    targetNumberEl.textContent = currentTarget;
    statusEl.innerHTML = `Tap this number: <span class="target-highlight">${currentTarget}</span>`;
    
    // Highlight the target number in the grid
    document.querySelectorAll('.cell').forEach(cell => {
        cell.classList.remove('target-cell');
        if (parseInt(cell.dataset.number) === currentTarget) {
            cell.classList.add('target-cell');
        }
    });
}

function checkBingoWin() {
    const cells = document.querySelectorAll('.cell');
    
    // Check each winning pattern
    for (let pattern of WINNING_PATTERNS) {
        let patternComplete = true;
        
        for (let [row, col] of pattern) {
            const cellIndex = row * 5 + col;
            const cell = cells[cellIndex];
            
            if (!cell || !cell.classList.contains('active')) {
                patternComplete = false;
                break;
            }
        }
        
        if (patternComplete) {
            // Highlight winning pattern
            for (let [row, col] of pattern) {
                const cellIndex = row * 5 + col;
                cells[cellIndex].style.animation = "winPulse 0.5s infinite";
            }
            return true;
        }
    }
    
    return false;
}

function tapCell(num, cell, row, col) {
    if (gameOver) return;
    
    playSound(clickSound);
    
    if (num === "FREE") {
        showToast("FREE space already marked!", "info");
        return;
    }
    
    // Check if this is the target number
    if (num === currentTarget && !marked.has(num)) {
        // Correct tap
        marked.add(num);
        cell.classList.add("active");
        playSound(correctSound);
        score++;
        scoreEl.textContent = score;
        
        // Check for BINGO!
        if (checkBingoWin()) {
            endGame(true);
        } else {
            // Get next target
            nextTarget();
        }
    } else if (!marked.has(num)) {
        // Wrong tap - penalty
        cell.classList.add("wrong");
        playSound(wrongSound);
        
        // Time penalty based on mode
        const penalty = gameMode === 'vip' ? 3 : 2;
        timeLeft = Math.max(0, timeLeft - penalty);
        timerEl.textContent = timeLeft;
        
        // Show penalty feedback
        const penaltyEl = document.createElement('div');
        penaltyEl.textContent = `-${penalty}s`;
        penaltyEl.style.position = 'absolute';
        penaltyEl.style.color = '#ef4444';
        penaltyEl.style.fontWeight = 'bold';
        penaltyEl.style.animation = 'floatUp 1s ease-out forwards';
        cell.appendChild(penaltyEl);
        
        setTimeout(() => {
            cell.classList.remove("wrong");
            if (penaltyEl.parentNode) {
                penaltyEl.remove();
            }
        }, 1000);
    }
}

function startTimer() {
    if (timerInterval) clearInterval(timerInterval);
    
    timerInterval = setInterval(() => {
        if (gameOver) {
            clearInterval(timerInterval);
            return;
        }
        
        timeLeft--;
        timerEl.textContent = timeLeft;
        
        if (timeLeft <= 10) {
            timerEl.style.animation = 'pulse 0.5s infinite';
            timerEl.style.background = 'linear-gradient(45deg, #ef4444, #dc2626)';
        } else if (timeLeft <= 20) {
            timerEl.style.background = 'linear-gradient(45deg, #f59e0b, #eab308)';
        }
        
        if (timeLeft <= 0) {
            clearInterval(timerInterval);
            endGame(false);
        }
        
        if (timeLeft % 5 === 0) {
            saveGameState();
        }
    }, 1000);
}

function endGame(isWin) {
    if (gameOver) return;
    
    gameOver = true;
    clearInterval(timerInterval);
    
    playSound(isWin ? winSound : loseSound);
    
    if (isWin) {
        statusEl.textContent = "🏆 BINGO! 🏆";
        statusEl.className = "status-win";
        celebrateVictory();
    } else {
        statusEl.textContent = "❌ GAME OVER ❌";
        statusEl.className = "status-lose";
    }
    
    submitBtn.disabled = false;
    submitBtn.style.opacity = "1";
    
    localStorage.removeItem('skillGameState');
    
    setTimeout(() => {
        showToast(isWin ? `You won with ${timeLeft}s remaining!` : "Time's up! Try again.", isWin ? "success" : "error");
    }, 500);
}

function celebrateVictory() {
    for (let i = 0; i < 50; i++) {
        setTimeout(() => {
            const confetti = document.createElement('div');
            confetti.style.position = 'fixed';
            confetti.style.width = '10px';
            confetti.style.height = '10px';
            confetti.style.background = ['#22c55e', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6'][Math.floor(Math.random() * 5)];
            confetti.style.borderRadius = '50%';
            confetti.style.top = '-10px';
            confetti.style.left = Math.random() * 100 + '%';
            confetti.style.zIndex = '999';
            confetti.style.animation = `confettiFall ${Math.random() * 1 + 1}s linear forwards`;
            document.body.appendChild(confetti);
            setTimeout(() => confetti.remove(), 2000);
        }, i * 50);
    }
}

function signResult(data) {
    const str = JSON.stringify(data);
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
    }
    return Math.abs(hash).toString(16).slice(0, 16);
}

async function sendGameData() {
    if (!gameOver) {
        showToast("Finish the game first!", "error");
        return;
    }
    
    const isWin = checkBingoWin();
    
    const payload = {
        game_type: "bingo",
        result: isWin ? "WIN" : "LOSE",
        time: timeLeft,
        marks: marked.size - 1, // Subtract FREE space
        mode: gameMode,
        score: score,
        timestamp: Date.now(),
        user_id: tg.initDataUnsafe?.user?.id || "unknown"
    };
    
    payload.sig = signResult(payload);
    
    try {
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sending...';
        submitBtn.disabled = true;
        
        await tg.sendData(JSON.stringify(payload));
        
        submitBtn.innerHTML = '<i class="fas fa-check"></i> Sent!';
        showToast("Score submitted successfully!", "success");
        
        setTimeout(() => {
            tg.close();
        }, 2000);
        
    } catch (error) {
        console.error('Failed to send game data:', error);
        submitBtn.innerHTML = '<i class="fas fa-paper-plane"></i> Submit Score';
        submitBtn.disabled = false;
        showToast("Failed to submit score. Try again.", "error");
    }
}

function restartGame() {
    if (!gameOver && marked.size > 1) { // More than just FREE space
        tg.showPopup({
            title: "Restart Game?",
            message: "Are you sure you want to restart? Your current progress will be lost.",
            buttons: [
                { id: 'yes', type: 'destructive', text: 'Restart' },
                { id: 'no', type: 'default', text: 'Cancel' }
            ]
        }, (buttonId) => {
            if (buttonId === 'yes') {
                resetGame();
            }
        });
    } else {
        resetGame();
    }
}

function resetGame() {
    marked.clear();
    // Add FREE space back
    marked.add("FREE");
    currentTarget = null;
    timeLeft = 30;
    score = 0;
    gameOver = false;
    
    timerEl.textContent = timeLeft;
    scoreEl.textContent = score;
    timerEl.style.background = 'linear-gradient(45deg, #ef4444, #f59e0b)';
    timerEl.style.animation = 'pulse 2s infinite';
    statusEl.innerHTML = 'Tap the number: <span id="targetNumber">0</span>';
    statusEl.className = "";
    targetNumberEl.textContent = "0";
    submitBtn.disabled = true;
    submitBtn.style.opacity = "0.5";
    submitBtn.innerHTML = '<i class="fas fa-paper-plane"></i> Submit Score';
    
    generateBingoCard();
    
    if (timerInterval) clearInterval(timerInterval);
    startTimer();
    
    showToast("Game restarted!", "success");
}

function toggleSound() {
    isSoundEnabled = !isSoundEnabled;
    const icon = document.getElementById("soundIcon");
    const toggle = document.getElementById("soundToggle");
    
    if (isSoundEnabled) {
        icon.className = "fas fa-volume-up";
        toggle.style.background = "rgba(59, 130, 246, 0.8)";
        showToast("Sound enabled", "success");
        bgMusic.play().catch(e => console.log('Music play failed:', e));
    } else {
        icon.className = "fas fa-volume-mute";
        toggle.style.background = "rgba(239, 68, 68, 0.8)";
        showToast("Sound disabled", "error");
        bgMusic.pause();
    }
}

function playSound(sound) {
    if (!isSoundEnabled || !sound) return;
    try {
        sound.currentTime = 0;
        sound.play().catch(e => console.log('Audio play failed:', e));
    } catch (error) {
        console.log('Sound error:', error);
    }
}

function showToast(message, type = "info") {
    toastEl.textContent = message;
    toastEl.className = "toast";
    toastEl.classList.add(type);
    toastEl.classList.add("show");
    
    setTimeout(() => {
        toastEl.classList.remove("show");
    }, 3000);
}

function createParticles() {
    particlesEl.innerHTML = '';
    for (let i = 0; i < 50; i++) {
        const particle = document.createElement('div');
        particle.className = 'particle';
        particle.style.width = Math.random() * 10 + 5 + 'px';
        particle.style.height = particle.style.width;
        particle.style.left = Math.random() * 100 + '%';
        particle.style.top = Math.random() * 100 + '%';
        particle.style.animationDuration = Math.random() * 20 + 10 + 's';
        particle.style.animationDelay = Math.random() * 5 + 's';
        particle.style.opacity = Math.random() * 0.5 + 0.1;
        particlesEl.appendChild(particle);
    }
}

function saveGameState() {
    try {
        const state = {
            numbers,
            marked: Array.from(marked),
            currentTarget,
            timeLeft,
            score,
            gameOver,
            gameMode,
            gameType
        };
        localStorage.setItem('skillGameState', JSON.stringify(state));
    } catch (error) {
        console.log('Failed to save game state:', error);
    }
}

function restoreGameState() {
    try {
        const saved = localStorage.getItem('skillGameState');
        if (saved) {
            const state = JSON.parse(saved);
            
            if (state.gameMode === gameMode && state.gameType === gameType) {
                numbers = state.numbers || [];
                marked = new Set(state.marked || []);
                currentTarget = state.currentTarget;
                timeLeft = state.timeLeft || 30;
                score = state.score || 0;
                gameOver = state.gameOver || false;
                
                generateBingoCard();
                
                if (currentTarget) {
                    targetNumberEl.textContent = currentTarget;
                }
                timerEl.textContent = timeLeft;
                scoreEl.textContent = score;
                
                if (gameOver) {
                    endGame(score >= 5);
                }
                
                showToast("Game restored from previous session", "success");
            }
            
            localStorage.removeItem('skillGameState');
        }
    } catch (error) {
        console.log('Failed to restore game state:', error);
    }
}

// Error handling
window.addEventListener('error', function(event) {
    console.error('Global error:', event.error);
    showToast("Game error occurred. Restarting...", "error");
    
    setTimeout(() => {
        if (!gameOver) {
            resetGame();
        }
    }, 1000);
});

window.addEventListener('unhandledrejection', function(event) {
    console.error('Unhandled promise rejection:', event.reason);
    showToast("Something went wrong. Please restart.", "error");
});

// Start the game
document.addEventListener('DOMContentLoaded', initializeGame);

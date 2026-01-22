// game.js

// Initialize Telegram WebApp
let tg;
try {
    tg = window.Telegram.WebApp;
    
    // Initialize WebApp
    tg.ready();
    tg.expand();
    tg.enableClosingConfirmation();
    
    // Set theme colors
    tg.setHeaderColor('#0f172a');
    tg.setBackgroundColor('#0f172a');
    
    console.log('Telegram WebApp initialized successfully');
} catch (error) {
    console.error('Telegram WebApp not available:', error);
    // Create mock for testing outside Telegram
    tg = {
        ready: () => console.log('Mock ready'),
        expand: () => console.log('Mock expand'),
        enableClosingConfirmation: () => console.log('Mock enableClosingConfirmation'),
        setHeaderColor: () => {},
        setBackgroundColor: () => {},
        sendData: (data) => {
            console.log('Mock sendData:', data);
            return new Promise(resolve => resolve());
        },
        close: () => {
            console.log('Mock close');
            alert('Game completed! In Telegram, this would close the mini app.');
        },
        showPopup: (params, callback) => {
            console.log('Mock showPopup:', params);
            if (callback) callback(true);
        }
    };
}

// Game state
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

// Game variables
let numbers = [];
let marked = new Set();
let currentTarget = null;
let timeLeft = 30;
let score = 0;
let gameOver = false;
let timerInterval = null;
let isSoundEnabled = true;
let gameMode = "free";

// ----- SOUND MANAGEMENT -----
function toggleSound() {
    isSoundEnabled = !isSoundEnabled;
    const icon = document.getElementById("soundIcon");
    const toggle = document.getElementById("soundToggle");
    
    if (isSoundEnabled) {
        icon.className = "fas fa-volume-up";
        toggle.style.background = "rgba(59, 130, 246, 0.8)";
        showToast("Sound enabled", "success");
    } else {
        icon.className = "fas fa-volume-mute";
        toggle.style.background = "rgba(239, 68, 68, 0.8)";
        showToast("Sound disabled", "error");
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

// ----- TOAST NOTIFICATIONS -----
function showToast(message, type = "info") {
    toastEl.textContent = message;
    toastEl.className = "toast";
    toastEl.classList.add(type);
    toastEl.classList.add("show");
    
    setTimeout(() => {
        toastEl.classList.remove("show");
    }, 3000);
}

// ----- PARTICLES BACKGROUND -----
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

// ----- GAME INITIALIZATION -----
function initializeGame() {
    // Get game mode from URL
    const urlParams = new URLSearchParams(window.location.search);
    gameMode = urlParams.get("mode") || "free";
    
    // Update UI with mode
    gameModeEl.textContent = gameMode.toUpperCase();
    modeDisplayEl.textContent = gameMode.toUpperCase();
    
    // Create particles
    createParticles();
    
    // Start background music
    try {
        bgMusic.volume = 0.3;
        if (isSoundEnabled) {
            bgMusic.play().catch(e => console.log('Background music not autoplayed:', e));
        }
    } catch (error) {
        console.log('Music error:', error);
    }
    
    // Generate grid and start game
    generateGrid();
    nextTarget();
    startTimer();
    
    // Hide loading screen
    setTimeout(() => {
        loadingEl.classList.add("hidden");
    }, 1000);
    
    // Disable submit button initially
    submitBtn.disabled = true;
    submitBtn.style.opacity = "0.5";
    
    // Add game state persistence for crashes
    window.addEventListener('beforeunload', saveGameState);
    window.addEventListener('pagehide', saveGameState);
    
    // Try to restore saved game state
    restoreGameState();
}

// ----- GAME STATE PERSISTENCE -----
function saveGameState() {
    try {
        const state = {
            numbers,
            marked: Array.from(marked),
            currentTarget,
            timeLeft,
            score,
            gameOver,
            gameMode
        };
        localStorage.setItem('skillBingoState', JSON.stringify(state));
    } catch (error) {
        console.log('Failed to save game state:', error);
    }
}

function restoreGameState() {
    try {
        const saved = localStorage.getItem('skillBingoState');
        if (saved) {
            const state = JSON.parse(saved);
            
            // Only restore if same game mode
            if (state.gameMode === gameMode) {
                numbers = state.numbers || [];
                marked = new Set(state.marked || []);
                currentTarget = state.currentTarget;
                timeLeft = state.timeLeft || 30;
                score = state.score || 0;
                gameOver = state.gameOver || false;
                
                // Update UI
                updateGrid();
                if (currentTarget) {
                    targetNumberEl.textContent = currentTarget;
                    statusEl.innerHTML = `Tap number: <span class="target-highlight">${currentTarget}</span>`;
                }
                timerEl.textContent = timeLeft;
                scoreEl.textContent = score;
                
                if (gameOver) {
                    endGame(score >= 5);
                } else if (marked.size >= 5) {
                    checkWin();
                }
                
                showToast("Game restored from previous session", "success");
            }
            
            // Clear saved state
            localStorage.removeItem('skillBingoState');
        }
    } catch (error) {
        console.log('Failed to restore game state:', error);
    }
}

// ----- GRID FUNCTIONS -----
function generateGrid() {
    numbers = [];
    grid.innerHTML = "";
    
    // Generate unique numbers 1-25
    for (let i = 1; i <= 25; i++) numbers.push(i);
    numbers.sort(() => Math.random() - 0.5);
    
    // Create cells
    numbers.forEach((num, index) => {
        const cell = document.createElement("div");
        cell.className = "cell";
        cell.dataset.number = num;
        cell.dataset.index = index;
        cell.textContent = num;
        cell.onclick = () => tapCell(num, cell);
        grid.appendChild(cell);
    });
    
    // Apply marked state if any
    updateGrid();
}

function updateGrid() {
    document.querySelectorAll('.cell').forEach(cell => {
        const num = parseInt(cell.dataset.number);
        
        cell.classList.remove('active', 'wrong');
        
        if (marked.has(num)) {
            cell.classList.add('active');
        }
    });
}

function nextTarget() {
    if (gameOver) return;
    
    // Filter out marked numbers
    const available = numbers.filter(num => !marked.has(num));
    
    if (available.length === 0) {
        endGame(true);
        return;
    }
    
    // Select random target from available numbers
    currentTarget = available[Math.floor(Math.random() * available.length)];
    targetNumberEl.textContent = currentTarget;
    
    // Update status with highlight
    statusEl.innerHTML = `Tap number: <span class="target-highlight">${currentTarget}</span>`;
    
    // Add CSS for target highlight
    if (!document.querySelector('#target-highlight-style')) {
        const style = document.createElement('style');
        style.id = 'target-highlight-style';
        style.textContent = `
            .target-highlight {
                color: #f59e0b;
                font-weight: bold;
                text-shadow: 0 0 10px rgba(245, 158, 11, 0.5);
                animation: glow 1.5s ease-in-out infinite alternate;
            }
            @keyframes glow {
                from { text-shadow: 0 0 5px rgba(245, 158, 11, 0.5); }
                to { text-shadow: 0 0 15px rgba(245, 158, 11, 0.8), 0 0 20px rgba(245, 158, 11, 0.6); }
            }
        `;
        document.head.appendChild(style);
    }
}

// ----- GAME LOGIC -----
function tapCell(num, cell) {
    if (gameOver) return;
    
    playSound(clickSound);
    
    if (num === currentTarget && !marked.has(num)) {
        // Correct tap
        marked.add(num);
        score++;
        scoreEl.textContent = score;
        
        cell.classList.add("active");
        playSound(correctSound);
        
        // Check for win
        checkWin();
        
        // Get next target
        nextTarget();
        
    } else if (!marked.has(num)) {
        // Wrong tap penalty
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
        
        // Remove penalty indicator
        setTimeout(() => {
            cell.classList.remove("wrong");
            if (penaltyEl.parentNode) {
                penaltyEl.remove();
            }
        }, 1000);
    }
}

function checkWin() {
    if (marked.size >= 5) {
        endGame(true);
    }
}

// ----- TIMER -----
function startTimer() {
    if (timerInterval) clearInterval(timerInterval);
    
    timerInterval = setInterval(() => {
        if (gameOver) {
            clearInterval(timerInterval);
            return;
        }
        
        timeLeft--;
        timerEl.textContent = timeLeft;
        
        // Visual feedback when time is low
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
        
        // Auto-save game state every 5 seconds
        if (timeLeft % 5 === 0) {
            saveGameState();
        }
    }, 1000);
}

// ----- END GAME -----
function endGame(isWin) {
    if (gameOver) return;
    
    gameOver = true;
    clearInterval(timerInterval);
    
    // Play sound
    playSound(isWin ? winSound : loseSound);
    
    // Update UI
    if (isWin) {
        statusEl.textContent = "🏆 VICTORY! 🏆";
        statusEl.className = "status-win";
        
        // Victory celebration effect
        celebrateVictory();
    } else {
        statusEl.textContent = "❌ GAME OVER ❌";
        statusEl.className = "status-lose";
    }
    
    // Enable submit button
    submitBtn.disabled = false;
    submitBtn.style.opacity = "1";
    
    // Clear saved state
    localStorage.removeItem('skillBingoState');
    
    // Show result summary
    setTimeout(() => {
        showToast(isWin ? `You won with ${timeLeft}s remaining!` : "Time's up! Try again.", isWin ? "success" : "error");
    }, 500);
}

function celebrateVictory() {
    // Create confetti effect
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
            
            // Remove confetti after animation
            setTimeout(() => confetti.remove(), 2000);
        }, i * 50);
    }
    
    // Add CSS for confetti
    if (!document.querySelector('#confetti-style')) {
        const style = document.createElement('style');
        style.id = 'confetti-style';
        style.textContent = `
            @keyframes confettiFall {
                0% {
                    transform: translateY(0) rotate(0deg);
                    opacity: 1;
                }
                100% {
                    transform: translateY(100vh) rotate(360deg);
                    opacity: 0;
                }
            }
        `;
        document.head.appendChild(style);
    }
}

// ----- GAME DATA HANDLING -----
function signResult(data) {
    // Simple hash function for demo
    // In production, use proper HMAC from your server
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
    
    const isWin = marked.size >= 5;
    
    const payload = {
        result: isWin ? "WIN" : "LOSE",
        time: timeLeft,
        marks: marked.size,
        mode: gameMode,
        score: score,
        timestamp: Date.now(),
        user_id: tg.initDataUnsafe?.user?.id || "unknown"
    };
    
    // Add signature
    payload.sig = signResult(payload);
    
    try {
        // Show sending state
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sending...';
        submitBtn.disabled = true;
        
        // Send to Telegram bot
        await tg.sendData(JSON.stringify(payload));
        
        // Success feedback
        submitBtn.innerHTML = '<i class="fas fa-check"></i> Sent!';
        showToast("Score submitted successfully!", "success");
        
        // Close after delay
        setTimeout(() => {
            tg.close();
        }, 2000);
        
    } catch (error) {
        console.error('Failed to send game data:', error);
        
        // Error feedback
        submitBtn.innerHTML = '<i class="fas fa-paper-plane"></i> Submit Score';
        submitBtn.disabled = false;
        showToast("Failed to submit score. Try again.", "error");
    }
}

// ----- GAME CONTROLS -----
function restartGame() {
    if (!gameOver && marked.size > 0) {
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
    // Clear game state
    marked.clear();
    currentTarget = null;
    timeLeft = 30;
    score = 0;
    gameOver = false;
    
    // Reset UI
    timerEl.textContent = timeLeft;
    scoreEl.textContent = score;
    timerEl.style.background = 'linear-gradient(45deg, #ef4444, #f59e0b)';
    timerEl.style.animation = 'pulse 2s infinite';
    statusEl.textContent = "Tap the number: ";
    statusEl.className = "";
    targetNumberEl.textContent = "0";
    submitBtn.disabled = true;
    submitBtn.style.opacity = "0.5";
    submitBtn.innerHTML = '<i class="fas fa-paper-plane"></i> Submit Score';
    
    // Regenerate grid
    generateGrid();
    nextTarget();
    
    // Restart timer
    if (timerInterval) clearInterval(timerInterval);
    startTimer();
    
    // Clear any victory effects
    document.querySelectorAll('.cell.active').forEach(cell => {
        cell.classList.remove('active');
    });
    
    showToast("Game restarted!", "success");
}

// ----- ERROR HANDLING -----
window.addEventListener('error', function(event) {
    console.error('Global error:', event.error);
    showToast("Game error occurred. Restarting...", "error");
    
    // Try to recover after error
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

// Start the game when DOM is loaded
document.addEventListener('DOMContentLoaded', initializeGame);

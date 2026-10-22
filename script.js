
const dino = document.getElementById("dino");
const game = document.getElementById("game");
const scoreDisplay = document.getElementById("score");
const startScreen = document.getElementById("start-screen");
const gameOverScreen = document.getElementById("game-over");
const finalScore = document.getElementById("final-score");
const startButton = document.getElementById("start-button");
const restartButton = document.getElementById("restart-button");
const jumpButton = document.getElementById("jump-button");

let running = false;
let jumping = false;
let score = 0;
let speed = 5;
let obstacles = [];
let animationId = null;
let lastObstacleTime = 0;
let lastFrameTime = 0;
let jumpVelocity = 0;
let dinoY = 0;
let highScore = 0;

try {
  highScore = Number(localStorage.getItem("trexHighScore")) || 0;
} catch {
  highScore = 0;
}

function updateScore() {
  scoreDisplay.textContent = `Score: ${score} | Best: ${highScore}`;
}

function jump() {
  if (!running || jumping) return;

  jumping = true;
  jumpVelocity = 12;
}

function createObstacle() {
  const obstacle = document.createElement("div");
  obstacle.textContent = "🌵";
  obstacle.setAttribute("aria-label", "Cactus obstacle");

  Object.assign(obstacle.style, {
    position: "absolute",
    left: `${game.clientWidth}px`,
    bottom: "25px",
    fontSize: "36px",
    lineHeight: "1",
    zIndex: "2"
  });

  game.appendChild(obstacle);

  obstacles.push({
    element: obstacle,
    x: game.clientWidth,
    passed: false
  });
}

function startGame() {
  if (animationId !== null) {
    cancelAnimationFrame(animationId);
  }

  obstacles.forEach(obstacle => obstacle.element.remove());
  obstacles = [];

  running = true;
  jumping = false;
  score = 0;
  speed = 5;
  dinoY = 0;
  jumpVelocity = 0;
  lastObstacleTime = 0;
  lastFrameTime = 0;

  dino.style.bottom = "35px";
  dino.style.transform = "rotate(0deg)";

  startScreen.hidden = true;
  gameOverScreen.hidden = true;

  updateScore();
  animationId = requestAnimationFrame(gameLoop);
}

function endGame() {
  running = false;

  if (animationId !== null) {
    cancelAnimationFrame(animationId);
    animationId = null;
  }

  if (score > highScore) {
    highScore = score;

    try {
      localStorage.setItem("trexHighScore", String(highScore));
    } catch {
      // The game still works if storage is unavailable.
    }
  }

  updateScore();
  finalScore.textContent = `Your score: ${score} | Best: ${highScore}`;
  gameOverScreen.hidden = false;
}

function gameLoop(timestamp) {
  if (!running) return;

  const delta = lastFrameTime
    ? Math.min((timestamp - lastFrameTime) / 16.67, 2)
    : 1;

  lastFrameTime = timestamp;

  // Dinosaur jumping physics
  if (jumping) {
    dinoY += jumpVelocity * delta;
    jumpVelocity -= 0.65 * delta;

    if (dinoY <= 0) {
      dinoY = 0;
      jumping = false;
      jumpVelocity = 0;
    }

    dino.style.bottom = `${35 + dinoY}px`;
  }

  // Increase the difficulty gradually
  speed = Math.min(5 + score / 100, 12);

  // Spawn obstacles with a random interval
  if (
    !lastObstacleTime ||
    timestamp - lastObstacleTime > 1200 + Math.random() * 500
  ) {
    createObstacle();
    lastObstacleTime = timestamp;
  }

  const dinoRect = dino.getBoundingClientRect();

  for (let i = obstacles.length - 1; i >= 0; i--) {
    const obstacle = obstacles[i];

    obstacle.x -= speed * delta;
    obstacle.element.style.left = `${obstacle.x}px`;

    const rect = obstacle.element.getBoundingClientRect();

    // Slightly forgiving collision boxes
    const hit =
      dinoRect.right - 12 > rect.left + 8 &&
      dinoRect.left + 12 < rect.right - 8 &&
      dinoRect.bottom - 8 > rect.top + 5 &&
      dinoRect.top + 8 < rect.bottom - 5;

    if (hit) {
      endGame();
      return;
    }

    if (!obstacle.passed && rect.right < dinoRect.left) {
      obstacle.passed = true;
      score += 10;
      updateScore();
    }

    if (obstacle.x < -60) {
      obstacle.element.remove();
      obstacles.splice(i, 1);
    }
  }

  animationId = requestAnimationFrame(gameLoop);
}

// Keyboard controls
document.addEventListener("keydown", event => {
  if (
    event.code === "Space" ||
    event.code === "ArrowUp"
  ) {
    event.preventDefault();

    if (!running) {
      startGame();
    } else {
      jump();
    }
  }
});

// Button controls
startButton.addEventListener("click", startGame);
restartButton.addEventListener("click", startGame);
jumpButton.addEventListener("click", jump);

// Tap the game area to jump on mobile
game.addEventListener("pointerdown", event => {
  if (
    event.target.closest("button") ||
    event.target.closest("#start-screen") ||
    event.target.closest("#game-over")
  ) {
    return;
  }

  jump();
});

updateScore();

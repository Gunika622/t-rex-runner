
const canvas = document.getElementById("game-canvas");
const ctx = canvas.getContext("2d");

const overlay = document.getElementById("overlay");
const overlayTitle = document.getElementById("overlay-title");
const overlayMessage = document.getElementById("overlay-message");
const playButton = document.getElementById("play-button");

const scoreDisplay = document.getElementById("score");
const bestDisplay = document.getElementById("best-score");
const aiStatus = document.getElementById("ai-status");
const jumpButton = document.getElementById("jump-button");
const soundToggle = document.getElementById("sound-toggle");
const weatherLabel = document.getElementById("weather-label");

const W = canvas.width;
const H = canvas.height;
const GROUND = 278;

let running = false;
let gameOver = false;
let score = 0;
let best = 0;
let speed = 330;
let elapsed = 0;
let spawnTimer = 0;
let lastTime = 0;
let animationId = null;
let obstacles = [];
let particles = [];
let isNight = false;
let soundOn = true;
let audioContext = null;

const dino = {
  x: 105,
  y: GROUND - 52,
  w: 44,
  h: 52,
  vy: 0,
  jumping: false,
  frame: 0
};

try {
  best = Number(localStorage.getItem("trexHighScore")) || 0;
} catch {
  best = 0;
}

function updateUI() {
  scoreDisplay.textContent = String(score).padStart(5, "0");
  bestDisplay.textContent = String(best).padStart(5, "0");

  if (score < 100) {
    aiStatus.textContent = "Learning";
  } else if (score < 300) {
    aiStatus.textContent = "Adapting";
  } else {
    aiStatus.textContent = "Pro Mode";
  }
}

function beep(frequency = 500, duration = 0.08) {
  if (!soundOn) return;

  try {
    audioContext ??= new (
      window.AudioContext || window.webkitAudioContext
    )();

    if (audioContext.state === "suspended") {
      audioContext.resume();
    }

    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();

    oscillator.type = "square";
    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(0.045, audioContext.currentTime);
    gain.gain.exponentialRampToValueAtTime(
      0.001,
      audioContext.currentTime + duration
    );

    oscillator.connect(gain);
    gain.connect(audioContext.destination);
    oscillator.start();
    oscillator.stop(audioContext.currentTime + duration);
  } catch {
    // Sound is optional.
  }
}

function roundedRect(x, y, w, h, r, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.fill();
}

function drawBackground() {
  const sky = ctx.createLinearGradient(0, 0, 0, H);

  if (isNight) {
    sky.addColorStop(0, "#10172f");
    sky.addColorStop(1, "#26385a");
  } else {
    sky.addColorStop(0, "#b9efff");
    sky.addColorStop(1, "#f1fbff");
  }

  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, H);

  // Sun or moon
  ctx.fillStyle = isNight ? "#f4f0c5" : "#ffd166";
  ctx.beginPath();
  ctx.arc(770, 68, 25, 0, Math.PI * 2);
  ctx.fill();

  if (isNight) {
    ctx.fillStyle = "#10172f";
    ctx.beginPath();
    ctx.arc(781, 58, 22, 0, Math.PI * 2);
    ctx.fill();

    // Stars
    for (let i = 0; i < 35; i++) {
      const x = (i * 137 + 23) % W;
      const y = (i * 53 + 17) % 175;

      ctx.fillStyle = "#ffffff";
      ctx.fillRect(x, y, 2, 2);
    }
  } else {
    // Pixel clouds
    ctx.fillStyle = "rgba(255,255,255,0.8)";

    for (let i = 0; i < 4; i++) {
      const x = ((i * 260 - elapsed * 12) % 1100 + 1100) % 1100 - 100;
      const y = 65 + (i % 2) * 48;

      ctx.fillRect(x, y, 65, 16);
      ctx.fillRect(x + 15, y - 12, 35, 12);
    }
  }

  // Distant pixel hills
  ctx.fillStyle = isNight ? "#293a56" : "#b4e3b0";

  for (let i = 0; i < 7; i++) {
    const x = i * 155 - ((elapsed * 20) % 155);

    ctx.beginPath();
    ctx.moveTo(x, GROUND);
    ctx.lineTo(x + 78, 170 + (i % 3) * 18);
    ctx.lineTo(x + 160, GROUND);
    ctx.fill();
  }

  // Ground
  ctx.fillStyle = isNight ? "#91a6c6" : "#526c49";
  ctx.fillRect(0, GROUND, W, 4);

  ctx.fillStyle = isNight ? "#344564" : "#b5a477";
  ctx.fillRect(0, GROUND + 4, W, H - GROUND);

  ctx.fillStyle = isNight ? "#7187a9" : "#8b7957";

  for (let i = 0; i < 28; i++) {
    const x = ((i * 47 - elapsed * speed * 0.5) % W + W) % W;
    ctx.fillRect(x, GROUND + 16 + (i % 3) * 10, 12, 3);
  }
}

function drawDino() {
  const x = dino.x;
  const y = dino.y;
  const dark = "#173d38";
  const green = "#39d98a";
  const light = "#8affc1";

  // Tail
  ctx.fillStyle = green;
  ctx.fillRect(x - 10, y + 25, 13, 10);
  ctx.fillRect(x - 15, y + 20, 8, 10);

  // Body and head
  ctx.fillRect(x + 3, y + 18, 28, 28);
  ctx.fillRect(x + 15, y + 3, 29, 26);
  ctx.fillRect(x + 29, y + 15, 18, 10);

  // Belly
  ctx.fillStyle = light;
  ctx.fillRect(x + 12, y + 32, 15, 10);

  // Eye
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(x + 35, y + 8, 6, 7);
  ctx.fillStyle = dark;
  ctx.fillRect(x + 39, y + 10, 3, 4);

  // Legs animate while running
  ctx.fillStyle = green;

  if (!dino.jumping) {
    const step = Math.floor(elapsed * 12) % 2;

    ctx.fillRect(x + 7, y + 42, 9, step ? 10 : 6);
    ctx.fillRect(x + 24, y + 42, 9, step ? 6 : 10);
  } else {
    ctx.fillRect(x + 7, y + 42, 9, 8);
    ctx.fillRect(x + 24, y + 42, 9, 8);
  }

  // Pixel outline details
  ctx.fillStyle = dark;
  ctx.fillRect(x + 17, y + 26, 3, 3);
}

function drawCactus(o) {
  const x = o.x;
  const y = GROUND - o.h;
  const green = "#23a765";
  const dark = "#126b4b";
  const light = "#83f0a9";

  ctx.fillStyle = dark;
  ctx.fillRect(x + 5, y, o.w - 5, o.h);

  ctx.fillStyle = green;
  ctx.fillRect(x, y + 4, o.w - 7, o.h - 4);
  ctx.fillRect(x - 9, y + 18, 10, 7);
  ctx.fillRect(x - 9, y + 11, 7, 13);
  ctx.fillRect(x + o.w - 7, y + 27, 10, 7);
  ctx.fillRect(x + o.w, y + 20, 7, 14);

  ctx.fillStyle = light;

  for (let py = y + 9; py < GROUND - 8; py += 13) {
    ctx.fillRect(x + 5, py, 3, 6);
  }
}

function drawBird(o) {
  const flap = Math.sin(elapsed * 15) * 9;
  const x = o.x;
  const y = o.y;

  ctx.fillStyle = isNight ? "#f6c8ff" : "#6746bd";

  // Body, wings and beak
  ctx.fillRect(x, y, 27, 9);
  ctx.fillRect(x + 6, y - 5 - flap * 0.35, 12, 7);
  ctx.fillRect(x + 9, y - 12 - flap, 7, 8);
  ctx.fillRect(x + 24, y + 3, 9, 4);

  // Eye
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(x + 20, y + 1, 3, 3);
}

function spawnObstacle() {
  const bird = score >= 50 && Math.random() < 0.32;

  if (bird) {
    const heights = [GROUND - 100, GROUND - 135];

    obstacles.push({
      type: "bird",
      x: W + 20,
      y: heights[Math.floor(Math.random() * heights.length)],
      w: 34,
      h: 22,
      passed: false
    });
  } else {
    const tall = Math.random() < 0.3;

    obstacles.push({
      type: "cactus",
      x: W + 20,
      y: 0,
      w: tall ? 30 : 23,
      h: tall ? 58 : 42,
      passed: false
    });
  }
}

function jump() {
  if (!running || dino.jumping) return;

  dino.jumping = true;
  dino.vy = -660;

  beep(620, 0.07);
}

function addParticles(x, y) {
  for (let i = 0; i < 12; i++) {
    particles.push({
      x,
      y,
      vx: (Math.random() - 0.5) * 180,
      vy: -Math.random() * 160,
      life: 0.5
    });
  }
}

function drawParticles(dt) {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];

    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vy += 300 * dt;
    p.life -= dt;

    ctx.globalAlpha = Math.max(0, p.life * 2);
    ctx.fillStyle = "#ffd166";
    ctx.fillRect(p.x, p.y, 5, 5);
    ctx.globalAlpha = 1;

    if (p.life <= 0) particles.splice(i, 1);
  }
}

function collides(a, b) {
  const bx = b.x + (b.type === "bird" ? 3 : 1);
  const by = b.type === "bird" ? b.y - 2 : GROUND - b.h + 4;
  const bw = b.w - 6;
  const bh = b.type === "bird" ? b.h - 3 : b.h - 4;

  return (
    a.x + 8 < bx + bw &&
    a.x + a.w - 5 > bx &&
    a.y + 7 < by + bh &&
    a.y + a.h - 4 > by
  );
}

function endGame() {
  if (!running) return;

  running = false;
  gameOver = true;

  if (animationId !== null) {
    cancelAnimationFrame(animationId);
    animationId = null;
  }

  addParticles(dino.x + 20, dino.y + 20);

  if (score > best) {
    best = score;

    try {
      localStorage.setItem("trexHighScore", String(best));
    } catch {
      // High score storage may be unavailable.
    }
  }

  updateUI();

  overlayTitle.textContent = "Game Over!";
  overlayMessage.textContent =
    `You scored ${score} points. Ready for another run?`;
  playButton.textContent = "↻ Run again";

  overlay.hidden = false;
  beep(180, 0.25);

  drawFrame();
}

function startGame() {
  if (animationId !== null) {
    cancelAnimationFrame(animationId);
    animationId = null;
  }

  score = 0;
  speed = 330;
  elapsed = 0;
  spawnTimer = 0.9;
  lastTime = 0;

  obstacles = [];
  particles = [];

  dino.y = GROUND - dino.h;
  dino.vy = 0;
  dino.jumping = false;

  running = true;
  gameOver = false;

  overlay.hidden = true;
  overlayTitle.textContent = "Ready, Dino?";
  playButton.textContent = "▶ Start running";

  updateUI();
  drawFrame();

  animationId = requestAnimationFrame(gameLoop);
}

function drawFrame() {
  drawBackground();

  for (const o of obstacles) {
    if (o.type === "bird") {
      drawBird(o);
    } else {
      drawCactus(o);
    }
  }

  drawDino();
  drawParticles(0);
}

function gameLoop(timestamp) {
  if (!running) return;

  const dt = lastTime
    ? Math.min((timestamp - lastTime) / 1000, 0.035)
    : 0.016;

  lastTime = timestamp;
  elapsed += dt;

  // Gradually increase difficulty.
  speed = Math.min(330 + score * 1.15, 650);

  // Change from day to night every 18 seconds.
  isNight = Math.floor(elapsed / 18) % 2 === 1;
  weatherLabel.textContent = isNight
    ? "🌙 NIGHT MODE"
    : "☀️ DAY MODE";

  // Dinosaur physics.
  if (dino.jumping) {
    dino.y += dino.vy * dt;
    dino.vy += 1750 * dt;

    if (dino.y >= GROUND - dino.h) {
      dino.y = GROUND - dino.h;
      dino.vy = 0;
      dino.jumping = false;
    }
  }

  // Obstacle spawning.
  spawnTimer -= dt;

  if (spawnTimer <= 0) {
    spawnObstacle();

    const baseDelay = Math.max(0.85, 1.45 - score / 1500);
    spawnTimer = baseDelay + Math.random() * 0.65;
  }

  const dinoBox = {
    x: dino.x,
    y: dino.y,
    w: dino.w,
    h: dino.h
  };

  for (let i = obstacles.length - 1; i >= 0; i--) {
    const o = obstacles[i];
    o.x -= speed * dt;

    if (collides(dinoBox, o)) {
      endGame();
      return;
    }

    if (!o.passed && o.x + o.w < dino.x) {
      o.passed = true;
      score += 10;
      updateUI();

      if (score % 50 === 0) beep(820, 0.06);
    }

    if (o.x + o.w < -20) {
      obstacles.splice(i, 1);
    }
  }

  drawBackground();

  for (const o of obstacles) {
    if (o.type === "bird") {
      drawBird(o);
    } else {
      drawCactus(o);
    }
  }

  drawDino();
  drawParticles(dt);

  animationId = requestAnimationFrame(gameLoop);
}

// Keyboard controls.
document.addEventListener("keydown", event => {
  if (event.code === "Space" || event.code === "ArrowUp") {
    event.preventDefault();

    if (!running) {
      startGame();
    } else {
      jump();
    }
  }
});

// Game buttons.
playButton.addEventListener("click", startGame);
jumpButton.addEventListener("click", jump);

soundToggle.addEventListener("click", () => {
  soundOn = !soundOn;

  soundToggle.textContent = soundOn
    ? "🔊 Sound ON"
    : "🔇 Sound OFF";

  soundToggle.setAttribute("aria-pressed", String(soundOn));

  if (soundOn) beep(600, 0.08);
});

// Mobile: tap the canvas to jump.
canvas.addEventListener("pointerdown", event => {
  event.preventDefault();

  if (!running) {
    startGame();
  } else {
    jump();
  }
});

// Set up the first screen.
updateUI();
drawFrame();

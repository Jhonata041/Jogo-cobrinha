// ---------- ELEMENTOS DOM ----------
const bubbleContainer = document.querySelector('.bubbles');
const startBtn = document.getElementById('startBtn');
const scoreAElement = document.getElementById('scoreA');
const scoreBElement = document.getElementById('scoreB');
const timerElement = document.getElementById('timer');
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// ---------- VARIÁVEIS PRINCIPAIS ----------
let running = false; 
let scoreA = 0, scoreB = 0;
let snakeA = [], snakeB = [];
let dirA = { x: 0, y: 0 }, dirB = { x: 0, y: 0 };
let food = null;
let buffs = [];
let timeLeft = 180; // 3 minutos
let bubbleCount = 0;

// ---------- CONFIGURAÇÕES ----------
const GRID = 20;
const BASE_SPEED = 120;
const BUFF_SPAWN_INTERVAL = 5000; // novo: spawn a cada 5s
const BUFF_LIFETIME = 5000;       // buff some após 5s se não pegarem

// ---------- TIPOS DE BUFFS (sem escudo) ----------
const BUFF_TYPES = [
  { id: 'speed', icon: '⚡' },
  { id: 'super', icon: '⭐' },
  { id: 'slow', icon: '❄️' },
  { id: 'invert', icon: '🔄' }
];

// Estados individuais por jogador
const stateA = { invertUntil: 0, slowUntil: 0, speedUntil: 0 };
const stateB = { invertUntil: 0, slowUntil: 0, speedUntil: 0 };

// ---------- AJUSTE DE CANVAS ----------
function resizeCanvas() {
  canvas.width = Math.floor(window.innerWidth * 0.88 / GRID) * GRID;
  canvas.height = Math.floor(window.innerHeight * 0.72 / GRID) * GRID;
}
resizeCanvas();
window.addEventListener('resize', () => { if (!running) drawAll(); });

// ---------- FUNÇÕES UTILITÁRIAS ----------
function rndInt(max) { return Math.floor(Math.random() * max); }
function now() { return Date.now(); }
function randomGridPosition() {
  const cols = canvas.width / GRID, rows = canvas.height / GRID;
  let pos;
  do {
    pos = { x: rndInt(cols), y: rndInt(rows) };
  } while (
    snakeA.some(s => s.x === pos.x && s.y === pos.y) ||
    snakeB.some(s => s.x === pos.x && s.y === pos.y) ||
    (food && food.x === pos.x && food.y === pos.y) ||
    buffs.some(b => b.x === pos.x && b.y === pos.y)
  );
  return pos;
}

// ---------- COMIDA ----------
function placeFood() { food = randomGridPosition(); }

// ---------- BUFFS ----------
function spawnBuff() {
  const type = BUFF_TYPES[rndInt(BUFF_TYPES.length)];
  const pos = randomGridPosition();
  const buff = { id: `${type.id}-${Date.now()}`, type: type.id, icon: type.icon, x: pos.x, y: pos.y };
  buffs.push(buff);
  setTimeout(() => { buffs = buffs.filter(b => b.id !== buff.id); }, BUFF_LIFETIME);
}
setInterval(() => { if (running) spawnBuff(); }, BUFF_SPAWN_INTERVAL);

// ---------- MOVIMENTO ----------
function getPlayerInterval(state) {
  let base = BASE_SPEED;
  if (now() < state.slowUntil) base += 60;
  if (now() < state.speedUntil) base = Math.max(40, base - 60);
  return base;
}

// Aplica buffs
function applyBuff(type, player) {
  const me = (player === 'A') ? stateA : stateB;
  const other = (player === 'A') ? stateB : stateA;
  const snake = (player === 'A') ? snakeA : snakeB;

  if (type === 'speed') me.speedUntil = now() + 6000;
  if (type === 'super') {
    if (player === 'A') scoreA += 3; else scoreB += 3;
    snake.push({ ...snake[snake.length - 1] }, { ...snake[snake.length - 1] });
    updateScores();
  }
  if (type === 'slow') other.slowUntil = now() + 6000;
  if (type === 'invert') other.invertUntil = now() + 5000;
}

// Checar coleta
function checkPickup(player, head) {
  if (food && head.x === food.x && head.y === food.y) {
    if (player === 'A') { scoreA++; snakeA.push({ ...snakeA[snakeA.length - 1] }); }
    else { scoreB++; snakeB.push({ ...snakeB[snakeB.length - 1] }); }
    placeFood();
    updateScores();
    updateBubblesCount();
  }
  buffs = buffs.filter(b => {
    if (b.x === head.x && b.y === head.y) { applyBuff(b.type, player); return false; }
    return true;
  });
}

// ---------- COLISÃO ----------
function wouldCollide(player, head) {
  const snake = (player === 'A') ? snakeA : snakeB;
  const cols = canvas.width / GRID, rows = canvas.height / GRID;
  if (head.x < 0 || head.x >= cols || head.y < 0 || head.y >= rows) return true;
  return snake.some((s, i) => i !== 0 && s.x === head.x && s.y === head.y);
}

// ---------- LOOP PRINCIPAL ----------
let lastTs = now(), accA = 0, accB = 0;
function gameLoop() {
  if (!running) return;
  const nowTs = now(), delta = nowTs - lastTs;
  accA += delta; accB += delta;
  if (accA >= getPlayerInterval(stateA)) { accA = 0; stepPlayer('A'); }
  if (accB >= getPlayerInterval(stateB)) { accB = 0; stepPlayer('B'); }
  drawAll();
  lastTs = nowTs;
  requestAnimationFrame(gameLoop);
}

function stepPlayer(player) {
  const snake = (player === 'A') ? snakeA : snakeB;
  const dir = (player === 'A') ? dirA : dirB;
  if (dir.x === 0 && dir.y === 0) return;
  const head = { x: snake[0].x + dir.x, y: snake[0].y + dir.y };
  if (wouldCollide(player, head)) { endGame(`Cobra ${player} perdeu`); return; }
  snake.unshift(head);
  checkPickup(player, head);
  if (!(food && head.x === food.x && head.y === food.y)) snake.pop();
}

// ---------- DESENHO ----------
function drawAll() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#0c0c0d';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  if (food) { ctx.fillStyle = 'gold'; ctx.fillRect(food.x*GRID,food.y*GRID,GRID,GRID); }
  for (const b of buffs) {
    ctx.font = `${GRID-2}px serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(b.icon, b.x*GRID+GRID/2, b.y*GRID+GRID/2+2);
  }
  ctx.fillStyle = '#61dafb'; snakeA.forEach(s => ctx.fillRect(s.x*GRID,s.y*GRID,GRID,GRID));
  ctx.fillStyle = '#ff6f61'; snakeB.forEach(s => ctx.fillRect(s.x*GRID,s.y*GRID,GRID,GRID));
}

// ---------- INPUT ----------
function changeDirection(e) {
  const invA = now() < stateA.invertUntil;
  const invB = now() < stateB.invertUntil;

  // Jogador A
  let newDirA = { ...dirA };
  if (e.key === 'w') newDirA = invA ? {x:0,y:1} : {x:0,y:-1};
  if (e.key === 's') newDirA = invA ? {x:0,y:-1} : {x:0,y:1};
  if (e.key === 'a') newDirA = invA ? {x:1,y:0} : {x:-1,y:0};
  if (e.key === 'd') newDirA = invA ? {x:-1,y:0} : {x:1,y:0};
  // não permite movimento oposto se a cobra tiver mais de 1 segmento
  if (snakeA.length === 1 || (newDirA.x !== -dirA.x && newDirA.y !== -dirA.y)) dirA = newDirA;

  // Jogador B
  let newDirB = { ...dirB };
  if (e.key === 'ArrowUp') newDirB = invB ? {x:0,y:1} : {x:0,y:-1};
  if (e.key === 'ArrowDown') newDirB = invB ? {x:0,y:-1} : {x:0,y:1};
  if (e.key === 'ArrowLeft') newDirB = invB ? {x:1,y:0} : {x:-1,y:0};
  if (e.key === 'ArrowRight') newDirB = invB ? {x:-1,y:0} : {x:1,y:0};
  if (snakeB.length === 1 || (newDirB.x !== -dirB.x && newDirB.y !== -dirB.y)) dirB = newDirB;
}


// ---------- SCORES ----------
function updateScores() {
  scoreAElement.innerText = `Cobra Azul: ${scoreA}`;
  scoreBElement.innerText = `Cobra Vermelha: ${scoreB}`;
}

// ---------- TIMER ----------
let timerHandle;
function startTimer() {
  timeLeft = 180; updateTimer();
  timerHandle = setInterval(() => {
    timeLeft--; updateTimer();
    if (timeLeft <= 0) { clearInterval(timerHandle); endGameByTime(); }
  }, 1000);
}
function updateTimer() {
  const m = String(Math.floor(timeLeft/60)).padStart(2,'0');
  const s = String(timeLeft%60).padStart(2,'0');
  timerElement.innerText = `Tempo: ${m}:${s}`;
}

// ---------- START/END ----------
function startGame() {
  running = true; scoreA = scoreB = 0;
  snakeA = [randomGridPosition()]; snakeB = [randomGridPosition()];
  dirA = {x:0,y:0}; dirB = {x:0,y:0}; buffs = [];
  placeFood(); updateScores(); updateBubblesCount();
  startBtn.style.display = 'none';
  lastTs = now(); requestAnimationFrame(gameLoop);
  startTimer(); window.addEventListener('keydown', changeDirection);
}
function endGame(msg) {
  running = false; clearInterval(timerHandle);
  alert(`${msg}\nPlacar Final:\nCobra Azul: ${scoreA} | Cobra Vermelha: ${scoreB}`);
  resetGame();
}
function endGameByTime() {
  running = false;
  const winner = scoreA>scoreB?'Cobra Azul venceu!':scoreB>scoreA?'Cobra Vermelha venceu!':'Empate!';
  alert(`⏰ Tempo esgotado!\n${winner}\nPlacar Final:\nCobra Azul: ${scoreA} | Cobra Vermelha: ${scoreB}`);
  resetGame();
}
function resetGame() { buffs = []; bubbleContainer.innerHTML=''; startBtn.style.display='inline-block'; drawAll(); }

// ---------- BOLHAS DE FUNDO ----------
function spawnBubble() { const b = document.createElement('div'); b.className='bubble'; const size=10+Math.random()*20; b.style.width=`${size}px`; b.style.height=`${size}px`; b.style.left=`${Math.random()*window.innerWidth}px`; bubbleContainer.appendChild(b); b.addEventListener('animationend',()=>b.remove()); }
setInterval(()=>{if(running)spawnBubble();},600);
function updateBubblesCount(){while(bubbleCount<scoreA+scoreB){spawnBubble();bubbleCount++;}}

// ---------- INIT ----------
startBtn.addEventListener('click', startGame);
drawAll(); updateTimer(); updateScores();

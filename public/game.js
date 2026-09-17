const W = 960;
const H = 600;
const HIGHSCORE_KEY = 'duo-shooter-highscore';
const FIRE_BASE = 0.16;
const BULLET_SPEED = 620;

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const rand = (a, b) => a + Math.random() * (b - a);
const shuffle = (arr) => {
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
};

function roundRect(ctx, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

function circle(ctx, x, y, r) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.closePath();
}

function glowCircle(ctx, x, y, r, color, blur) {
  ctx.save();
  ctx.shadowColor = color;
  ctx.shadowBlur = blur;
  ctx.fillStyle = color;
  circle(ctx, x, y, r);
  ctx.fill();
  ctx.restore();
}

const CONTROLS = [
  {
    name: 'P1',
    up: 'KeyW',
    down: 'KeyS',
    left: 'KeyA',
    right: 'KeyD',
    fire: ['Space'],
    color: '#38bdf8',
    aim: { x: 1, y: 0 },
  },
  {
    name: 'P2',
    up: 'ArrowUp',
    down: 'ArrowDown',
    left: 'ArrowLeft',
    right: 'ArrowRight',
    fire: ['Enter', 'Numpad0'],
    color: '#fb923c',
    aim: { x: -1, y: 0 },
  },
];

const PREVENT_KEYS = new Set([
  'ArrowUp',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
  'Space',
  'Enter',
  'Numpad0',
]);

class Input {
  constructor() {
    this.keys = new Set();
    this.pressed = new Set();
    window.addEventListener('keydown', (event) => {
      if (PREVENT_KEYS.has(event.code)) event.preventDefault();
      if (!this.keys.has(event.code)) this.pressed.add(event.code);
      this.keys.add(event.code);
    });
    window.addEventListener('keyup', (event) => {
      this.keys.delete(event.code);
    });
    window.addEventListener('blur', () => this.keys.clear());
  }

  isDown(code) {
    return this.keys.has(code);
  }

  justPressed(code) {
    return this.pressed.has(code);
  }

  endFrame() {
    this.pressed.clear();
  }
}

class Sfx {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.muted = false;
  }

  ensure() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.22;
      this.master.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
  }

  tone({ freq, dur = 0.1, type = 'square', vol = 0.2, slide = 0, delay = 0 }) {
    if (this.muted) return;
    this.ensure();
    if (!this.ctx || !this.master) return;
    const t0 = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t0 + dur);
    gain.gain.setValueAtTime(vol, t0);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(gain);
    gain.connect(this.master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.03);
  }

  shoot() {
    this.tone({ freq: 760, dur: 0.06, type: 'square', vol: 0.09, slide: -360 });
  }

  enemyShoot() {
    this.tone({ freq: 260, dur: 0.12, type: 'sawtooth', vol: 0.08, slide: -140 });
  }

  hit() {
    this.tone({ freq: 300, dur: 0.05, type: 'triangle', vol: 0.08, slide: -120 });
  }

  explode() {
    this.tone({ freq: 170, dur: 0.22, type: 'sawtooth', vol: 0.14, slide: -110 });
  }

  hurt() {
    this.tone({ freq: 190, dur: 0.2, type: 'square', vol: 0.14, slide: -110 });
  }

  powerup() {
    this.tone({ freq: 520, dur: 0.1, type: 'sine', vol: 0.16, slide: 320 });
    this.tone({ freq: 820, dur: 0.14, type: 'sine', vol: 0.13, delay: 0.07 });
  }

  wave() {
    this.tone({ freq: 440, dur: 0.14, type: 'square', vol: 0.13 });
    this.tone({ freq: 660, dur: 0.2, type: 'square', vol: 0.11, delay: 0.12 });
  }

  gameover() {
    this.tone({ freq: 320, dur: 0.3, type: 'sawtooth', vol: 0.15, slide: -160 });
    this.tone({ freq: 160, dur: 0.7, type: 'sawtooth', vol: 0.15, slide: -80, delay: 0.24 });
  }
}

class Particle {
  constructor(x, y, color, speed) {
    const angle = rand(0, Math.PI * 2);
    const s = rand(speed * 0.25, speed);
    this.x = x;
    this.y = y;
    this.vx = Math.cos(angle) * s;
    this.vy = Math.sin(angle) * s;
    this.r = rand(1.5, 3.6);
    this.maxLife = rand(0.25, 0.65);
    this.life = this.maxLife;
    this.color = color;
  }

  update(dt) {
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.vx *= 0.94;
    this.vy *= 0.94;
    this.life -= dt;
  }

  draw(ctx) {
    const alpha = Math.max(0, this.life / this.maxLife);
    ctx.globalAlpha = alpha;
    ctx.fillStyle = this.color;
    circle(ctx, this.x, this.y, this.r * alpha);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
}

class FloatingText {
  constructor(x, y, text, color) {
    this.x = x;
    this.y = y;
    this.text = text;
    this.color = color;
    this.maxLife = 1;
    this.life = 1;
  }

  update(dt) {
    this.y -= 34 * dt;
    this.life -= dt;
  }

  draw(ctx) {
    ctx.globalAlpha = Math.max(0, this.life / this.maxLife);
    ctx.fillStyle = this.color;
    ctx.font = '700 18px "Segoe UI", system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(this.text, this.x, this.y);
    ctx.globalAlpha = 1;
  }
}

class Bullet {
  constructor(x, y, vx, vy, options = {}) {
    this.x = x;
    this.y = y;
    this.vx = vx;
    this.vy = vy;
    this.r = options.r ?? 4.5;
    this.damage = options.damage ?? 13;
    this.hostile = options.hostile ?? false;
    this.color = options.color ?? '#ffffff';
    this.life = options.life ?? 1.5;
    this.dead = false;
    this.trail = [];
  }

  update(dt) {
    this.trail.push({ x: this.x, y: this.y });
    if (this.trail.length > 5) this.trail.shift();
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.life -= dt;
    if (this.life <= 0 || this.x < -30 || this.x > W + 30 || this.y < -30 || this.y > H + 30) {
      this.dead = true;
    }
  }

  draw(ctx) {
    for (let i = 0; i < this.trail.length; i += 1) {
      const t = this.trail[i];
      ctx.globalAlpha = ((i + 1) / this.trail.length) * 0.28;
      ctx.fillStyle = this.color;
      circle(ctx, t.x, t.y, this.r * 0.8);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    glowCircle(ctx, this.x, this.y, this.r, this.color, 12);
  }
}

const POWERUPS = {
  heal: { color: '#4ade80', label: '+' },
  rapid: { color: '#facc15', label: '»' },
  spread: { color: '#a78bfa', label: 'W' },
  shield: { color: '#60a5fa', label: 'O' },
};

class Powerup {
  constructor(type, x, y) {
    this.type = type;
    this.x = x;
    this.y = y;
    this.r = 13;
    this.life = 13;
    this.bob = rand(0, Math.PI * 2);
    this.dead = false;
  }

  update(dt) {
    this.bob += dt * 3;
    this.life -= dt;
    if (this.life <= 0) this.dead = true;
  }

  draw(ctx) {
    const info = POWERUPS[this.type];
    if (this.life < 3 && Math.floor(this.life * 8) % 2 === 0) return;
    const size = this.r * 2;
    const y = this.y + Math.sin(this.bob) * 3;
    ctx.save();
    ctx.shadowColor = info.color;
    ctx.shadowBlur = 16;
    ctx.fillStyle = 'rgba(8,12,22,0.9)';
    roundRect(ctx, this.x - size / 2, y - size / 2, size, size, 6);
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = info.color;
    ctx.stroke();
    ctx.restore();
    ctx.fillStyle = info.color;
    ctx.font = '800 15px "Segoe UI", system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(info.label, this.x, y + 1);
    ctx.textBaseline = 'alphabetic';
  }
}

class Player {
  constructor(index, x, y) {
    this.controls = CONTROLS[index];
    this.index = index;
    this.name = this.controls.name;
    this.color = this.controls.color;
    this.spawn = { x, y };
    this.r = 16;
    this.maxHp = 100;
    this.speed = 270;
    this.baseAim = this.controls.aim;
    this.reset();
  }

  reset() {
    this.x = this.spawn.x;
    this.y = this.spawn.y;
    this.hp = this.maxHp;
    this.aim = { ...this.baseAim };
    this.cooldown = 0;
    this.rapid = 0;
    this.spread = 0;
    this.shield = 0;
    this.invuln = 1.5;
    this.downed = false;
    this.moving = false;
  }

  revive() {
    this.x = this.spawn.x;
    this.y = this.spawn.y;
    this.hp = Math.round(this.maxHp * 0.5);
    this.downed = false;
    this.invuln = 2.5;
    this.rapid = 0;
    this.spread = 0;
    this.shield = 0;
  }

  update(dt, input, game) {
    this.invuln = Math.max(0, this.invuln - dt);
    this.rapid = Math.max(0, this.rapid - dt);
    this.spread = Math.max(0, this.spread - dt);
    this.shield = Math.max(0, this.shield - dt);
    this.cooldown = Math.max(0, this.cooldown - dt);
    if (this.downed) return;

    let dx = 0;
    let dy = 0;
    if (input.isDown(this.controls.left)) dx -= 1;
    if (input.isDown(this.controls.right)) dx += 1;
    if (input.isDown(this.controls.up)) dy -= 1;
    if (input.isDown(this.controls.down)) dy += 1;

    if (dx || dy) {
      const len = Math.hypot(dx, dy);
      dx /= len;
      dy /= len;
      this.aim.x = dx;
      this.aim.y = dy;
      this.x = clamp(this.x + dx * this.speed * dt, this.r, W - this.r);
      this.y = clamp(this.y + dy * this.speed * dt, this.r, H - this.r);
      this.moving = true;
    } else {
      this.moving = false;
    }

    if (this.controls.fire.some((code) => input.isDown(code)) && this.cooldown <= 0) {
      this.fire(game);
      this.cooldown = this.rapid > 0 ? FIRE_BASE * 0.45 : FIRE_BASE;
    }
  }

  fire(game) {
    const base = Math.atan2(this.aim.y, this.aim.x);
    const offsets = this.spread > 0 ? [-0.2, 0, 0.2] : [0];
    for (const offset of offsets) {
      const angle = base + offset;
      game.bullets.push(
        new Bullet(
          this.x + Math.cos(angle) * (this.r + 6),
          this.y + Math.sin(angle) * (this.r + 6),
          Math.cos(angle) * BULLET_SPEED,
          Math.sin(angle) * BULLET_SPEED,
          { hostile: false, damage: 13, color: this.color, r: 4.5 },
        ),
      );
    }
    game.sfx.shoot();
  }

  takeDamage(amount, game) {
    if (this.downed || this.invuln > 0 || this.shield > 0) return;
    this.hp -= amount;
    this.invuln = 0.8;
    game.shake = Math.min(16, game.shake + 7);
    game.flash = Math.max(game.flash, 0.18);
    game.sfx.hurt();
    game.spawnParticles(this.x, this.y, this.color, 12, 180);
    if (this.hp <= 0) {
      this.hp = 0;
      this.downed = true;
      game.spawnParticles(this.x, this.y, this.color, 46, 340);
      game.sfx.explode();
    }
  }

  applyPowerup(type, game) {
    if (type === 'heal') this.hp = Math.min(this.maxHp, this.hp + 40);
    if (type === 'rapid') this.rapid = 8;
    if (type === 'spread') this.spread = 9;
    if (type === 'shield') this.shield = 6;
    game.sfx.powerup();
    const info = POWERUPS[type];
    game.texts.push(new FloatingText(this.x, this.y - this.r - 8, info.label, info.color));
  }

  draw(ctx) {
    if (this.downed) {
      ctx.globalAlpha = 0.35;
      ctx.strokeStyle = this.color;
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 4]);
      circle(ctx, this.x, this.y, this.r);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;
      return;
    }

    const blink = this.invuln > 0 && Math.floor(this.invuln * 12) % 2 === 0;
    if (blink) ctx.globalAlpha = 0.35;

    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(Math.atan2(this.aim.y, this.aim.x));

    ctx.save();
    ctx.shadowColor = this.color;
    ctx.shadowBlur = 20;
    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.moveTo(this.r, 0);
    ctx.lineTo(-this.r * 0.75, -this.r * 0.85);
    ctx.lineTo(-this.r * 0.4, 0);
    ctx.lineTo(-this.r * 0.75, this.r * 0.85);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    circle(ctx, this.r * 0.25, 0, 3);
    ctx.fill();
    ctx.restore();

    if (this.shield > 0) {
      ctx.save();
      ctx.globalAlpha = 0.5 + Math.sin(performance.now() / 120) * 0.2;
      ctx.strokeStyle = '#60a5fa';
      ctx.lineWidth = 2.5;
      circle(ctx, this.x, this.y, this.r + 7);
      ctx.stroke();
      ctx.restore();
    }

    ctx.globalAlpha = 1;
  }
}

const ENEMY_TYPES = {
  chaser: { color: '#ef4444', speed: 74, hp: 18, damage: 12, r: 15, score: 100 },
  shooter: { color: '#c084fc', speed: 62, hp: 26, damage: 10, r: 16, score: 160 },
};

class Enemy {
  constructor(type, x, y, wave) {
    const base = ENEMY_TYPES[type];
    this.type = type;
    this.x = x;
    this.y = y;
    this.r = base.r;
    this.color = base.color;
    this.maxHp = Math.round(base.hp + wave * (type === 'chaser' ? 6 : 9));
    this.hp = this.maxHp;
    this.speed = Math.min(160, base.speed + wave * 4);
    this.contactDamage = base.damage;
    this.scoreValue = base.score;
    this.fireTimer = rand(1, 2);
    this.contactCd = 0;
    this.hitFlash = 0;
    this.dead = false;
  }

  update(dt, game) {
    this.hitFlash = Math.max(0, this.hitFlash - dt);
    this.contactCd = Math.max(0, this.contactCd - dt);
    const targets = game.players.filter((p) => !p.downed);
    if (!targets.length) return;

    let nearest = targets[0];
    let best = Infinity;
    for (const player of targets) {
      const d = Math.hypot(player.x - this.x, player.y - this.y);
      if (d < best) {
        best = d;
        nearest = player;
      }
    }
    const angle = Math.atan2(nearest.y - this.y, nearest.x - this.x);

    if (this.type === 'chaser') {
      this.x += Math.cos(angle) * this.speed * dt;
      this.y += Math.sin(angle) * this.speed * dt;
    } else {
      const desired = 250;
      const dir = Math.abs(best - desired) < 30 ? 0 : best > desired ? 1 : -1;
      this.x += Math.cos(angle) * this.speed * dir * dt;
      this.y += Math.sin(angle) * this.speed * dir * dt;
      this.fireTimer -= dt;
      if (this.fireTimer <= 0) {
        this.fireTimer = Math.max(0.65, 1.9 - game.wave * 0.06);
        const speed = 250;
        game.bullets.push(
          new Bullet(
            this.x + Math.cos(angle) * this.r,
            this.y + Math.sin(angle) * this.r,
            Math.cos(angle) * speed,
            Math.sin(angle) * speed,
            { hostile: true, damage: 10, color: '#f472b6', r: 5, life: 3 },
          ),
        );
        game.sfx.enemyShoot();
      }
    }

    if (best < this.r + nearest.r && this.contactCd <= 0) {
      nearest.takeDamage(this.contactDamage, game);
      this.contactCd = 0.7;
    }
  }

  takeDamage(amount, game) {
    this.hp -= amount;
    this.hitFlash = 0.08;
    if (this.hp <= 0) {
      this.dead = true;
      game.onEnemyKilled(this);
    } else {
      game.sfx.hit();
    }
  }

  draw(ctx) {
    const color = this.hitFlash > 0 ? '#ffffff' : this.color;
    if (this.type === 'chaser') {
      ctx.save();
      ctx.translate(this.x, this.y);
      ctx.rotate(performance.now() / 500);
      ctx.shadowColor = color;
      ctx.shadowBlur = 16;
      ctx.fillStyle = color;
      ctx.beginPath();
      for (let i = 0; i < 6; i += 1) {
        const a = (Math.PI / 3) * i;
        const px = Math.cos(a) * this.r;
        const py = Math.sin(a) * this.r;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    } else {
      glowCircle(ctx, this.x, this.y, this.r, color, 16);
      ctx.fillStyle = 'rgba(10,8,20,0.75)';
      circle(ctx, this.x, this.y, this.r * 0.5);
      ctx.fill();
    }

    if (this.hp < this.maxHp) {
      const barW = this.r * 2.2;
      const pct = this.hp / this.maxHp;
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(this.x - barW / 2, this.y - this.r - 11, barW, 4);
      ctx.fillStyle = pct > 0.4 ? '#4ade80' : '#f87171';
      ctx.fillRect(this.x - barW / 2, this.y - this.r - 11, barW * pct, 4);
    }
  }
}

class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.input = new Input();
    this.sfx = new Sfx();
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = W * this.dpr;
    canvas.height = H * this.dpr;
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.state = 'menu';
    this.highScore = this.loadHighScore();
    this.boundLoop = (t) => this.loop(t);
    this.last = 0;
    this.reset();
    requestAnimationFrame(this.boundLoop);
  }

  loadHighScore() {
    try {
      return Number(localStorage.getItem(HIGHSCORE_KEY)) || 0;
    } catch {
      return 0;
    }
  }

  saveHighScore(value) {
    try {
      localStorage.setItem(HIGHSCORE_KEY, String(value));
    } catch {
      return;
    }
  }

  reset() {
    this.players = [new Player(0, W / 2 - 130, H / 2), new Player(1, W / 2 + 130, H / 2)];
    this.bullets = [];
    this.enemies = [];
    this.particles = [];
    this.powerups = [];
    this.texts = [];
    this.score = 0;
    this.wave = 0;
    this.waveState = 'idle';
    this.waveTimer = 0;
    this.spawnQueue = [];
    this.spawnTimer = 0;
    this.shake = 0;
    this.flash = 0;
    this.banner = null;
  }

  start() {
    this.reset();
    this.state = 'playing';
    this.nextWave();
  }

  nextWave() {
    this.wave += 1;
    this.spawnQueue = shuffle([
      ...Array.from({ length: 3 + this.wave * 2 }, () => 'chaser'),
      ...Array.from({ length: this.wave >= 2 ? Math.floor(this.wave / 2) : 0 }, () => 'shooter'),
    ]);
    this.spawnTimer = 0.4;
    this.spawnStateActive = false;
    this.banner = { text: `第 ${this.wave} 波`, sub: '準備迎擊', life: 2, maxLife: 2 };
    for (const player of this.players) {
      if (player.downed) player.revive();
    }
    this.sfx.wave();
  }

  spawnEnemy(type) {
    const margin = 40;
    const side = Math.floor(rand(0, 4));
    let x;
    let y;
    if (side === 0) {
      x = rand(0, W);
      y = -margin;
    } else if (side === 1) {
      x = W + margin;
      y = rand(0, H);
    } else if (side === 2) {
      x = rand(0, W);
      y = H + margin;
    } else {
      x = -margin;
      y = rand(0, H);
    }
    this.enemies.push(new Enemy(type, x, y, this.wave));
  }

  spawnParticles(x, y, color, count, speed) {
    for (let i = 0; i < count; i += 1) {
      this.particles.push(new Particle(x, y, color, speed));
    }
  }

  onEnemyKilled(enemy) {
    this.score += enemy.scoreValue;
    this.spawnParticles(enemy.x, enemy.y, enemy.color, 20, 240);
    this.sfx.explode();
    if (Math.random() < 0.16) {
      const types = ['heal', 'rapid', 'spread', 'shield'];
      const type = types[Math.floor(Math.random() * types.length)];
      this.powerups.push(new Powerup(type, enemy.x, enemy.y));
    }
  }

  update(dt) {
    if (this.input.justPressed('KeyM')) this.sfx.muted = !this.sfx.muted;

    if (this.state === 'menu') {
      if (this.input.justPressed('Space') || this.input.justPressed('Enter')) this.start();
      return;
    }

    if (this.state === 'gameover') {
      if (this.input.justPressed('KeyR') || this.input.justPressed('Enter')) this.start();
      else if (this.input.justPressed('Escape')) {
        this.reset();
        this.state = 'menu';
      }
      return;
    }

    if (this.input.justPressed('KeyP') || this.input.justPressed('Escape')) {
      this.state = this.state === 'paused' ? 'playing' : 'paused';
      return;
    }
    if (this.state === 'paused') return;

    this.shake = Math.max(0, this.shake - dt * 40);
    this.flash = Math.max(0, this.flash - dt * 2);
    if (this.banner) {
      this.banner.life -= dt;
      if (this.banner.life <= 0) this.banner = null;
    }

    for (const player of this.players) player.update(dt, this.input, this);

    if (this.waveState === 'idle') this.waveState = 'spawning';

    if (this.spawnQueue.length) {
      this.spawnTimer -= dt;
      if (this.spawnTimer <= 0) {
        this.spawnEnemy(this.spawnQueue.pop());
        this.spawnTimer = Math.max(0.22, 0.8 - this.wave * 0.03);
      }
    } else if (!this.enemies.length && this.waveState !== 'break') {
      this.score += 150 * this.wave;
      this.waveState = 'break';
      this.waveTimer = 2.6;
      this.banner = {
        text: '波次清除！',
        sub: `+${150 * this.wave} 分`,
        life: 2.2,
        maxLife: 2.2,
      };
      this.powerups.push(new Powerup('heal', W / 2 + rand(-100, 100), H / 2 + rand(-80, 80)));
    }

    if (this.waveState === 'break') {
      this.waveTimer -= dt;
      if (this.waveTimer <= 0) {
        this.waveState = 'active';
        this.nextWave();
      }
    }

    for (const bullet of this.bullets) bullet.update(dt);
    for (const enemy of this.enemies) enemy.update(dt, this);
    for (const powerup of this.powerups) powerup.update(dt);
    for (const particle of this.particles) particle.update(dt);
    for (const text of this.texts) text.update(dt);

    this.handleCollisions();

    this.bullets = this.bullets.filter((b) => !b.dead);
    this.enemies = this.enemies.filter((e) => !e.dead);
    this.powerups = this.powerups.filter((p) => !p.dead);
    this.particles = this.particles.filter((p) => p.life > 0);
    this.texts = this.texts.filter((t) => t.life > 0);

    if (this.players.every((p) => p.downed)) {
      this.state = 'gameover';
      if (this.score > this.highScore) {
        this.highScore = this.score;
        this.saveHighScore(this.highScore);
      }
      this.sfx.gameover();
    }
  }

  handleCollisions() {
    for (const bullet of this.bullets) {
      if (bullet.dead) continue;
      if (bullet.hostile) {
        for (const player of this.players) {
          if (player.downed || player.invuln > 0 || player.shield > 0) continue;
          if (Math.hypot(bullet.x - player.x, bullet.y - player.y) < bullet.r + player.r) {
            bullet.dead = true;
            player.takeDamage(bullet.damage, this);
            break;
          }
        }
      } else {
        for (const enemy of this.enemies) {
          if (enemy.dead) continue;
          if (Math.hypot(bullet.x - enemy.x, bullet.y - enemy.y) < bullet.r + enemy.r) {
            bullet.dead = true;
            this.spawnParticles(bullet.x, bullet.y, bullet.color, 5, 120);
            enemy.takeDamage(bullet.damage, this);
            break;
          }
        }
      }
    }

    for (const powerup of this.powerups) {
      if (powerup.dead) continue;
      for (const player of this.players) {
        if (player.downed) continue;
        if (Math.hypot(powerup.x - player.x, powerup.y - player.y) < powerup.r + player.r) {
          powerup.dead = true;
          player.applyPowerup(powerup.type, this);
          break;
        }
      }
    }
  }

  drawBackground(ctx) {
    const gradient = ctx.createRadialGradient(W / 2, H / 2, 60, W / 2, H / 2, W * 0.78);
    gradient.addColorStop(0, '#121c35');
    gradient.addColorStop(1, '#05080f');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, W, H);

    ctx.strokeStyle = 'rgba(90,130,220,0.07)';
    ctx.lineWidth = 1;
    const cell = 40;
    ctx.beginPath();
    for (let x = cell; x < W; x += cell) {
      ctx.moveTo(x, 0);
      ctx.lineTo(x, H);
    }
    for (let y = cell; y < H; y += cell) {
      ctx.moveTo(0, y);
      ctx.lineTo(W, y);
    }
    ctx.stroke();

    ctx.strokeStyle = 'rgba(120,170,255,0.18)';
    ctx.lineWidth = 2;
    ctx.strokeRect(1, 1, W - 2, H - 2);
  }

  drawHud(ctx) {
    ctx.fillStyle = 'rgba(8,12,22,0.72)';
    ctx.fillRect(0, 0, W, 56);
    ctx.strokeStyle = 'rgba(120,170,255,0.18)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, 56);
    ctx.lineTo(W, 56);
    ctx.stroke();

    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    ctx.fillStyle = '#93c5fd';
    ctx.font = '700 14px "Segoe UI", system-ui, sans-serif';
    ctx.fillText('分數', 24, 20);
    ctx.fillStyle = '#ffffff';
    ctx.font = '800 26px "Segoe UI", system-ui, sans-serif';
    ctx.fillText(String(this.score), 24, 39);

    ctx.textAlign = 'center';
    ctx.fillStyle = '#a78bfa';
    ctx.font = '700 14px "Segoe UI", system-ui, sans-serif';
    ctx.fillText('波次', W / 2, 20);
    ctx.fillStyle = '#ffffff';
    ctx.font = '800 26px "Segoe UI", system-ui, sans-serif';
    ctx.fillText(String(Math.max(1, this.wave)), W / 2, 39);

    ctx.textAlign = 'right';
    ctx.fillStyle = '#fbbf24';
    ctx.font = '700 14px "Segoe UI", system-ui, sans-serif';
    ctx.fillText('最高分', W - 24, 20);
    ctx.fillStyle = '#fde68a';
    ctx.font = '800 26px "Segoe UI", system-ui, sans-serif';
    ctx.fillText(String(this.highScore), W - 24, 39);

    this.drawPlayerHud(ctx, this.players[0], 'left');
    this.drawPlayerHud(ctx, this.players[1], 'right');
  }

  drawPlayerHud(ctx, player, side) {
    const bw = 300;
    const bh = 52;
    const x = side === 'left' ? 22 : W - 22 - bw;
    const y = H - bh - 18;

    ctx.fillStyle = 'rgba(8,12,22,0.72)';
    roundRect(ctx, x, y, bw, bh, 10);
    ctx.fill();
    ctx.strokeStyle = 'rgba(120,170,255,0.18)';
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = player.color;
    ctx.font = '800 14px "Segoe UI", system-ui, sans-serif';
    ctx.fillText(player.downed ? `${player.name} 倒下` : player.name, x + 12, y + 22);

    const barX = x + 12;
    const barY = y + 28;
    const barW = bw - 24;
    const barH = 12;
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    roundRect(ctx, barX, barY, barW, barH, 6);
    ctx.fill();
    const pct = clamp(player.hp / player.maxHp, 0, 1);
    if (pct > 0) {
      ctx.fillStyle = pct > 0.5 ? '#4ade80' : pct > 0.25 ? '#facc15' : '#f87171';
      roundRect(ctx, barX, barY, barW * pct, barH, 6);
      ctx.fill();
    }

    const buffs = [];
    if (player.rapid > 0) buffs.push(['»', '#facc15', player.rapid]);
    if (player.spread > 0) buffs.push(['W', '#a78bfa', player.spread]);
    if (player.shield > 0) buffs.push(['O', '#60a5fa', player.shield]);
    ctx.font = '700 12px "Segoe UI", system-ui, sans-serif';
    ctx.textAlign = 'right';
    let bx = x + bw - 12;
    for (const [label, color, time] of buffs) {
      ctx.fillStyle = color;
      ctx.fillText(`${label} ${time.toFixed(1)}`, bx, y + 22);
      bx -= 56;
    }
  }

  drawBanner(ctx) {
    if (!this.banner) return;
    const alpha = Math.min(1, this.banner.life / 0.5) * Math.min(1, this.banner.life);
    ctx.globalAlpha = clamp(alpha, 0, 1);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffffff';
    ctx.font = '800 54px "Segoe UI", system-ui, sans-serif';
    ctx.fillText(this.banner.text, W / 2, H / 2 - 30);
    ctx.fillStyle = '#a5b4fc';
    ctx.font = '600 22px "Segoe UI", system-ui, sans-serif';
    ctx.fillText(this.banner.sub, W / 2, H / 2 + 12);
    ctx.globalAlpha = 1;
  }

  drawMenu(ctx) {
    ctx.fillStyle = 'rgba(4,7,14,0.82)';
    ctx.fillRect(0, 0, W, H);
    ctx.textAlign = 'center';

    ctx.save();
    ctx.shadowColor = '#38bdf8';
    ctx.shadowBlur = 30;
    ctx.fillStyle = '#ffffff';
    ctx.font = '800 64px "Segoe UI", system-ui, sans-serif';
    ctx.fillText('DUO SHOOTER', W / 2, H / 2 - 90);
    ctx.restore();

    ctx.fillStyle = '#a78bfa';
    ctx.font = '700 24px "Segoe UI", system-ui, sans-serif';
    ctx.fillText('雙 人 射 擊 · 合 作 生 存', W / 2, H / 2 - 44);

    ctx.font = '600 20px "Segoe UI", system-ui, sans-serif';
    ctx.fillStyle = '#38bdf8';
    ctx.fillText('P1  W A S D 移動 · Space 射擊', W / 2, H / 2 + 10);
    ctx.fillStyle = '#fb923c';
    ctx.fillText('P2  ↑ ↓ ← → 移動 · Enter 射擊', W / 2, H / 2 + 44);

    ctx.fillStyle = '#cbd5e1';
    ctx.font = '600 18px "Segoe UI", system-ui, sans-serif';
    ctx.fillText('擊敗敵人、收集強化、活過每一波', W / 2, H / 2 + 92);

    const pulse = 0.6 + Math.sin(performance.now() / 300) * 0.4;
    ctx.globalAlpha = pulse;
    ctx.fillStyle = '#4ade80';
    ctx.font = '800 24px "Segoe UI", system-ui, sans-serif';
    ctx.fillText('按 Enter / Space 開始', W / 2, H / 2 + 150);
    ctx.globalAlpha = 1;

    ctx.fillStyle = '#94a3b8';
    ctx.font = '600 16px "Segoe UI", system-ui, sans-serif';
    ctx.fillText(`最高分 ${this.highScore}`, W / 2, H - 30);
  }

  drawPaused(ctx) {
    ctx.fillStyle = 'rgba(4,7,14,0.7)';
    ctx.fillRect(0, 0, W, H);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffffff';
    ctx.font = '800 52px "Segoe UI", system-ui, sans-serif';
    ctx.fillText('已暫停', W / 2, H / 2 - 10);
    ctx.fillStyle = '#a5b4fc';
    ctx.font = '600 20px "Segoe UI", system-ui, sans-serif';
    ctx.fillText('按 P 或 Esc 繼續', W / 2, H / 2 + 34);
  }

  drawGameOver(ctx) {
    ctx.fillStyle = 'rgba(30,4,10,0.78)';
    ctx.fillRect(0, 0, W, H);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#f87171';
    ctx.font = '800 62px "Segoe UI", system-ui, sans-serif';
    ctx.fillText('遊戲結束', W / 2, H / 2 - 90);

    ctx.fillStyle = '#ffffff';
    ctx.font = '800 34px "Segoe UI", system-ui, sans-serif';
    ctx.fillText(`本局分數 ${this.score}`, W / 2, H / 2 - 20);

    const isBest = this.score >= this.highScore && this.score > 0;
    ctx.fillStyle = isBest ? '#4ade80' : '#fbbf24';
    ctx.font = '700 24px "Segoe UI", system-ui, sans-serif';
    ctx.fillText(
      isBest ? `新紀錄！最高分 ${this.highScore}` : `最高分 ${this.highScore}`,
      W / 2,
      H / 2 + 24,
    );

    ctx.fillStyle = '#cbd5e1';
    ctx.font = '600 20px "Segoe UI", system-ui, sans-serif';
    ctx.fillText('按 R / Enter 重新開始 · Esc 回主選單', W / 2, H / 2 + 82);
  }

  draw() {
    const ctx = this.ctx;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);

    const shakeX = this.shake ? rand(-this.shake, this.shake) : 0;
    const shakeY = this.shake ? rand(-this.shake, this.shake) : 0;
    ctx.save();
    ctx.translate(shakeX, shakeY);

    this.drawBackground(ctx);

    for (const powerup of this.powerups) powerup.draw(ctx);
    for (const enemy of this.enemies) enemy.draw(ctx);
    for (const bullet of this.bullets) bullet.draw(ctx);
    for (const player of this.players) player.draw(ctx);
    for (const particle of this.particles) particle.draw(ctx);
    for (const text of this.texts) text.draw(ctx);

    if (this.state === 'playing' || this.state === 'paused' || this.state === 'gameover') {
      this.drawHud(ctx);
      this.drawBanner(ctx);
    }

    ctx.restore();

    if (this.flash > 0) {
      ctx.fillStyle = `rgba(255,80,120,${this.flash * 0.5})`;
      ctx.fillRect(0, 0, W, H);
    }

    if (this.state === 'menu') this.drawMenu(ctx);
    if (this.state === 'paused') this.drawPaused(ctx);
    if (this.state === 'gameover') this.drawGameOver(ctx);
  }

  loop(timestamp) {
    const seconds = timestamp / 1000;
    const dt = Math.min(0.05, this.last ? seconds - this.last : 0);
    this.last = seconds;
    this.update(dt);
    this.draw();
    this.input.endFrame();
    requestAnimationFrame(this.boundLoop);
  }
}

window.game = new Game(document.getElementById('game'));

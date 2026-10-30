const $ = id => document.getElementById(id);

const defaults = {
  das: 130,
  arr: 20,
  sdf: 20,
  lock: 500,
  gravity: 1000,
  ghost: true,
  grid: true,
  sound: true,
  volume: 25,

  keys: {
    left: 'ArrowLeft',
    right: 'ArrowRight',
    soft: 'ArrowDown',
    hard: 'Space',
    cw: 'ArrowUp',
    ccw: 'KeyZ',
    flip: 'KeyA',
    hold: 'KeyC',
    pause: 'Escape',
    restart: 'KeyR'
  }
};

let cfg;

try {
  cfg = {
    ...defaults,
    ...JSON.parse(localStorage.getItem('stack-config') || '{}')
  };

  cfg.keys = {
    ...defaults.keys,
    ...cfg.keys
  };
} catch {
  cfg = structuredClone(defaults);
}

let mode = 'sprint';
let game = new Engine(mode, cfg);

let running = false;
let paused = false;
let last = 0;

let keys = {};
let dir = 0;
let charge = 0;
let repeat = 0;

let tab = 'handling';
let binding = null;
let toastUntil = 0;
let audio;

let records = {};

try {
  records = JSON.parse(
    localStorage.getItem('stack-records') || '{}'
  );
} catch {}

function save() {
  localStorage.setItem('stack-config', JSON.stringify(cfg));
}

function sound(freq = 440) {
  if (!cfg.sound || cfg.volume <= 0) return;

  try {
    audio ??= new AudioContext();

    const oscillator = audio.createOscillator();
    const gain = audio.createGain();

    oscillator.type = 'sine';
    oscillator.frequency.value = freq;

    gain.gain.setValueAtTime(
      cfg.volume / 600,
      audio.currentTime
    );

    gain.gain.exponentialRampToValueAtTime(
      0.001,
      audio.currentTime + 0.08
    );

    oscillator.connect(gain);
    gain.connect(audio.destination);

    oscillator.start();
    oscillator.stop(audio.currentTime + 0.09);
  } catch {}
}

function start() {
  game = new Engine(mode, cfg);

  running = true;
  paused = false;

  keys = {};
  dir = 0;
  charge = 0;
  repeat = 0;

  $('overlay').style.display = 'none';
  $('toast').textContent = '';

  sound(660);
}

function overlay(title, text, button) {
  $('overlay').style.display = 'flex';
  $('overlay').querySelector('h2').textContent = title;
  $('result').textContent = text;
  $('start').textContent = button;
}

function pause() {
  if (!running) return;

  paused = !paused;
  keys = {};
  dir = 0;

  if (paused) {
    overlay('일시정지', '', '계속');
  } else {
    $('overlay').style.display = 'none';
  }
}

function end() {
  running = false;
  keys = {};

  const value = mode === 'sprint'
    ? game.elapsed
    : game.score;

  if (game.won || mode !== 'sprint') {
    const isBest =
      records[mode] == null ||
      (
        mode === 'sprint'
          ? value < records[mode]
          : value > records[mode]
      );

    if (isBest) {
      records[mode] = value;

      localStorage.setItem(
        'stack-records',
        JSON.stringify(records)
      );
    }
  }

  overlay(
    game.won ? '완료' : '게임 오버',
    `${game.lines}줄 · ${game.score.toLocaleString()}점 · ${format(game.elapsed)}`,
    '다시 시작 ↵'
  );

  recordText();
}

function action(actionName) {
  if (actionName === 'restart') {
    start();
    return;
  }

  if (actionName === 'pause') {
    pause();
    return;
  }

  if (!running || paused) return;

  switch (actionName) {
    case 'left':
      game.move(-1);
      break;

    case 'right':
      game.move(1);
      break;

    case 'cw':
      game.rotate(1);
      sound(490);
      break;

    case 'ccw':
      game.rotate(-1);
      sound(440);
      break;

    case 'flip':
      game.rotate(2);
      break;

    case 'hold':
      game.hold();
      sound(330);
      break;

    case 'hard':
      game.hard();
      sound(180);
      break;

    case 'soft':
      game.move(0, 1, true);
      break;
  }
}

addEventListener('keydown', event => {
  if (binding) {
    event.preventDefault();

    const conflict = Object.entries(cfg.keys).find(
      ([actionName, code]) =>
        code === event.code && actionName !== binding
    );

    if (conflict) {
      cfg.keys[conflict[0]] = cfg.keys[binding];
    }

    cfg.keys[binding] = event.code;
    binding = null;

    save();
    options();
    return;
  }

  if ($('dialog').open) return;
  if (event.target.tagName === 'INPUT') return;

  if (event.code === 'Enter') {
    event.preventDefault();

    if (!running) {
      start();
    } else if (paused) {
      pause();
    }

    return;
  }

  let actionName = Object.keys(cfg.keys).find(
    name => cfg.keys[name] === event.code
  );

  if (!actionName && event.code === 'KeyX') {
    actionName = 'cw';
  }

  if (!actionName) return;

  event.preventDefault();

  if (event.repeat) return;

  keys[actionName] = true;
  action(actionName);

  if (actionName === 'left' || actionName === 'right') {
    dir = actionName === 'left' ? -1 : 1;
    charge = 0;
    repeat = 0;
  }
});

addEventListener('keyup', event => {
  const actionName = Object.keys(cfg.keys).find(
    name => cfg.keys[name] === event.code
  );

  if (!actionName) return;

  keys[actionName] = false;

  if (actionName === 'left' || actionName === 'right') {
    const other = actionName === 'left'
      ? 'right'
      : 'left';

    dir = keys[other]
      ? (other === 'left' ? -1 : 1)
      : 0;

    charge = 0;
    repeat = 0;
  }
});

addEventListener('blur', () => {
  keys = {};
  dir = 0;

  if (running && !paused) {
    pause();
  }
});

$('start').onclick = () => {
  if (paused) {
    pause();
  } else {
    start();
  }
};

$('restart').onclick = start;

$('modes').onclick = event => {
  const button = event.target.closest('[data-mode]');

  if (!button) return;

  mode = button.dataset.mode;

  document.querySelectorAll('[data-mode]').forEach(item => {
    item.classList.toggle('selected', item === button);
  });

  $('goal').textContent = mode === 'sprint'
    ? ' / 40'
    : '';

  running = false;
  paused = false;
  keys = {};
  dir = 0;
  charge = 0;
  repeat = 0;

  game = new Engine(mode, cfg);
  $('toast').textContent = '';

  overlay('', '', '시작 ↵');
};

function format(time) {
  const milliseconds = Math.floor(time);
  const minutes = Math.floor(milliseconds / 60000);

  const seconds = String(
    Math.floor(milliseconds / 1000) % 60
  ).padStart(2, '0');

  const fraction = String(
    milliseconds % 1000
  ).padStart(3, '0');

  return `${minutes}:${seconds}.${fraction}`;
}

function recordText() {
  const sprint = records.sprint != null
    ? format(records.sprint)
    : '—';

  const blitz = records.blitz ?? '—';
  const zen = records.zen ?? '—';

  $('records').textContent =
    `40줄: ${sprint} · 2분: ${blitz} · 무한: ${zen}`;
}

recordText();

function block(context, x, y, size, color, alpha = 1) {
  context.globalAlpha = alpha;

  context.fillStyle = color;
  context.fillRect(x + 1, y + 1, size - 2, size - 2);

  context.fillStyle = '#ffffff35';
  context.fillRect(x + 2, y + 2, size - 4, 3);

  context.fillStyle = '#0002';
  context.fillRect(x + 2, y + size - 5, size - 4, 3);

  context.globalAlpha = 1;
}

function mini(id, types) {
  const context = $(id).getContext('2d');

  context.clearRect(
    0,
    0,
    context.canvas.width,
    context.canvas.height
  );

  types.forEach((type, index) => {
    if (!type) return;

    const shape = SHAPES[type];

    const minX = Math.min(...shape.map(cell => cell[0]));
    const maxX = Math.max(...shape.map(cell => cell[0]));
    const minY = Math.min(...shape.map(cell => cell[1]));

    const offsetX = (
      120 - (maxX - minX + 1) * 23
    ) / 2;

    const alpha = id === 'hold' && !game.canHold
      ? 0.4
      : 1;

    shape.forEach(([x, y]) => {
      block(
        context,
        (x - minX) * 23 + offsetX,
        (y - minY) * 23 + 15 + index * 65,
        23,
        COLORS[type],
        alpha
      );
    });
  });
}

function draw() {
  const context = $('board').getContext('2d');

  context.clearRect(0, 0, 320, 640);

  if (cfg.grid) {
    context.strokeStyle = '#ffffff08';
    context.lineWidth = 1;

    for (let x = 0; x <= 320; x += 32) {
      context.beginPath();
      context.moveTo(x, 0);
      context.lineTo(x, 640);
      context.stroke();
    }

    for (let y = 0; y <= 640; y += 32) {
      context.beginPath();
      context.moveTo(0, y);
      context.lineTo(320, y);
      context.stroke();
    }
  }

  game.board.forEach((row, y) => {
    if (y < 20) return;

    row.forEach((type, x) => {
      if (!type) return;

      block(
        context,
        x * 32,
        (y - 20) * 32,
        32,
        COLORS[type]
      );
    });
  });

  if (!game.over) {
    if (cfg.ghost) {
      game.cells(game.ghost()).forEach(([x, y]) => {
        if (y < 20) return;

        context.strokeStyle = COLORS[game.p.type];
        context.globalAlpha = 0.45;
        context.lineWidth = 2;

        context.strokeRect(
          x * 32 + 3,
          (y - 20) * 32 + 3,
          26,
          26
        );

        context.globalAlpha = 1;
      });
    }

    game.cells().forEach(([x, y]) => {
      if (y < 20) return;

      block(
        context,
        x * 32,
        (y - 20) * 32,
        32,
        COLORS[game.p.type]
      );
    });
  }

  mini('hold', [game.held]);
  mini('next', game.queue.slice(0, 5));

  const displayTime = mode === 'blitz'
    ? Math.max(0, 120000 - game.elapsed)
    : game.elapsed;

  $('time').textContent = format(displayTime);
  $('lines').textContent = game.lines;
  $('score').textContent = game.score.toLocaleString();

  $('pps').textContent = (
    game.elapsed
      ? game.pieces / (game.elapsed / 1000)
      : 0
  ).toFixed(2);

  $('level').textContent = game.level;

  $('b2b').textContent = game.b2b > 1
    ? '×' + (game.b2b - 1)
    : '—';

  $('combo').textContent = game.combo > 0
    ? game.combo
    : '—';
}

function frame(now) {
  const dt = Math.min(now - last, 50);
  last = now;

  if (running && !paused) {
    if (dir) {
      charge += dt;

      if (charge >= cfg.das) {
        if (cfg.arr === 0) {
          while (game.move(dir)) {}
        } else {
          repeat += dt;

          while (repeat >= cfg.arr) {
            game.move(dir);
            repeat -= cfg.arr;
          }
        }
      }
    }

    game.tick(dt, keys.soft);

    if (game.event) {
      $('toast').textContent = game.event;
      game.event = '';

      toastUntil = now + 1200;
      sound(780);
    }

    if (game.over) {
      end();
    }
  }

  if (now > toastUntil) {
    $('toast').textContent = '';
  }

  draw();
  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);

const labels = {
  left: '왼쪽 이동',
  right: '오른쪽 이동',
  soft: '소프트 드롭',
  hard: '하드 드롭',
  cw: '시계 회전',
  ccw: '반시계 회전',
  flip: '180° 회전 (킥 없음)',
  hold: '홀드',
  pause: '일시정지',
  restart: '다시 시작'
};

function options() {
  const container = $('options');
  container.innerHTML = '';

  if (tab === 'keys') {
    Object.entries(labels).forEach(([actionName, title]) => {
      const row = document.createElement('div');
      row.className = 'option';

      const label = document.createElement('label');
      label.textContent = title;

      const button = document.createElement('button');

      button.textContent = binding === actionName
        ? '키 입력…'
        : cfg.keys[actionName];

      button.onclick = () => {
        binding = actionName;
        options();
      };

      row.append(label, button);
      container.append(row);
    });

    return;
  }

  const list = tab === 'handling'
    ? [
        ['das', 'DAS · 반복 시작 지연 (ms)', 0, 500],
        ['arr', 'ARR · 반복 간격 (0 = 즉시)', 0, 100],
        ['sdf', '소프트 드롭 배율 (0 = 즉시)', 0, 100],
        ['lock', '고정 지연 (ms)', 0, 2000],
        ['gravity', '기본 낙하 간격 (ms)', 50, 5000]
      ]
    : [
        ['ghost', '고스트 피스'],
        ['grid', '보드 격자'],
        ['sound', '효과음'],
        ['volume', '볼륨 (%)', 0, 100]
      ];

  list.forEach(([key, title, min, max]) => {
    const row = document.createElement('div');
    row.className = 'option';

    const label = document.createElement('label');
    label.textContent = title;
    label.htmlFor = `setting-${key}`;

    const input = document.createElement('input');
    input.id = `setting-${key}`;

    input.type = typeof cfg[key] === 'boolean'
      ? 'checkbox'
      : 'number';

    if (input.type === 'checkbox') {
      input.checked = cfg[key];
    } else {
      input.value = cfg[key];
      input.min = min;
      input.max = max;
    }

    input.onchange = () => {
      cfg[key] = input.type === 'checkbox'
        ? input.checked
        : Math.max(
            min,
            Math.min(max, Number(input.value) || 0)
          );

      if (input.type !== 'checkbox') {
        input.value = cfg[key];
      }

      game.settings = cfg;
      save();
    };

    row.append(label, input);
    container.append(row);
  });
}

$('settings').onclick = () => {
  if (running && !paused) {
    pause();
  }

  options();
  $('dialog').showModal();
};

$('close').onclick = () => {
  binding = null;
  $('dialog').close();
};

$('dialog').addEventListener('cancel', () => {
  binding = null;
});

$('tabs').onclick = event => {
  if (!event.target.dataset.tab) return;

  tab = event.target.dataset.tab;
  binding = null;

  document.querySelectorAll('[data-tab]').forEach(button => {
    button.classList.toggle(
      'selected',
      button === event.target
    );
  });

  options();
};

$('defaults').onclick = () => {
  cfg = structuredClone(defaults);
  game.settings = cfg;

  save();
  options();
};

document.querySelectorAll('[data-act]').forEach(button => {
  button.onpointerdown = event => {
    event.preventDefault();
    button.setPointerCapture(event.pointerId);

    const actionName = button.dataset.act;

    keys[actionName] = true;
    action(actionName);

    if (actionName === 'left' || actionName === 'right') {
      dir = actionName === 'left' ? -1 : 1;
      charge = 0;
      repeat = 0;
    }
  };

  button.onpointerup = button.onpointercancel = () => {
    keys[button.dataset.act] = false;
    dir = 0;
  };
});

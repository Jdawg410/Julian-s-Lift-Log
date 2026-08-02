const STORAGE_KEY = 'liftlog.state.v1';
const REP_TARGET = 5;

const DAY_EXERCISES = {
  A: ['squat', 'bench', 'row'],
  B: ['squat', 'ohp', 'deadlift'],
};

function defaultState() {
  return {
    exercises: {
      squat:    { name: 'Squat',           weight: 45, increment: 5,  sets: 5, fails: 0 },
      bench:    { name: 'Bench Press',     weight: 45, increment: 5,  sets: 5, fails: 0 },
      row:      { name: 'Barbell Row',     weight: 65, increment: 5,  sets: 5, fails: 0 },
      ohp:      { name: 'Overhead Press',  weight: 45, increment: 5,  sets: 5, fails: 0 },
      deadlift: { name: 'Deadlift',        weight: 95, increment: 10, sets: 1, fails: 0 },
    },
    nextWorkout: 'A',
    history: [],
  };
}

function loadState() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return defaultState();
  try {
    return JSON.parse(raw);
  } catch {
    return defaultState();
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function round5(x) {
  return Math.round(x / 5) * 5;
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function formatDate(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

let state = loadState();
let activeTab = 'today';

function showToast(msg) {
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = msg;
  document.body.appendChild(el);
  requestAnimationFrame(() => el.classList.add('show'));
  setTimeout(() => {
    el.classList.remove('show');
    setTimeout(() => el.remove(), 250);
  }, 1800);
}

function render() {
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === activeTab);
  });
  const view = document.getElementById('view');
  if (activeTab === 'today') view.innerHTML = renderToday();
  else if (activeTab === 'history') view.innerHTML = renderHistory();
  else view.innerHTML = renderSettings();
  attachHandlers();
}

function renderToday() {
  const day = state.nextWorkout;
  const exerciseIds = DAY_EXERCISES[day];
  const cards = exerciseIds.map(id => {
    const ex = state.exercises[id];
    const setInputs = Array.from({ length: ex.sets }).map((_, i) => `
      <div class="set-input-wrap">
        <label>Set ${i + 1}</label>
        <input class="rep-input" type="number" inputmode="numeric" min="0" max="20"
               value="${REP_TARGET}" data-exercise="${id}" data-set="${i}">
      </div>
    `).join('');
    return `
      <div class="card" data-exercise-card="${id}">
        <div class="card-title-row">
          <h3>${ex.name}</h3>
          <div>
            <input class="weight-input" type="number" step="5" min="0"
                   value="${ex.weight}" data-weight-for="${id}"> lb
          </div>
        </div>
        <div class="sets-row">${setInputs}</div>
      </div>
    `;
  }).join('');

  return `
    <h2>Workout ${day}</h2>
    <p class="subtext">${todayStr()} &middot; ${exerciseIds.map(id => state.exercises[id].name).join(' / ')}</p>
    ${cards}
    <button class="btn" id="finish-btn">Finish Workout</button>
  `;
}

function renderHistory() {
  if (state.history.length === 0) {
    return `<div class="empty-state">No workouts logged yet.<br>Finish your first one on the Today tab.</div>`;
  }
  const entries = state.history.slice().reverse().map(entry => {
    const lifts = Object.entries(entry.lifts).map(([id, lift]) => `
      <div class="history-lift-row">
        <span>${lift.name} &middot; ${lift.weight} lb</span>
        <span class="reps-list">${lift.reps.join('-')}</span>
        <span class="pill ${lift.success ? 'good' : 'bad'}">${lift.success ? 'Hit it' : 'Missed'}</span>
      </div>
    `).join('');
    return `
      <div class="card">
        <div class="history-entry-header">
          <span class="date">${formatDate(entry.date)}</span>
          <span class="day">Workout ${entry.workout}</span>
        </div>
        ${lifts}
      </div>
    `;
  }).join('');
  return entries;
}

function renderSettings() {
  const rows = Object.entries(state.exercises).map(([id, ex]) => `
    <div class="settings-row">
      <span>${ex.name}</span>
      <div class="fields">
        <div>
          <label>Weight</label>
          <input class="weight-input" type="number" step="5" min="0" value="${ex.weight}" data-setting-weight="${id}">
        </div>
        <div>
          <label>+ per win</label>
          <input class="weight-input" type="number" step="5" min="0" value="${ex.increment}" data-setting-increment="${id}">
        </div>
      </div>
    </div>
  `).join('');

  return `
    <h2>Settings</h2>
    <p class="subtext">Adjust starting weights or progression increments any time.</p>
    <div class="card">${rows}</div>

    <h2>Backup</h2>
    <p class="subtext">Everything is stored only on this device. Export regularly so you never lose your history.</p>
    <div class="card">
      <button class="btn secondary" id="export-btn">Export data (.json)</button>
      <label for="import-file" style="display:block; margin-top:14px;">Restore from a backup file:</label>
      <input type="file" id="import-file" accept="application/json">
    </div>
  `;
}

function attachHandlers() {
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.onclick = () => { activeTab = btn.dataset.tab; render(); };
  });

  const finishBtn = document.getElementById('finish-btn');
  if (finishBtn) finishBtn.onclick = finishWorkout;

  document.querySelectorAll('[data-setting-weight]').forEach(input => {
    input.onchange = () => {
      const id = input.dataset.settingWeight;
      state.exercises[id].weight = Number(input.value) || 0;
      saveState();
    };
  });
  document.querySelectorAll('[data-setting-increment]').forEach(input => {
    input.onchange = () => {
      const id = input.dataset.settingIncrement;
      state.exercises[id].increment = Number(input.value) || 0;
      saveState();
    };
  });

  const exportBtn = document.getElementById('export-btn');
  if (exportBtn) exportBtn.onclick = exportData;

  const importFile = document.getElementById('import-file');
  if (importFile) importFile.onchange = handleImport;
}

function finishWorkout() {
  const day = state.nextWorkout;
  const exerciseIds = DAY_EXERCISES[day];
  const lifts = {};

  exerciseIds.forEach(id => {
    const ex = state.exercises[id];
    const weightInput = document.querySelector(`[data-weight-for="${id}"]`);
    const weightUsed = Number(weightInput.value) || ex.weight;
    const reps = [];
    document.querySelectorAll(`[data-exercise="${id}"]`).forEach(input => {
      reps.push(Number(input.value) || 0);
    });
    const success = reps.every(r => r >= REP_TARGET);

    lifts[id] = { name: ex.name, weight: weightUsed, reps, success };

    if (success) {
      ex.weight = weightUsed + ex.increment;
      ex.fails = 0;
    } else {
      ex.fails += 1;
      if (ex.fails >= 3) {
        ex.weight = round5(weightUsed * 0.9);
        ex.fails = 0;
      } else {
        ex.weight = weightUsed;
      }
    }
  });

  state.history.push({ date: new Date().toISOString(), workout: day, lifts });
  state.nextWorkout = day === 'A' ? 'B' : 'A';
  saveState();
  showToast('Workout saved');
  render();
}

function exportData() {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `liftlog-export-${todayStr()}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function handleImport(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const parsed = JSON.parse(reader.result);
      if (!parsed.exercises || !parsed.history) throw new Error('bad shape');
      if (confirm('This replaces all current data on this device with the backup file. Continue?')) {
        state = parsed;
        saveState();
        showToast('Backup restored');
        render();
      }
    } catch {
      alert('That file doesn\'t look like a LiftLog backup.');
    }
    e.target.value = '';
  };
  reader.readAsText(file);
}

render();

(function animateHeaderSprite() {
  const sprite = document.getElementById('header-sprite');
  if (!sprite) return;
  const frames = ['icons/sprite-a.png', 'icons/sprite-b.png'];
  let i = 0;
  setInterval(() => {
    i = (i + 1) % frames.length;
    sprite.src = frames[i];
  }, 450);
})();

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('service-worker.js').catch(() => {});
  });
}

const STORAGE_KEY = 'liftlog.state.v1';

function defaultState() {
  return {
    exercises: {
      squat:    { name: 'Squat',           type: 'sets',       weight: 45, increment: 5,  sets: 5, reps: 5, fails: 0 },
      bench:    { name: 'Bench Press',     type: 'sets',       weight: 45, increment: 5,  sets: 5, reps: 5, fails: 0 },
      row:      { name: 'Barbell Row',     type: 'sets',       weight: 65, increment: 5,  sets: 5, reps: 5, fails: 0 },
      ohp:      { name: 'Overhead Press',  type: 'sets',       weight: 45, increment: 5,  sets: 5, reps: 5, fails: 0 },
      deadlift: { name: 'Deadlift',        type: 'sets',       weight: 95, increment: 10, sets: 1, reps: 5, fails: 0 },
      deadhang: { name: 'Dead Hang',       type: 'hold',       sets: 3 },
      slrdl:    { name: 'Single-Leg RDL',  type: 'unilateral', weight: 15, increment: 5,  sets: 2, reps: 8, fails: 0 },
    },
    program: {
      A: ['squat', 'bench', 'row', 'deadhang'],
      B: ['squat', 'ohp', 'deadlift', 'slrdl'],
    },
    nextWorkout: 'A',
    history: [],
  };
}

function loadState() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return defaultState();
  try {
    const parsed = JSON.parse(raw);
    const defaults = defaultState();
    parsed.exercises = parsed.exercises || {};
    Object.entries(defaults.exercises).forEach(([id, ex]) => {
      if (!parsed.exercises[id]) parsed.exercises[id] = ex;
    });
    if (!parsed.program) parsed.program = defaults.program;
    if (!parsed.history) parsed.history = [];
    if (!parsed.nextWorkout) parsed.nextWorkout = 'A';
    return parsed;
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

function slugify(name) {
  const base = name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'exercise';
  let id = base;
  let n = 2;
  while (state.exercises[id]) {
    id = `${base}-${n}`;
    n++;
  }
  return id;
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

function exerciseSubtitle(ex) {
  if (ex.type === 'hold') return `${ex.sets} sets · max time`;
  if (ex.type === 'unilateral') return `${ex.sets} sets × ${ex.reps} reps per side`;
  return `${ex.sets} ${ex.sets === 1 ? 'set' : 'sets'} × ${ex.reps} reps`;
}

function repButtons(target, selected) {
  return Array.from({ length: target + 1 }).map((_, v) => `
    <button type="button" class="rep-btn${v === selected ? ' active' : ''}" data-value="${v}">${v}</button>
  `).join('');
}

function renderExerciseCard(id) {
  const ex = state.exercises[id];

  let setInputs;
  if (ex.type === 'hold') {
    setInputs = Array.from({ length: ex.sets }).map((_, i) => `
      <div class="set-input-wrap">
        <label>Set ${i + 1}</label>
        <input class="rep-input" type="number" inputmode="numeric" min="0" max="600"
               placeholder="sec" data-exercise="${id}" data-set="${i}" data-hold="true">
      </div>
    `).join('');
  } else if (ex.type === 'unilateral') {
    setInputs = Array.from({ length: ex.sets }).map((_, i) => `
      <div class="set-input-wrap">
        <label>Set ${i + 1} L</label>
        <div class="rep-picker" data-exercise="${id}" data-set="${i}" data-side="L" data-value="${ex.reps}">
          ${repButtons(ex.reps, ex.reps)}
        </div>
      </div>
      <div class="set-input-wrap">
        <label>Set ${i + 1} R</label>
        <div class="rep-picker" data-exercise="${id}" data-set="${i}" data-side="R" data-value="${ex.reps}">
          ${repButtons(ex.reps, ex.reps)}
        </div>
      </div>
    `).join('');
  } else {
    setInputs = Array.from({ length: ex.sets }).map((_, i) => `
      <div class="set-input-wrap">
        <label>Set ${i + 1}</label>
        <div class="rep-picker" data-exercise="${id}" data-set="${i}" data-value="${ex.reps}">
          ${repButtons(ex.reps, ex.reps)}
        </div>
      </div>
    `).join('');
  }

  const weightField = ex.type === 'hold' ? '' : `
    <div>
      <input class="weight-input" type="number" step="5" min="0"
             value="${ex.weight}" data-weight-for="${id}"> lb
    </div>
  `;

  return `
    <div class="card" data-exercise-card="${id}">
      <div class="card-title-row">
        <h3>${ex.name}</h3>
        ${weightField}
      </div>
      <p class="subtext" style="margin-bottom:10px;">${exerciseSubtitle(ex)}</p>
      <div class="sets-row">${setInputs}</div>
    </div>
  `;
}

function renderToday() {
  const day = state.nextWorkout;
  const exerciseIds = state.program[day] || [];

  if (exerciseIds.length === 0) {
    return `
      <h2>Workout ${day}</h2>
      <div class="empty-state">No exercises assigned to Day ${day} yet.<br>Add some in Settings.</div>
    `;
  }

  const cards = exerciseIds.map(renderExerciseCard).join('');

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
    const lifts = Object.entries(entry.lifts).map(([id, lift]) => {
      if (lift.type === 'hold') {
        return `
          <div class="history-lift-row">
            <span>${lift.name}</span>
            <span class="reps-list">${lift.times.map(t => t + 's').join(' · ')}</span>
          </div>
        `;
      }
      if (lift.type === 'unilateral') {
        const pairs = lift.repsL.map((l, i) => `${l}/${lift.repsR[i]}`).join(', ');
        return `
          <div class="history-lift-row">
            <span>${lift.name} &middot; ${lift.weight} lb</span>
            <span class="reps-list">${pairs}</span>
            <span class="pill ${lift.success ? 'good' : 'bad'}">${lift.success ? 'Hit it' : 'Missed'}</span>
          </div>
        `;
      }
      return `
        <div class="history-lift-row">
          <span>${lift.name} &middot; ${lift.weight} lb</span>
          <span class="reps-list">${lift.reps.join('-')}</span>
          <span class="pill ${lift.success ? 'good' : 'bad'}">${lift.success ? 'Hit it' : 'Missed'}</span>
        </div>
      `;
    }).join('');
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

function renderSettingsExerciseRow(id) {
  const ex = state.exercises[id];
  const inA = state.program.A.includes(id);
  const inB = state.program.B.includes(id);

  const weightFields = ex.type === 'hold' ? '' : `
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
  `;

  return `
    <div class="settings-row exercise-row">
      <div class="exercise-row-top">
        <div>
          <div>${ex.name}</div>
          <span class="subtext">${exerciseSubtitle(ex)}</span>
        </div>
        <button type="button" class="btn danger-text small" data-delete-exercise="${id}">Remove</button>
      </div>
      ${weightFields}
      <div class="day-toggles">
        <label><input type="checkbox" data-day-toggle data-exercise="${id}" data-day="A" ${inA ? 'checked' : ''}> Day A</label>
        <label><input type="checkbox" data-day-toggle data-exercise="${id}" data-day="B" ${inB ? 'checked' : ''}> Day B</label>
      </div>
    </div>
  `;
}

function renderSettings() {
  const rows = Object.keys(state.exercises).map(renderSettingsExerciseRow).join('');

  return `
    <h2>Exercises</h2>
    <p class="subtext">Adjust weights, assign each exercise to Day A/B, or remove it.</p>
    <div class="card">${rows}</div>

    <h2>Add Exercise</h2>
    <div class="card">
      <label>Name</label>
      <input type="text" id="new-ex-name" placeholder="e.g. Face Pull">

      <label style="margin-top:10px; display:block;">Type</label>
      <select id="new-ex-type">
        <option value="sets">Weighted sets</option>
        <option value="unilateral">Per side (left/right)</option>
        <option value="hold">Hold for time</option>
      </select>

      <div id="new-ex-sets-group" style="margin-top:10px;">
        <label>Sets</label>
        <input type="number" id="new-ex-sets" value="3" min="1" max="10">
      </div>
      <div id="new-ex-reps-group" style="margin-top:10px;">
        <label>Reps</label>
        <input type="number" id="new-ex-reps" value="5" min="1" max="30">
      </div>
      <div id="new-ex-weight-group" style="margin-top:10px;">
        <label>Starting weight</label>
        <input type="number" id="new-ex-weight" value="20" step="5" min="0">
        <label style="margin-top:6px; display:block;">+ per win</label>
        <input type="number" id="new-ex-increment" value="5" step="5" min="0">
      </div>

      <div class="day-toggles" style="margin-top:12px;">
        <label><input type="checkbox" id="new-ex-day-a"> Day A</label>
        <label><input type="checkbox" id="new-ex-day-b"> Day B</label>
      </div>

      <button class="btn secondary" id="add-exercise-btn" style="margin-top:14px;">Add Exercise</button>
    </div>

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

  document.querySelectorAll('.rep-btn').forEach(btn => {
    btn.onclick = () => {
      const picker = btn.closest('.rep-picker');
      picker.dataset.value = btn.dataset.value;
      picker.querySelectorAll('.rep-btn').forEach(b => b.classList.toggle('active', b === btn));
    };
  });

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

  document.querySelectorAll('[data-day-toggle]').forEach(cb => {
    cb.onchange = () => {
      const id = cb.dataset.exercise;
      const day = cb.dataset.day;
      const arr = state.program[day];
      const idx = arr.indexOf(id);
      if (cb.checked && idx === -1) arr.push(id);
      if (!cb.checked && idx !== -1) arr.splice(idx, 1);
      saveState();
    };
  });

  document.querySelectorAll('[data-delete-exercise]').forEach(btn => {
    btn.onclick = () => {
      const id = btn.dataset.deleteExercise;
      const name = state.exercises[id].name;
      if (!confirm(`Remove ${name}? Past history stays, but it won't show up in future workouts.`)) return;
      delete state.exercises[id];
      ['A', 'B'].forEach(day => {
        state.program[day] = state.program[day].filter(x => x !== id);
      });
      saveState();
      showToast(`${name} removed`);
      render();
    };
  });

  const newExType = document.getElementById('new-ex-type');
  if (newExType) {
    const updateFieldVisibility = () => {
      const isHold = newExType.value === 'hold';
      document.getElementById('new-ex-reps-group').style.display = isHold ? 'none' : 'block';
      document.getElementById('new-ex-weight-group').style.display = isHold ? 'none' : 'block';
    };
    newExType.onchange = updateFieldVisibility;
    updateFieldVisibility();
  }

  const addExerciseBtn = document.getElementById('add-exercise-btn');
  if (addExerciseBtn) addExerciseBtn.onclick = addExercise;

  const exportBtn = document.getElementById('export-btn');
  if (exportBtn) exportBtn.onclick = exportData;

  const importFile = document.getElementById('import-file');
  if (importFile) importFile.onchange = handleImport;
}

function addExercise() {
  const nameInput = document.getElementById('new-ex-name');
  const name = nameInput.value.trim();
  if (!name) { alert('Give the exercise a name first.'); return; }

  const type = document.getElementById('new-ex-type').value;
  const sets = Number(document.getElementById('new-ex-sets').value) || 1;
  const id = slugify(name);

  const ex = { name, type, sets };
  if (type !== 'hold') {
    ex.reps = Number(document.getElementById('new-ex-reps').value) || 1;
    ex.weight = Number(document.getElementById('new-ex-weight').value) || 0;
    ex.increment = Number(document.getElementById('new-ex-increment').value) || 0;
    ex.fails = 0;
  }
  state.exercises[id] = ex;

  if (document.getElementById('new-ex-day-a').checked) state.program.A.push(id);
  if (document.getElementById('new-ex-day-b').checked) state.program.B.push(id);

  saveState();
  showToast(`${name} added`);
  render();
}

function finishWorkout() {
  const day = state.nextWorkout;
  const exerciseIds = state.program[day] || [];
  const lifts = {};

  exerciseIds.forEach(id => {
    const ex = state.exercises[id];

    if (ex.type === 'hold') {
      const times = [];
      document.querySelectorAll(`[data-exercise="${id}"][data-hold="true"]`).forEach(input => {
        times.push(Number(input.value) || 0);
      });
      lifts[id] = { name: ex.name, type: 'hold', times };
      return;
    }

    if (ex.type === 'unilateral') {
      const weightInput = document.querySelector(`[data-weight-for="${id}"]`);
      const weightUsed = Number(weightInput.value) || ex.weight;
      const repsL = [];
      const repsR = [];
      for (let i = 0; i < ex.sets; i++) {
        repsL.push(Number(document.querySelector(`.rep-picker[data-exercise="${id}"][data-set="${i}"][data-side="L"]`).dataset.value) || 0);
        repsR.push(Number(document.querySelector(`.rep-picker[data-exercise="${id}"][data-set="${i}"][data-side="R"]`).dataset.value) || 0);
      }
      const success = repsL.every(r => r >= ex.reps) && repsR.every(r => r >= ex.reps);
      lifts[id] = { name: ex.name, type: 'unilateral', weight: weightUsed, repsL, repsR, success };
      progressExercise(ex, weightUsed, success);
      return;
    }

    const weightInput = document.querySelector(`[data-weight-for="${id}"]`);
    const weightUsed = Number(weightInput.value) || ex.weight;
    const reps = [];
    for (let i = 0; i < ex.sets; i++) {
      reps.push(Number(document.querySelector(`.rep-picker[data-exercise="${id}"][data-set="${i}"]`).dataset.value) || 0);
    }
    const success = reps.every(r => r >= ex.reps);
    lifts[id] = { name: ex.name, type: 'sets', weight: weightUsed, reps, success };
    progressExercise(ex, weightUsed, success);
  });

  state.history.push({ date: new Date().toISOString(), workout: day, lifts });
  state.nextWorkout = day === 'A' ? 'B' : 'A';
  saveState();
  showToast('Workout saved');
  render();
}

function progressExercise(ex, weightUsed, success) {
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

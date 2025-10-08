const STORAGE_KEY = 'shots-gained-rounds';
const CATEGORY_MAP = {
  Tee: 'Tee shots',
  Fairway: 'Approach',
  Rough: 'Approach',
  Sand: 'Short game',
  Recovery: 'Short game',
  Green: 'Putting',
};

let rounds = [];
let selectedRoundId = null;
let editingShotId = null;

const roundListEl = document.getElementById('round-list');
const roundForm = document.getElementById('round-form');
const deleteRoundBtn = document.getElementById('delete-round');
const exportBtn = document.getElementById('export-data');
const importInput = document.getElementById('import-data');
const emptyState = document.getElementById('empty-state');
const roundView = document.getElementById('round-view');
const roundTitle = document.getElementById('round-title');
const roundMeta = document.getElementById('round-meta');
const roundNotes = document.getElementById('round-notes');
const summaryEl = document.getElementById('summary');
const shotTable = document.getElementById('shot-table');
const shotForm = document.getElementById('shot-form');
const cancelEditBtn = document.getElementById('cancel-edit');
const clearShotsBtn = document.getElementById('clear-shots');

const shotIdInput = document.getElementById('shotId');
const holeInput = document.getElementById('hole');
const shotNumberInput = document.getElementById('shotNumber');
const lieInput = document.getElementById('lie');
const distanceInput = document.getElementById('distance');
const expectedInput = document.getElementById('expected');
const actualInput = document.getElementById('actual');
const shotNotesInput = document.getElementById('shotNotes');
const saveShotBtn = document.getElementById('save-shot');

function loadRounds() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed)) {
        rounds = parsed;
      }
    }
  } catch (error) {
    console.error('Failed to load rounds from localStorage', error);
  }
}

function persistRounds() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(rounds));
  } catch (error) {
    console.error('Failed to save rounds', error);
  }
}

function createRound({ name, course, date, notes }) {
  const round = {
    id: `round-${Date.now()}`,
    name,
    course,
    date,
    notes,
    shots: [],
  };
  rounds.unshift(round);
  persistRounds();
  setSelectedRound(round.id);
  renderRoundList();
}

function deleteSelectedRound() {
  if (!selectedRoundId) return;
  const round = getSelectedRound();
  const confirmed = confirm(`Delete \"${round.name}\" and all of its shots?`);
  if (!confirmed) return;
  rounds = rounds.filter((r) => r.id !== selectedRoundId);
  persistRounds();
  selectedRoundId = rounds[0]?.id ?? null;
  renderRoundList();
  updateRoundView();
}

function getSelectedRound() {
  return rounds.find((round) => round.id === selectedRoundId) ?? null;
}

function setSelectedRound(id) {
  selectedRoundId = id;
  renderRoundList();
  updateRoundView();
}

function renderRoundList() {
  roundListEl.innerHTML = '';
  if (!rounds.length) {
    const emptyItem = document.createElement('li');
    emptyItem.className = 'muted';
    emptyItem.textContent = 'No rounds yet. Create one above.';
    roundListEl.appendChild(emptyItem);
    deleteRoundBtn.disabled = true;
    return;
  }

  rounds.forEach((round) => {
    const item = document.createElement('li');
    const button = document.createElement('button');
    button.textContent = round.name;

    const meta = [];
    if (round.course) meta.push(round.course);
    if (round.date) meta.push(formatDate(round.date));
    if (meta.length) {
      const subtitle = document.createElement('div');
      subtitle.className = 'muted';
      subtitle.textContent = meta.join(' · ');
      button.appendChild(document.createElement('br'));
      button.appendChild(subtitle);
    }

    if (round.id === selectedRoundId) {
      button.classList.add('active');
    }

    button.addEventListener('click', () => {
      setSelectedRound(round.id);
    });

    item.appendChild(button);
    roundListEl.appendChild(item);
  });

  deleteRoundBtn.disabled = !selectedRoundId;
}

function updateRoundView() {
  const round = getSelectedRound();
  if (!round) {
    roundView.classList.add('hidden');
    emptyState.classList.remove('hidden');
    deleteRoundBtn.disabled = true;
    return;
  }

  emptyState.classList.add('hidden');
  roundView.classList.remove('hidden');
  deleteRoundBtn.disabled = false;

  roundTitle.textContent = round.name;
  const metaParts = [];
  if (round.course) metaParts.push(round.course);
  if (round.date) metaParts.push(formatDate(round.date));
  roundMeta.textContent = metaParts.join(' · ');
  roundNotes.textContent = round.notes ?? '';
  roundNotes.classList.toggle('hidden', !round.notes);

  resetShotForm();
  renderSummary(round);
  renderShots(round);
}

function renderSummary(round) {
  if (!round.shots.length) {
    summaryEl.innerHTML = '<p class="muted">Add shots to see your strokes gained summary.</p>';
    return;
  }

  const totals = {
    overall: 0,
    categories: {},
    holes: new Set(),
    shots: round.shots.length,
  };

  Object.values(CATEGORY_MAP).forEach((label) => {
    totals.categories[label] = 0;
  });

  round.shots.forEach((shot) => {
    const gained = calculateStrokesGained(shot);
    totals.overall += gained;
    const categoryLabel = CATEGORY_MAP[shot.lie] ?? 'Other';
    totals.categories[categoryLabel] = (totals.categories[categoryLabel] ?? 0) + gained;
    totals.holes.add(shot.hole);
  });

  const averagePerHole = totals.holes.size ? totals.overall / totals.holes.size : 0;
  const averagePerShot = totals.shots ? totals.overall / totals.shots : 0;

  const summaryCards = [
    createSummaryCard('Total strokes gained', totals.overall),
    createSummaryCard('Per hole', averagePerHole),
    createSummaryCard('Per shot', averagePerShot),
  ];

  Object.entries(totals.categories).forEach(([label, value]) => {
    summaryCards.push(createSummaryCard(label, value));
  });

  summaryEl.innerHTML = '';
  summaryCards.forEach((card) => summaryEl.appendChild(card));
}

function createSummaryCard(label, value) {
  const card = document.createElement('div');
  card.className = 'summary-card';
  const title = document.createElement('h4');
  title.textContent = label;
  const mainValue = document.createElement('div');
  mainValue.className = 'value';
  mainValue.textContent = formatNumber(value);
  card.appendChild(title);
  card.appendChild(mainValue);
  return card;
}

function renderShots(round) {
  const shots = [...round.shots].sort((a, b) => {
    if (a.hole !== b.hole) return a.hole - b.hole;
    return a.shotNumber - b.shotNumber;
  });

  shotTable.innerHTML = '';

  if (!shots.length) {
    const emptyRow = document.createElement('tr');
    const cell = document.createElement('td');
    cell.colSpan = 9;
    cell.className = 'muted';
    cell.textContent = 'No shots logged yet.';
    emptyRow.appendChild(cell);
    shotTable.appendChild(emptyRow);
    return;
  }

  shots.forEach((shot) => {
    const row = document.createElement('tr');
    row.dataset.id = shot.id;

    row.innerHTML = `
      <td>${shot.hole}</td>
      <td>${shot.shotNumber}</td>
      <td><span class="badge">${shot.lie}</span></td>
      <td>${shot.distance !== null && shot.distance !== undefined ? `${formatNumber(shot.distance)} yds` : '—'}</td>
      <td>${formatNumber(shot.expectedStrokes)}</td>
      <td>${formatNumber(shot.actualStrokes)}</td>
      <td>${formatNumber(calculateStrokesGained(shot))}</td>
      <td>${shot.notes ? escapeHtml(shot.notes) : '—'}</td>
      <td>
        <div class="table-actions">
          <button type="button" class="secondary" data-action="edit">Edit</button>
          <button type="button" class="danger" data-action="delete">Delete</button>
        </div>
      </td>
    `;

    shotTable.appendChild(row);
  });
}

function resetShotForm() {
  shotForm.reset();
  editingShotId = null;
  cancelEditBtn.hidden = true;
  saveShotBtn.textContent = 'Save shot';
}

function calculateStrokesGained(shot) {
  return (Number(shot.expectedStrokes) || 0) - (Number(shot.actualStrokes) || 0);
}

function formatNumber(value) {
  return Number(value).toFixed(2);
}

function formatDate(dateStr) {
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return dateStr;
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function escapeHtml(value) {
  const div = document.createElement('div');
  div.textContent = value;
  return div.innerHTML;
}

roundForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const formData = new FormData(roundForm);
  const name = formData.get('roundName').trim();
  if (!name) return;
  createRound({
    name,
    course: formData.get('course').trim(),
    date: formData.get('date'),
    notes: formData.get('roundNotes').trim(),
  });
  roundForm.reset();
});

deleteRoundBtn.addEventListener('click', deleteSelectedRound);

exportBtn.addEventListener('click', () => {
  const data = JSON.stringify(rounds, null, 2);
  const blob = new Blob([data], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'shots-gained-rounds.json';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
});

importInput.addEventListener('change', (event) => {
  const file = event.target.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const imported = JSON.parse(e.target.result);
      if (!Array.isArray(imported)) {
        throw new Error('Invalid file format');
      }
      rounds = imported;
      persistRounds();
      selectedRoundId = rounds[0]?.id ?? null;
      renderRoundList();
      updateRoundView();
      alert('Rounds imported successfully');
    } catch (error) {
      console.error(error);
      alert('Could not import file. Please make sure it was exported from this app.');
    }
  };
  reader.readAsText(file);
  importInput.value = '';
});

shotForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const round = getSelectedRound();
  if (!round) return;

  const formData = new FormData(shotForm);
  const shotData = {
    id: editingShotId ?? `shot-${Date.now()}`,
    hole: Number(formData.get('hole')),
    shotNumber: Number(formData.get('shotNumber')),
    lie: formData.get('lie'),
    distance: formData.get('distance') ? Number(formData.get('distance')) : null,
    expectedStrokes: Number(formData.get('expected')),
    actualStrokes: Number(formData.get('actual')),
    notes: formData.get('shotNotes').trim(),
  };

  if (!shotData.hole || !shotData.shotNumber || !shotData.lie) {
    alert('Please fill in the required shot details.');
    return;
  }

  const existingIndex = round.shots.findIndex((shot) => shot.id === shotData.id);
  if (existingIndex >= 0) {
    round.shots[existingIndex] = shotData;
  } else {
    round.shots.push(shotData);
  }

  persistRounds();
  resetShotForm();
  renderSummary(round);
  renderShots(round);
});

cancelEditBtn.addEventListener('click', () => {
  resetShotForm();
});

shotTable.addEventListener('click', (event) => {
  const button = event.target.closest('button');
  if (!button) return;
  const row = button.closest('tr');
  const shotId = row?.dataset.id;
  if (!shotId) return;
  const round = getSelectedRound();
  if (!round) return;
  const shot = round.shots.find((s) => s.id === shotId);
  if (!shot) return;

  const action = button.dataset.action;
  if (action === 'delete') {
    const confirmed = confirm('Delete this shot?');
    if (!confirmed) return;
    round.shots = round.shots.filter((s) => s.id !== shotId);
    persistRounds();
    renderSummary(round);
    renderShots(round);
    resetShotForm();
  } else if (action === 'edit') {
    editingShotId = shot.id;
    shotIdInput.value = shot.id;
    holeInput.value = shot.hole;
    shotNumberInput.value = shot.shotNumber;
    lieInput.value = shot.lie;
    distanceInput.value = shot.distance ?? '';
    expectedInput.value = shot.expectedStrokes;
    actualInput.value = shot.actualStrokes;
    shotNotesInput.value = shot.notes ?? '';
    cancelEditBtn.hidden = false;
    saveShotBtn.textContent = 'Update shot';
  }
});

clearShotsBtn.addEventListener('click', () => {
  const round = getSelectedRound();
  if (!round || !round.shots.length) return;
  const confirmed = confirm('Remove all shots from this round?');
  if (!confirmed) return;
  round.shots = [];
  persistRounds();
  renderSummary(round);
  renderShots(round);
  resetShotForm();
});

loadRounds();
if (rounds.length) {
  selectedRoundId = rounds[0].id;
  renderRoundList();
  updateRoundView();
} else {
  renderRoundList();
  updateRoundView();
}

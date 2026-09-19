/**
 * App controller — wires camera, OMR, parser, and player together
 */

const camera = new Camera();
const player = new Player();

// ── State ──────────────────────────────────────────────────────────────────
let capturedDataUrl = null;
let currentNoteIndex = -1;
let parsedData = null;

// ── DOM refs ────────────────────────────────────────────────────────────────
const screens = {
  home:       document.getElementById('screen-home'),
  preview:    document.getElementById('screen-preview'),
  processing: document.getElementById('screen-processing'),
  player:     document.getElementById('screen-player'),
};

const videoEl   = document.getElementById('camera-video');
const canvasEl  = document.getElementById('camera-canvas');
const previewEl = document.getElementById('preview-img');
const fileInput = document.getElementById('file-input');

const btnCapture    = document.getElementById('btn-capture');
const btnUpload     = document.getElementById('btn-upload');
const btnDemo       = document.getElementById('btn-demo');
const btnRetake     = document.getElementById('btn-retake');
const btnRecognize  = document.getElementById('btn-recognize');
const btnPlayPause  = document.getElementById('btn-play-pause');
const btnStop       = document.getElementById('btn-stop');
const btnNewScore   = document.getElementById('btn-new-score');

const processingMsg = document.getElementById('processing-msg');
const scoreTitle    = document.getElementById('score-title');
const scoreMeta     = document.getElementById('score-meta');
const noteDisplay   = document.getElementById('note-display');
const tempoSlider   = document.getElementById('tempo-slider');
const tempoDisplay  = document.getElementById('tempo-display');
const volumeSlider  = document.getElementById('volume-slider');
const instrumentSel = document.getElementById('instrument-select');
const noteRoll      = document.getElementById('note-roll');
const errorBanner   = document.getElementById('error-banner');
const errorMsg      = document.getElementById('error-msg');

// ── Screen transitions ──────────────────────────────────────────────────────
function showScreen(name) {
  Object.entries(screens).forEach(([k, el]) => {
    el.hidden = k !== name;
  });
}

// ── Error banner ────────────────────────────────────────────────────────────
function showError(msg) {
  errorMsg.textContent = msg;
  errorBanner.hidden = false;
}
function hideError() {
  errorBanner.hidden = true;
}

document.getElementById('btn-error-close').addEventListener('click', hideError);

// ── Camera startup ───────────────────────────────────────────────────────────
async function startCamera() {
  if (!Camera.isAvailable()) {
    btnCapture.disabled = true;
    btnCapture.title = 'カメラを利用できません';
    return;
  }
  try {
    await camera.start(videoEl, canvasEl);
  } catch (e) {
    showError('カメラへのアクセスが拒否されました。ファイルアップロードをお使いください。');
    btnCapture.disabled = true;
  }
}

// ── Capture ──────────────────────────────────────────────────────────────────
btnCapture.addEventListener('click', () => {
  capturedDataUrl = camera.capture();
  previewEl.src = capturedDataUrl;
  camera.stop();
  showScreen('preview');
});

btnUpload.addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', e => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = ev => {
    capturedDataUrl = ev.target.result;
    previewEl.src = capturedDataUrl;
    camera.stop();
    showScreen('preview');
  };
  reader.readAsDataURL(file);
  fileInput.value = '';
});

// ── Demo mode ────────────────────────────────────────────────────────────────
btnDemo.addEventListener('click', async () => {
  hideError();
  showScreen('processing');
  setProcessingMsg('デモ楽譜を読み込み中…');
  try {
    const xml = await recognizeScoreDemo();
    await loadScore(xml, 'デモ（キラキラ星）');
  } catch (e) {
    showError('デモの読み込みに失敗しました: ' + e.message);
    showScreen('home');
  }
});

// ── Preview actions ───────────────────────────────────────────────────────────
btnRetake.addEventListener('click', async () => {
  showScreen('home');
  await startCamera();
});

btnRecognize.addEventListener('click', async () => {
  hideError();
  showScreen('processing');
  setProcessingMsg('楽譜を認識中…');

  try {
    let xml;
    if (OMR_API_URL) {
      xml = await recognizeScore(capturedDataUrl);
    } else {
      // No API configured — fall back to demo with a notice
      showError('OMR_API_URL が未設定のため、デモ楽譜で代替します。');
      xml = await recognizeScoreDemo();
    }
    await loadScore(xml, '認識された楽譜');
  } catch (e) {
    showError('認識エラー: ' + e.message);
    showScreen('preview');
  }
});

function setProcessingMsg(msg) {
  if (processingMsg) processingMsg.textContent = msg;
}

// ── Load score and show player ────────────────────────────────────────────────
async function loadScore(xml, fallbackTitle) {
  parsedData = parseMusicXML(xml);
  if (!parsedData.notes.length) {
    throw new Error('楽譜から音符を読み取れませんでした');
  }

  await player.init();
  player.load(parsedData);
  player.setVolume(parseInt(volumeSlider.value));

  player.onNotePlay = idx => {
    currentNoteIndex = idx;
    renderNoteRoll(idx);
    noteDisplay.textContent = parsedData.notes[idx]?.note ?? '';
  };
  player.onEnd = () => {
    btnPlayPause.textContent = '▶';
    btnPlayPause.setAttribute('aria-label', '再生');
    currentNoteIndex = -1;
  };

  const t = parsedData.title || fallbackTitle;
  scoreTitle.textContent = t;
  scoreMeta.textContent = `${parsedData.timeBeats}/${parsedData.timeBeatType}  ♩=${parsedData.bpm}`;

  tempoSlider.value = parsedData.bpm;
  tempoDisplay.textContent = parsedData.bpm;

  buildNoteRoll();
  showScreen('player');
  player.play();
  btnPlayPause.textContent = '⏸';
  btnPlayPause.setAttribute('aria-label', '一時停止');
}

// ── Note roll visualizer ──────────────────────────────────────────────────────
function buildNoteRoll() {
  noteRoll.innerHTML = '';
  if (!parsedData) return;
  parsedData.notes.forEach((n, i) => {
    const span = document.createElement('span');
    span.className = 'note-chip';
    span.dataset.idx = i;
    span.textContent = n.note.replace(/(\d)/, '');
    noteRoll.appendChild(span);
  });
}

function renderNoteRoll(activeIdx) {
  noteRoll.querySelectorAll('.note-chip').forEach(chip => {
    const i = parseInt(chip.dataset.idx);
    chip.classList.toggle('active', i === activeIdx);
    chip.classList.toggle('played', i < activeIdx);
  });
  // Scroll active chip into view
  const active = noteRoll.querySelector('.note-chip.active');
  if (active) active.scrollIntoView({ inline: 'center', behavior: 'smooth', block: 'nearest' });
}

// ── Player controls ───────────────────────────────────────────────────────────
btnPlayPause.addEventListener('click', async () => {
  await Tone.start();
  if (player.isPlaying()) {
    player.pause();
    btnPlayPause.textContent = '▶';
    btnPlayPause.setAttribute('aria-label', '再生');
  } else {
    player.play();
    btnPlayPause.textContent = '⏸';
    btnPlayPause.setAttribute('aria-label', '一時停止');
  }
});

btnStop.addEventListener('click', () => {
  player.stop();
  btnPlayPause.textContent = '▶';
  btnPlayPause.setAttribute('aria-label', '再生');
  currentNoteIndex = -1;
  renderNoteRoll(-1);
  noteDisplay.textContent = '';
});

btnNewScore.addEventListener('click', async () => {
  player.stop();
  showScreen('home');
  await startCamera();
});

tempoSlider.addEventListener('input', () => {
  const bpm = parseInt(tempoSlider.value);
  tempoDisplay.textContent = bpm;
  player.setTempo(bpm);
  if (player.isPlaying() || player.isPaused()) {
    btnPlayPause.textContent = '▶';
    btnPlayPause.setAttribute('aria-label', '再生');
  }
});

volumeSlider.addEventListener('input', () => {
  player.setVolume(parseInt(volumeSlider.value));
});

instrumentSel.addEventListener('change', () => {
  player.setInstrument(instrumentSel.value);
});

// ── Boot ──────────────────────────────────────────────────────────────────────
(async () => {
  showScreen('home');
  await startCamera();
})();

const chapters = {
  origin: {
    title: '少年笔下，千里江山',
    meta: '北宋 · 王希孟 · 绢本设色',
    lead: '一卷山河，铺展出宋人的理想天地。',
    paragraphs: [
      '《千里江山图》是北宋画家王希孟的传世作品，现藏故宫博物院。原作纵51.5厘米，横1191.5厘米，在绢上以青绿设色描绘广阔山河。',
      '卷后蔡京题跋记载，希孟时年十八，曾在宋徽宗指导下学习绘画。这段题跋为理解画家的学习经历与作品来处，留下了重要线索。'
    ],
    imagePosition: '72% center', imageAlt: '原创画卷中青绿山峰与山间亭台的局部'
  },
  color: {
    title: '石青石绿，山河生色',
    meta: '青绿山水 · 矿物颜料 · 工细笔致',
    lead: '青与绿，让山水有了宝石般的光彩。',
    paragraphs: [
      '青绿山水主要使用石青、石绿等矿物颜料。青蓝与碧绿交错铺陈，间以赭色，让山峦既有厚重的体积，也有明亮的层次。',
      '王希孟把细腻的勾画与丰富的设色结合起来。近看有清晰的水纹、舟船与小小人物，远看则是峰峦连绵、江水开阔的山河气象。'
    ],
    imagePosition: '78% 28%', imageAlt: '原创画卷中石青与石绿交叠的山峰局部'
  },
  fame: {
    title: '步移景异，一卷山河',
    meta: '长卷构图 · 多点透视 · 宋代青绿山水',
    lead: '随着画卷展开，目光也在山水间游历。',
    paragraphs: [
      '十余米长卷以多点透视组织山河，山体、流水和长桥连接起不同段落。高远、深远与平远相互穿插，带来不断变化的观看体验。',
      '恢宏的整体构图、精细的笔致与绚丽的青绿色彩相互成就，使它成为宋代青绿山水的重要作品。亭台、村舍和舟船，又让宏大山河中保留了可亲近的生活气息。'
    ],
    imagePosition: '42% 75%', imageAlt: '原创画卷中江水、小舟和连绵山峰的局部'
  }
};

const byId = id => document.getElementById(id);
const gallery = byId('gallery');
const landscape = byId('landscape');
const panInput = byId('pan-position');
const minimapWindow = byId('minimap-window');
const hero = byId('hero-copy');
const tourButton = byId('tour-toggle');
const dialog = byId('story-dialog');
const audio = byId('recorded-audio');
const narrationButton = byId('narration-toggle');
const audioStatus = byId('audio-status');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const hotspots = [...document.querySelectorAll('.hotspot')];
const recordings = new Map();
const clamp = value => Math.max(0, Math.min(1, value));
let currentPosition = .1;
let targetPosition = .1;
let panVelocity = 0;
let frame = 0;
let lastTime = 0;
let automatic = false;
let direction = 1;
let drag = null;
let suppressClick = false;
let activeChapter = 'origin';
let speechState = 'idle';
let speechEpoch = 0;
let utterance = null;

function renderPan() {
  const overflow = Math.max(0, landscape.offsetWidth - gallery.clientWidth);
  landscape.style.transform = `translate3d(${-currentPosition * overflow}px, 0, 0)`;
  hotspots.forEach(hotspot => {
    hotspot.classList.toggle('label-left', hotspot.offsetLeft - currentPosition * overflow > gallery.clientWidth - 225);
  });
  const ratio = Math.min(1, gallery.clientWidth / landscape.offsetWidth);
  minimapWindow.style.width = `${ratio * 100}%`;
  minimapWindow.style.left = `${currentPosition * (1 - ratio) * 100}%`;
  panInput.value = String(currentPosition * 100);
  panInput.setAttribute('aria-valuetext', `画卷位置 ${Math.round(currentPosition * 100)}%`);
  byId('position-label').textContent = `卷中位置 ${Math.round(currentPosition * 100)}%`;
  byId('pan-left').disabled = currentPosition < .001;
  byId('pan-right').disabled = currentPosition > .999;
}

function animate(time) {
  const delta = Math.min(64, lastTime ? time - lastTime : 16);
  lastTime = time;
  if (automatic) {
    targetPosition += direction * delta / 85000;
    if (targetPosition >= 1 || targetPosition <= 0) {
      targetPosition = clamp(targetPosition);
      direction *= -1;
    }
  }
  // A critically damped spring preserves the current position and velocity when redirected.
  const decay = Math.exp(-20 * delta / 1000);
  const offset = currentPosition - targetPosition;
  const travel = (panVelocity + 20 * offset) * delta / 1000;
  currentPosition = targetPosition + (offset + travel) * decay;
  panVelocity = (panVelocity - 20 * travel) * decay;
  if (currentPosition < 0 || currentPosition > 1) { currentPosition = clamp(currentPosition); panVelocity = 0; }
  if (reducedMotion.matches || (Math.abs(targetPosition - currentPosition) < .0002 && Math.abs(panVelocity) < .002)) {
    currentPosition = targetPosition; panVelocity = 0;
  }
  renderPan();
  if (automatic || currentPosition !== targetPosition) frame = requestAnimationFrame(animate);
  else { frame = 0; lastTime = 0; }
}

function requestPan(position) {
  targetPosition = clamp(position);
  if (!frame) frame = requestAnimationFrame(animate);
}

function stopPan() {
  cancelAnimationFrame(frame);
  frame = 0; lastTime = 0; panVelocity = 0;
  targetPosition = currentPosition;
}

function setAutomatic(enabled) {
  automatic = enabled;
  tourButton.setAttribute('aria-pressed', String(enabled));
  tourButton.querySelector('span').textContent = enabled ? '暂停游览' : '自动游览';
  tourButton.querySelector('use').setAttribute('href', enabled ? '#i-pause' : '#i-play');
  if (enabled) requestPan(targetPosition);
  else stopPan();
}

function setExploring(enabled) {
  gallery.classList.toggle('is-exploring', enabled);
  hero.inert = enabled;
  hero.setAttribute('aria-hidden', String(enabled));
  byId('return-title').hidden = !enabled;
}

gallery.addEventListener('pointermove', event => {
  if (dialog.open) return;
  if (drag && drag.id === event.pointerId) {
    const distance = event.clientX - drag.x;
    if (!drag.moved) {
      const vertical = event.clientY - drag.y;
      if (Math.max(Math.abs(distance), Math.abs(vertical)) < 10) return;
      if (Math.abs(vertical) > Math.abs(distance)) { drag = null; return; }
      drag.moved = true;
      setExploring(true);
      gallery.setPointerCapture(event.pointerId);
    }
    currentPosition = targetPosition = clamp(drag.position - distance / drag.overflow);
    drag.samples.push({ x: event.clientX, time: event.timeStamp });
    while (drag.samples.length > 2 && event.timeStamp - drag.samples[0].time > 100) drag.samples.shift();
    renderPan();
    return;
  }
  if (event.pointerType !== 'mouse') return;
  if (event.target.closest('.hotspot')) { setAutomatic(false); return; }
  if (automatic || event.target.closest('button')) return;
  const bounds = gallery.getBoundingClientRect();
  requestPan((event.clientX - bounds.left) / bounds.width);
});

gallery.addEventListener('pointerdown', event => {
  if (event.pointerType === 'mouse' || !event.isPrimary || (event.target.closest('button') && !event.target.closest('.hotspot'))) return;
  setAutomatic(false);
  drag = { id: event.pointerId, x: event.clientX, y: event.clientY, position: currentPosition, moved: false,
    overflow: Math.max(1, landscape.offsetWidth - gallery.clientWidth), samples: [{ x: event.clientX, time: event.timeStamp }] };
});
function finishDrag(event) {
  if (!drag || drag.id !== event.pointerId) return;
  suppressClick = drag.moved;
  if (drag.moved && event.type === 'pointerup' && !reducedMotion.matches) {
    const first = drag.samples[0];
    const last = drag.samples.at(-1);
    if (event.timeStamp - last.time < 80 && last.time > first.time) {
      panVelocity = Math.max(-2, Math.min(2, (first.x - last.x) / drag.overflow * 1000 / (last.time - first.time)));
      // Exponential deceleration projects a short glide; another touch stops it immediately.
      requestPan(currentPosition + panVelocity * .18);
    }
  }
  if (gallery.hasPointerCapture(event.pointerId)) gallery.releasePointerCapture(event.pointerId);
  drag = null;
  // A drag must not accidentally activate a hotspot when the finger lifts.
  setTimeout(() => { suppressClick = false; }, 0);
}
gallery.addEventListener('pointerup', finishDrag);
gallery.addEventListener('pointercancel', finishDrag);
gallery.addEventListener('click', event => {
  if (suppressClick) { event.preventDefault(); event.stopPropagation(); }
}, true);

gallery.addEventListener('keydown', event => {
  if (event.target !== gallery) return;
  const positions = { ArrowLeft: targetPosition - .08, ArrowRight: targetPosition + .08, Home: 0, End: 1 };
  if (!(event.key in positions)) return;
  event.preventDefault(); setAutomatic(false); requestPan(positions[event.key]);
});
panInput.addEventListener('pointerdown', () => setAutomatic(false));
panInput.addEventListener('input', () => {
  setAutomatic(false);
  currentPosition = targetPosition = Number(panInput.value) / 100;
  renderPan();
});
byId('pan-left').addEventListener('click', () => { setAutomatic(false); requestPan(targetPosition - .14); });
byId('pan-right').addEventListener('click', () => { setAutomatic(false); requestPan(targetPosition + .14); });
tourButton.addEventListener('click', () => { setExploring(true); setAutomatic(!automatic); });
byId('start-explore').addEventListener('click', () => { setExploring(true); gallery.focus({ preventScroll: true }); setAutomatic(true); });
byId('nav-explore').addEventListener('click', () => { setExploring(true); gallery.focus({ preventScroll: true }); });
byId('return-title').addEventListener('click', () => {
  setAutomatic(false); requestPan(.1); setExploring(false); byId('start-explore').focus({ preventScroll: true });
});
hotspots.forEach(hotspot => {
  hotspot.addEventListener('focus', () => {
    setAutomatic(false);
    const overflow = landscape.offsetWidth - gallery.clientWidth;
    const center = hotspot.offsetLeft - gallery.clientWidth / 2;
    const screenX = hotspot.offsetLeft - currentPosition * overflow;
    if (hotspot.matches(':focus-visible') && overflow > 0 && (screenX < 24 || screenX > gallery.clientWidth - 24)) requestPan(center / overflow);
  });
  hotspot.addEventListener('click', () => openStory(hotspot.dataset.chapter));
});
new ResizeObserver(renderPan).observe(gallery);
byId('landscape').querySelector('img').addEventListener('error', () => { byId('load-error').hidden = false; });

function resetNarration() {
  speechEpoch += 1;
  if ('speechSynthesis' in window) speechSynthesis.cancel();
  utterance = null;
  speechState = 'idle';
  audio.pause();
  updatePlayButton();
}

function updatePlayButton() {
  const playing = recordings.has(activeChapter) ? !audio.paused : speechState === 'playing' || speechState === 'loading';
  narrationButton.querySelector('use').setAttribute('href', playing ? '#i-pause' : '#i-play');
  narrationButton.setAttribute('aria-label', playing ? '暂停本节讲解' : '播放本节讲解');
}

function loadRecording() {
  const recording = recordings.get(activeChapter);
  audio.removeAttribute('src');
  audio.load();
  if (recording) {
    audio.src = recording.url;
    audioStatus.textContent = `真人音频 · ${recording.name}`;
    audioStatus.title = recording.name;
  } else {
    audioStatus.textContent = '系统试读 · 可导入真人音频';
    audioStatus.removeAttribute('title');
  }
  byId('audio-seek').hidden = true;
  byId('audio-position').value = '0';
  updatePlayButton();
}

function selectChapter(key) {
  resetNarration();
  activeChapter = key;
  const chapter = chapters[key];
  byId('story-title').textContent = chapter.title;
  byId('story-meta').textContent = chapter.meta;
  byId('story-lead').textContent = chapter.lead;
  const paragraphs = chapter.paragraphs.map(text => { const p = document.createElement('p'); p.textContent = text; return p; });
  byId('story-paragraphs').replaceChildren(...paragraphs);
  byId('story-image').style.objectPosition = chapter.imagePosition;
  byId('story-image').alt = chapter.imageAlt;
  document.querySelectorAll('[data-tab]').forEach(tab => {
    const selected = tab.dataset.tab === key;
    tab.setAttribute('aria-selected', String(selected));
    tab.tabIndex = selected ? 0 : -1;
  });
  byId('story-panel').setAttribute('aria-labelledby', `tab-${key}`);
  byId('story-panel').scrollTop = 0;
  loadRecording();
}

function openStory(key = 'origin') {
  setAutomatic(false);
  selectChapter(key);
  if (!dialog.open) dialog.showModal();
}
reducedMotion.addEventListener('change', () => { setAutomatic(false); renderPan(); });
byId('nav-story').addEventListener('click', () => openStory());
byId('nav-listen').addEventListener('click', () => { openStory(); narrationButton.focus(); });
byId('close-story').addEventListener('click', () => dialog.close());
dialog.addEventListener('close', resetNarration);
dialog.addEventListener('click', event => {
  const bounds = dialog.getBoundingClientRect();
  if (event.target === dialog && (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom)) dialog.close();
});
const tabs = [...document.querySelectorAll('[data-tab]')];
tabs.forEach((tab, index) => {
  tab.addEventListener('click', () => selectChapter(tab.dataset.tab));
  tab.addEventListener('keydown', event => {
    let next;
    if (event.key === 'ArrowRight') next = (index + 1) % tabs.length;
    if (event.key === 'ArrowLeft') next = (index + tabs.length - 1) % tabs.length;
    if (event.key === 'Home') next = 0;
    if (event.key === 'End') next = tabs.length - 1;
    if (next === undefined) return;
    event.preventDefault(); selectChapter(tabs[next].dataset.tab); tabs[next].focus();
  });
});

narrationButton.addEventListener('click', async () => {
  if (recordings.has(activeChapter)) {
    if (!audio.paused) { audio.pause(); return; }
    try { await audio.play(); }
    catch { audioStatus.textContent = '录音未能播放，请换用 MP3 或 WAV 文件。'; }
    return;
  }
  if (!('speechSynthesis' in window)) { audioStatus.textContent = '设备不支持系统试读，请导入真人录音。'; return; }
  if (speechState === 'playing') { speechSynthesis.pause(); speechState = 'paused'; updatePlayButton(); return; }
  if (speechState === 'paused') { speechSynthesis.resume(); speechState = 'playing'; updatePlayButton(); return; }
  if (speechState === 'loading') { resetNarration(); return; }
  resetNarration();
  const epoch = speechEpoch;
  const chapter = chapters[activeChapter];
  utterance = new SpeechSynthesisUtterance([chapter.title, chapter.lead, ...chapter.paragraphs].join('。'));
  utterance.lang = 'zh-CN';
  utterance.rate = .88;
  const chineseVoice = speechSynthesis.getVoices().find(voice => /^zh[-_]/i.test(voice.lang));
  if (chineseVoice) utterance.voice = chineseVoice;
  utterance.onstart = () => { if (epoch === speechEpoch) { speechState = 'playing'; audioStatus.textContent = '系统试读中 · 设备语音'; updatePlayButton(); } };
  utterance.onend = () => { if (epoch === speechEpoch) { speechState = 'idle'; audioStatus.textContent = '试读结束 · 可导入真人音频'; updatePlayButton(); } };
  utterance.onerror = () => { if (epoch === speechEpoch) { speechState = 'idle'; audioStatus.textContent = '系统试读暂不可用，请导入真人录音。'; updatePlayButton(); } };
  speechState = 'loading';
  audioStatus.textContent = '正在启动系统试读…';
  updatePlayButton();
  speechSynthesis.speak(utterance);
});

byId('import-audio').addEventListener('click', () => byId('audio-file').click());
byId('audio-file').addEventListener('change', event => {
  const file = event.target.files[0];
  if (!file) return;
  if (!(file.type.startsWith('audio/') || /\.(mp3|wav|m4a|ogg|aac|flac|webm)$/i.test(file.name))) {
    audioStatus.textContent = '请选择音频文件，例如 MP3 或 WAV。'; event.target.value = ''; return;
  }
  resetNarration();
  const old = recordings.get(activeChapter);
  if (old) URL.revokeObjectURL(old.url);
  recordings.set(activeChapter, { name: file.name, url: URL.createObjectURL(file) });
  loadRecording();
  event.target.value = '';
});
audio.addEventListener('play', updatePlayButton);
audio.addEventListener('pause', updatePlayButton);
audio.addEventListener('ended', updatePlayButton);
audio.addEventListener('error', () => { if (audio.hasAttribute('src')) audioStatus.textContent = '无法读取这段录音，请换用 MP3 或 WAV。'; });
const formatTime = seconds => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;
function updateAudioTime() {
  if (!Number.isFinite(audio.duration) || audio.duration <= 0) return;
  byId('audio-seek').hidden = false;
  byId('audio-position').value = String(audio.currentTime / audio.duration * 100);
  byId('audio-time').textContent = `${formatTime(audio.currentTime)} / ${formatTime(audio.duration)}`;
}
audio.addEventListener('loadedmetadata', updateAudioTime);
audio.addEventListener('timeupdate', updateAudioTime);
byId('audio-position').addEventListener('input', event => {
  if (Number.isFinite(audio.duration)) audio.currentTime = Number(event.target.value) / 100 * audio.duration;
});
document.addEventListener('visibilitychange', () => {
  if (document.hidden) { setAutomatic(false); resetNarration(); }
});
window.addEventListener('pagehide', () => {
  setAutomatic(false); resetNarration();
  for (const recording of recordings.values()) URL.revokeObjectURL(recording.url);
  recordings.clear();
});
renderPan();

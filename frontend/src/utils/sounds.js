// مؤثرات صوتية خفيفة مُولَّدة برمجيًا عبر Web Audio API - لا تعتمد على أي ملف صوت خارجي،
// لذا فهي فورية وخفيفة الحجم تمامًا. تُكتم كلها دفعة واحدة عبر setMuted(true).
let audioCtx = null;

function getCtx() {
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  if (!audioCtx) audioCtx = new AC();
  if (audioCtx.state === 'suspended') audioCtx.resume().catch(() => {});
  return audioCtx;
}

const MUTE_KEY = 'sound_muted';

function readInitialMuted() {
  try {
    return localStorage.getItem(MUTE_KEY) === 'true';
  } catch (err) {
    return false;
  }
}

let muted = readInitialMuted();
const listeners = new Set();

export function isMuted() {
  return muted;
}

export function setMuted(value) {
  muted = value;
  try {
    localStorage.setItem(MUTE_KEY, String(value));
  } catch (err) {
    // تجاهل صامت إن تعذّر التخزين
  }
  listeners.forEach((fn) => fn(muted));
}

export function subscribeMuted(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

// نغمة بسيطة (أو عدة نغمات متتابعة) عبر oscillator + gain مع تلاشٍ أسّي كي لا تُصدر طقة حادة
function tone({ freq, duration = 0.09, type = 'sine', volume = 0.07, startTime = 0, freqEnd }) {
  if (muted) return;
  const ctx = getCtx();
  if (!ctx) return;
  try {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    const t0 = ctx.currentTime + startTime;
    osc.frequency.setValueAtTime(freq, t0);
    if (freqEnd) osc.frequency.exponentialRampToValueAtTime(freqEnd, t0 + duration);
    gain.gain.setValueAtTime(volume, t0);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + duration + 0.03);
  } catch (err) {
    // بعض المتصفحات تمنع الصوت قبل أول تفاعل من المستخدم - نتجاهل الخطأ بصمت
  }
}

// نقرة خفيفة جدًا - لأي زر عادي
export function playClick() {
  tone({ freq: 720, duration: 0.045, type: 'sine', volume: 0.05 });
}

// نغمة تحذير أخفض وأطول قليلًا - لأزرار الحذف/الخطر
export function playDanger() {
  tone({ freq: 240, duration: 0.16, type: 'square', volume: 0.06, freqEnd: 150 });
}

// نغمة تنقّل صاعدة خفيفة - عند التبديل بين عناصر القائمة الجانبية
export function playNav() {
  tone({ freq: 480, duration: 0.07, type: 'triangle', volume: 0.05, freqEnd: 680 });
}

// نغمة toggle قصيرة مزدوجة - لتبديل الوضع الليلي/الفاتح أو الصوت نفسه
export function playToggle() {
  tone({ freq: 600, duration: 0.055, type: 'sine', volume: 0.055 });
  tone({ freq: 460, duration: 0.055, type: 'sine', volume: 0.045, startTime: 0.05 });
}

// نغمة نجاح صاعدة (ثلاث نغمات) - عند تسجيل الدخول بنجاح
export function playSuccess() {
  tone({ freq: 523.25, duration: 0.09, type: 'sine', volume: 0.06 });
  tone({ freq: 659.25, duration: 0.09, type: 'sine', volume: 0.06, startTime: 0.09 });
  tone({ freq: 783.99, duration: 0.15, type: 'sine', volume: 0.07, startTime: 0.18 });
}

// نغمة خطأ هابطة - عند فشل تسجيل الدخول
export function playError() {
  tone({ freq: 300, duration: 0.12, type: 'sawtooth', volume: 0.06 });
  tone({ freq: 210, duration: 0.18, type: 'sawtooth', volume: 0.06, startTime: 0.12 });
}

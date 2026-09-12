import { createContext, useContext, useEffect, useState } from 'react';
import {
  isMuted, setMuted, subscribeMuted, playClick, playDanger, playNav, playToggle,
} from '../utils/sounds';

const SoundContext = createContext(null);

// استماع مركزي واحد على مستوى الوثيقة لكل نقرات الأزرار وروابط القائمة الجانبية،
// بدل إضافة معالج صوت يدويًا في كل زر عبر النظام بأكمله
function handleGlobalClick(e) {
  const navLink = e.target.closest?.('.sidebar nav a');
  if (navLink) {
    playNav();
    return;
  }

  const btn = e.target.closest?.('button');
  if (!btn || btn.disabled) return;

  if (btn.classList.contains('sound-toggle')) return; // له صوته الخاص عبر toggleMuted
  if (btn.classList.contains('theme-toggle')) {
    playToggle();
    return;
  }
  if (btn.classList.contains('danger')) {
    playDanger();
    return;
  }
  playClick();
}

export function SoundProvider({ children }) {
  const [muted, setMutedState] = useState(isMuted);

  useEffect(() => subscribeMuted(setMutedState), []);

  useEffect(() => {
    document.addEventListener('click', handleGlobalClick, true);
    return () => document.removeEventListener('click', handleGlobalClick, true);
  }, []);

  function toggleMuted() {
    const next = !isMuted();
    setMuted(next);
    playToggle(); // يصدر فعليًا فقط إن كانت next=false (إعادة تفعيل) - tone() تتجاهل الطلب أثناء الكتم
  }

  return (
    <SoundContext.Provider value={{ muted, toggleMuted }}>
      {children}
    </SoundContext.Provider>
  );
}

export function useSound() {
  return useContext(SoundContext);
}

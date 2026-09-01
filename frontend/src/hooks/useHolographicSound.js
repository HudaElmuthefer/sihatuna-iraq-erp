import { useSyncExternalStore, useCallback } from 'react';
import * as sound from '../utils/holographicSound';

// واجهة React خفيفة فوق موديول utils/holographicSound.js (عادي، غير
// تفاعلي بطبيعته) — useSyncExternalStore يبقي حالة الكتم متزامنة عبر أي
// مكوّن يستخدم هذا الـHook دون تكرار useState/useEffect يدوياً بكل مكان.
export default function useHolographicSound() {
  const muted = useSyncExternalStore(sound.subscribeMute, sound.isMuted, sound.isMuted);
  // حالة تشخيص فعلية (بند Part 34/35 صراحةً) — لا نفترض "يعمل" لمجرد عدم
  // وجود استثناء؛ READY تعني AudioContext.state === 'running' فعلياً.
  const audioStatus = useSyncExternalStore(sound.subscribeAudioStatus, sound.getAudioStatus, sound.getAudioStatus);
  const toggleMute = useCallback(() => sound.setMuted(!sound.isMuted()), []);
  return {
    muted,
    toggleMute,
    audioStatus,
    playSelect: sound.playSelect,
    playSnap: sound.playSnap,
    playOpen: sound.playOpen,
    playClose: sound.playClose,
    playConfirm: sound.playConfirm,
    playError: sound.playError,
  };
}

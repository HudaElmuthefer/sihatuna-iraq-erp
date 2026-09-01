import { useSyncExternalStore, useCallback } from 'react';
import * as sound from '../utils/holographicSound';

// واجهة React خفيفة فوق موديول utils/holographicSound.js (عادي، غير
// تفاعلي بطبيعته) — useSyncExternalStore يبقي حالة الكتم متزامنة عبر أي
// مكوّن يستخدم هذا الـHook دون تكرار useState/useEffect يدوياً بكل مكان.
export default function useHolographicSound() {
  const muted = useSyncExternalStore(sound.subscribeMute, sound.isMuted, sound.isMuted);
  const toggleMute = useCallback(() => sound.setMuted(!sound.isMuted()), []);
  return {
    muted,
    toggleMute,
    playSelect: sound.playSelect,
    playSnap: sound.playSnap,
    playOpen: sound.playOpen,
    playClose: sound.playClose,
    playConfirm: sound.playConfirm,
    playError: sound.playError,
  };
}

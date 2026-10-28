import { AudioPlayer, createAudioPlayer, setAudioModeAsync } from 'expo-audio';

let player: AudioPlayer | null = null;

function ensure(): AudioPlayer | null {
  if (player) return player;
  try {
    player = createAudioPlayer(require('../assets/sounds/kaching.mp3'));
    player.volume = 0.8;
    setAudioModeAsync({ playsInSilentMode: true, interruptionMode: 'mixWithOthers' }).catch(() => undefined);
  } catch {
    player = null;
  }
  return player;
}

export function playKaChing(): void {
  try {
    const p = ensure();
    if (!p) return;
    p.seekTo(0).catch(() => undefined);
    p.play();
  } catch {
    return;
  }
}

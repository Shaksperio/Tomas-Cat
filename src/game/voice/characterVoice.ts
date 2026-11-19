/** Browser-native Portuguese speech synthesis for game characters. */
export type CharacterVoiceStyle = 'oracle' | 'resident' | 'agent' | 'creature' | 'player';
const STYLES: Record<CharacterVoiceStyle, { pitch: number; rate: number }> = {
  oracle: { pitch: 0.88, rate: 0.92 }, resident: { pitch: 1.02, rate: 0.98 },
  agent: { pitch: 0.94, rate: 1.02 }, creature: { pitch: 1.18, rate: 0.9 },
  player: { pitch: 1, rate: 1 },
};
let active: SpeechSynthesisUtterance | null = null;
export function isCharacterVoiceSupported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window && typeof SpeechSynthesisUtterance !== 'undefined';
}
export function stopCharacterVoice(): void {
  if (isCharacterVoiceSupported()) window.speechSynthesis.cancel();
  active = null;
}
export function speakCharacter(text: string, style: CharacterVoiceStyle = 'resident'): boolean {
  if (!isCharacterVoiceSupported()) return false;
  const clean = text.replace(/\s+/g, ' ').trim().slice(0, 1800);
  if (!clean) return false;
  stopCharacterVoice();
  const utterance = new SpeechSynthesisUtterance(clean);
  const profile = STYLES[style];
  utterance.lang = 'pt-BR'; utterance.pitch = profile.pitch; utterance.rate = profile.rate;
  const voices = window.speechSynthesis.getVoices();
  const portuguese = voices.filter((voice) => /^pt[-_]/i.test(voice.lang));
  const preferred = portuguese.find((voice) => /brazil|portugu[eê]s|portuguese/i.test(voice.name));
  if (preferred || portuguese[0]) utterance.voice = preferred || portuguese[0];
  utterance.onend = () => { if (active === utterance) active = null; };
  utterance.onerror = () => { if (active === utterance) active = null; };
  active = utterance; window.speechSynthesis.speak(utterance); return true;
}

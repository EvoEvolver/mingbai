// Mingbai.js audio components (music and sound books). In chapters: import { … } from "@kit/audio". See spec/AUDIO.md
export { Play, SoundBar, Keyboard, PitchCircle, IntervalLab, Tonnetz, EarQuiz, Narrate } from "./components.jsx";
export { Score } from "./score.jsx";
export { Progression } from "./progression.jsx";
export { play, sequence, stop, later, onStop, getSettings, setSettings, useAudioState } from "./engine.js";
export * from "./theory.js";

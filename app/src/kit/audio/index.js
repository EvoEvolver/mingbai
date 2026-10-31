// 图书讲透 · 可听组件（音乐/声音类书籍）。章节里 import { … } from "@kit/audio"。说明见 framework/spec/AUDIO.md
export { Play, SoundBar, Keyboard, PitchCircle, IntervalLab, Tonnetz, EarQuiz, Narrate } from "./components.jsx";
export { play, sequence, stop, getSettings, setSettings, useAudioState } from "./engine.js";
export * from "./theory.js";

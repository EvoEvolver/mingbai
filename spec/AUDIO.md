# Audio components (`@kit/audio`): for books about music and sound

[简体中文](zh/AUDIO.md)

Readers can **listen as they read**: chords, intervals, and scales on the page sound when clicked, and the diagrams themselves are instruments.
Pilot book: *Illustrated Harmony* ([full example](https://github.com/EvoEvolver/mingbai-notes/blob/main/harmony/chapters/ch01.jsx), in the mingbai-notes repo).

```jsx
import { Play, SoundBar, Keyboard, PitchCircle, IntervalLab, Tonnetz, EarQuiz, Narrate, Score, Progression } from "@kit/audio";
```
These aren't exported from the main `@kit` entry, so only books that use them bundle them. Staff notation depends on abcjs (MIT), which loads on demand only when a page contains a `<Score>`.

## Design points
- **Pure synthesis, no sample files**: Web Audio oscillators plus harmonic tables (three timbres: piano, organ, sine). It works offline and raises no copyright issues.
- **Autoplay policy**: the AudioContext is created only on the reader's first click. Don't make sound on page load.
- **Site-wide shared settings**: volume, mute, timbre, and tuning (equal temperament or just intonation) are stored in `localStorage` and adjusted through `<SoundBar/>`.
- **Sound highlights what's playing**: `useAudioState()` subscribes to the notes currently sounding, and the matching spots on keyboards, circles, and grids light up in sync, so readers see what they hear.

## Components
| Component | Purpose | Key props |
|---|---|---|
| `<SoundBar tuning?/>` | Volume bar fixed at the bottom right (**place once per chapter**) | `tuning` shows the equal temperament / just intonation switch |
| `<Play …>text</Play>` | Inline ▶ listen button in the text | `chord="Em"` / `notes="C4 E4 G4"` / `seq={["C","F","G","C"]}` (items with an octave number are notes; anything else is a chord) · `arp` arpeggio spacing in seconds · `melodic` plays the notes one at a time · `gap` spacing between steps |
| `<Keyboard/>` | Playable piano keyboard | `from to` range · `highlight` · `marks={{60:"R"}}` · `onNote(midi)` · `names="white"|"C"|"all"` |
| `<PitchCircle/>` | Twelve-note cycle circle: pick a step size to draw a polygon or star, play the cycle, and animate between chromatic and circle-of-fifths order | `step` `steps` `start` `arrange="chromatic"|"fifths"` `lockArrange` |
| `<IntervalLab/>` | Interval workbench: click two keys to get the semitone count, the interval name, melodic and harmonic playback, and the inversion | `from to lo hi` |
| `<Tonnetz/>` | Grid diagram (perfect fifths horizontal, major thirds up-right, minor thirds up-left; upward triangles are major triads in red, downward triangles are minor triads in blue). Click an intersection to hear a note or a triangle to hear a chord; once a chord is selected, you can move only its third to swap between major and minor | `cols rows center unit` · `path={["C","F","G"]}` `current` draw a chord route · `compact` hides the caption bar · `highlight={["C","Em","B°"]}` (each chord is marked only at the spot nearest the center; major and minor triads are drawn as triangles, and diminished, augmented, and other chords as polygons of note points; labels use the spelling you wrote); seventh chords on a route are drawn as four-note shapes (dominant 7th green, major 7th red, minor 7th blue, half-diminished 7th violet, as in the source book) · `notes={[0,2,4]}` marks a set of pitch classes · `axes={["fifths","M3","m3"]}` · `showAxesToggle` · `select="M0"` · `spell="flat"|"sharp"|"both"` · `onChord(name)` |
| `<Score/>` | **Score example**: ABC notation with a one-click switch between **staff ⇄ piano roll (as in Logic Pro: time on the horizontal axis, pitch on the vertical axis, a keyboard on the left, notes as bars)**. The preference is shared across the site (stored in localStorage, so all scores switch together). During ▶ playback, staff notes turn red, and the piano roll shows a playhead and turns sounding bars gold. Click a note or bar to hear it alone. Accompaniment notes from `accomp` appear as pale blue bars in the piano roll | `abc` (treble staff body, or complete ABC containing `K:`) · `bass` (bass staff body, which automatically produces a grand staff) · `keySig="G"`/`"Am"` · `meter="3/4"` · `unit="1/8"` (default 1/4) · `tempo` · `caption` · `scale` · `accomp` (automatically plays block-chord accompaniment from the chord symbols in the score; good for melody-only examples) |
| `<Progression/>` | **Chord progression player**: chord cards (with automatic Roman numerals) plus a playhead; tempo, texture (block, arpeggio, bass + chord), smooth voicing or root position, and looping; can also draw the route on a grid and show the keys on a keyboard in sync | `chords={["C","Am","F","G7","C/E"]}` (the part after `/` is the bass; a chord that symbols can't express can be written as `{ name:"Cm♭6", notes:"C3 Eb4 G4 Ab4", roman:"i♭6", minor:true }`, which plays the given pitches and draws as a compact group of note points on the grid) · `keyName="C"`/`"Am"` (automatic numerals) · `roman` (custom numerals) · `bpm` · `beats` (beats per chord; can be an array) · `texture` · `voicing="smooth"|"close"` · `loop` · `tonnetz` (`true` or `{cols,rows,center}`) · `keyboard` · `title` `caption` |
| `<EarQuiz items/>` | Ear training: listen first, then choose; keeps score | `items=[{q, play:{chord|notes|seq, arp, melodic, gap}, options, answer, why}]` |
| `<Narrate/>` | "Read this section aloud": browser speech synthesis reads the text of the enclosing Block (skipping buttons and figures) | `label` `rate`; hides itself when the browser doesn't support it |

Lower-level API (for custom diagrams): `play(midis, {dur, arp, at})`, `sequence(steps, {gap, onStep})`, `stop()`, `onStop(fn)` (resets a custom component's playing state on any stop; returns an unsubscribe function), `later(fn, ms)` (a timer that is canceled along with stop), `useAudioState()`.
Music theory tools: `romanOf("G7","C")`→V7, `voiceChord("F",{prev,style:"smooth"})`, `parseNote("C#4")`, `parseChord("G7")`, `intervalName(7)`, `cycle(0, 3)`, `freq(midi, "just")`, `pcName(pc, "flat")`, `tonnetzPc(i, j)`.

## Chord symbols (shared by `chord`, `seq`, `Progression`, and `highlight`)
Root `C D♭ F# Bb`… plus type: `m dim ° aug + 7 maj7 Δ m7 ø m7b5 dim7 °7 mM7 sus2 sus4 6 m6 5`;
altered sevenths `7b5 7#5 +7 7sus4 +Δ maj7#5`; extended chords `9 m9 maj9 11 m11 13 m13 maj13 7b9 7#9 7#11 7b13 7alt add9 madd9 69`;
augmented sixths (written with the bass as the root) `It+6 Fr+6 Ger+6` (such as `AbGer+6`); suffix `no5`; slash chords `C/E` (the bass sits separately below). ♭ and ♯ are also recognized inside types (`G7♭9`).
`romanOf` computes numerals by letter name (B♭ in C major is ♭VII, F♯m is ♯iv); raised 6th and 7th degrees in minor take no sharp (G♯° in A minor = vii°). For secondary dominants and the like, override with `roman` (`V7/V`).

## ABC notation quick reference (for writing `<Score>`)
- Pitch: `C D E F G A B` = C4–B4, `c d e …` = one octave up (C5 and above), `c'` another octave up; `C,` one octave down (C3), `C,,` another octave down.
- Accidentals: `^F` (F♯), `_B` (B♭), `=F` (natural); the key signature is set by `keySig` (`"G"`, `"F"`, `"Am"`, `"Eb"` …).
- Durations (in units of `unit`, a quarter note by default): `C` quarter, `C2` half, `C4` whole, `C/2` or `C/` eighth, `C3/2` dotted quarter; rest `z` (`z4` whole rest).
- Chords: `[CEG]4` (sounding together); chord symbols go before the notes: `"Am"[A,CE]4`; bar line `|`, final bar `|]`, repeat `|: … :|`.
- Grand staff: `<Score abc="[EGc]4 | [DGB]4 |]" bass="C,4 | G,,4 |]"/>` (`abc` is the treble staff, `bass` is the bass staff, and they must have the same number of bars).
- Lyrics: in complete ABC, use a `w: This is the se-cond` line.
- After writing a score, always click "▶ Play score" on the page to hear it, and compare it note by note with the example in the source book.

## Writing advice
- **Listen first, explain second**: give each new concept a `<Play>` first so the ear gets an impression, then explain the structure.
- **Contrasts come in pairs**: major and minor triads, consonance and dissonance, equal temperament and just intonation. Use `seq` to play both in a row (`<Play seq={["E","Em"]}>`).
- Replace the book's static figures with clickable components where you can: grid diagrams → `<Tonnetz>`, chord progressions → `<Progression>`, staff examples → `<Score>` transcribed into ABC (check note by note against the page images of the book). Use the book's own figures only when that really isn't possible (local `public/figures/`, not committed to the repo).
- Include at least one `<EarQuiz>` per chapter (4–6 questions), testing what readers can hear rather than what they can recite.
- Follow the source book's color conventions (in *Illustrated Harmony*, major triads are red and minor triads blue), and state them in a legend or caption.

## Known limitations and future work
- The synthesized timbres are illustrative and don't aim to sound like a real piano. If you need realistic timbres, you can add a sampled source in `engine.js` (mind the size and copyright).
- `Narrate` relies on a system voice for the book's language, and quality varies by browser and system. When you need high-quality narration, pre-generate audio files.

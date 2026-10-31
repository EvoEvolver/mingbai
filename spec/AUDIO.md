# 可听组件（`@kit/audio`）—— 给音乐/声音类书籍

让读者**边看边听**：页面里的和弦、音程、音阶都能点了就响，图解本身就是乐器。
试点书：《图解和声》`/home/zijian/books/harmony`（`chapters/ch01.jsx` 为完整范例）。

```jsx
import { Play, SoundBar, Keyboard, PitchCircle, IntervalLab, Tonnetz, EarQuiz, Narrate, Score, Progression } from "@kit/audio";
```
不在 `@kit` 主入口导出，只有用到的书才打包。五线谱依赖 abcjs（MIT），只在页面里出现 `<Score>` 时按需加载。

## 设计要点
- **纯合成，无采样文件**：Web Audio 振荡器 + 谐波表（钢琴/风琴/正弦三种音色），离线可用、零版权问题。
- **自动播放策略**：AudioContext 在读者第一次点击时才创建；不要在页面加载时自动发声。
- **全站共享设置**：音量、静音、音色、律制（平均律/纯律）存在 `localStorage`，由 `<SoundBar/>` 调节。
- **发声即高亮**：`useAudioState()` 订阅「正在发声的音」，键盘、圆、网格上对应位置会同步亮起——读者看见自己听到的东西。

## 组件
| 组件 | 用途 | 关键属性 |
|---|---|---|
| `<SoundBar tuning?/>` | 右下角固定音量条（**每章放一次**） | `tuning` 显示平均律/纯律切换 |
| `<Play …>文字</Play>` | 正文里的行内 ▶ 试听钮 | `chord="Em"` / `notes="C4 E4 G4"` / `seq={["C","F","G","C"]}`（含八度数字的是音，否则是和弦）· `arp` 琶音间隔秒 · `melodic` 把 notes 逐个弹 · `gap` 步间隔 |
| `<Keyboard/>` | 可弹的钢琴键盘 | `from to` 音域 · `highlight` · `marks={{60:"根"}}` · `onNote(midi)` · `names="white"|"C"|"all"` |
| `<PitchCircle/>` | 十二音循环圈：选步长画多边形/星形、播放循环、半音阶⇄五度圈排列动画 | `step` `steps` `start` `arrange="chromatic"|"fifths"` `lockArrange` |
| `<IntervalLab/>` | 音程实验台：点两个键→半音数、音程名、旋律/和声试听、转位 | `from to lo hi` |
| `<Tonnetz/>` | 网格图（横向纯五度、右上大三度、左上小三度；朝上三角大三=红，朝下小三=蓝）。点交点听音、点三角听和弦，选中后可「只动三音」大小互换 | `cols rows center unit` · `path={["C","F","G"]}` `current` 画和弦路线 · `compact` 隐藏说明栏 · `highlight={["C","Em"]}`（每个和弦只标离中心最近的一处）· `notes={[0,2,4]}` 标出音级集合 · `axes={["fifths","M3","m3"]}` · `showAxesToggle` · `select="M0"` · `spell="flat"|"sharp"|"both"` · `onChord(name)` |
| `<Score/>` | **五线谱**（abcjs 渲染 ABC 记谱）。▶ 播放时音符同步变红；点任意音符/和弦单独试听 | `abc`（高音谱表正文，或含 `K:` 的完整 ABC）· `bass`（低音谱表正文 → 自动生成大谱表）· `keySig="G"`/`"Am"` · `meter="3/4"` · `unit="1/8"`（默认 1/4）· `tempo` · `caption` · `scale` |
| `<Progression/>` | **和弦进行播放器**：和弦卡片（自动标级数）+ 播放头；速度、织体（柱式/琶音/低音+和弦）、平滑连接/原位、循环；可同步在网格上画路线、在键盘上显示按键 | `chords={["C","Am","F","G7","C/E"]}`（`/` 后为低音）· `keyName="C"`/`"Am"`（自动级数）· `roman`（自定义级数）· `bpm` · `beats`（每和弦拍数，可为数组）· `texture` · `voicing="smooth"|"close"` · `loop` · `tonnetz`（`true` 或 `{cols,rows,center}`）· `keyboard` · `title` `caption` |
| `<EarQuiz items/>` | 听音练习：先听再选，计分 | `items=[{q, play:{chord|notes|seq, arp, melodic, gap}, options, answer, why}]` |
| `<Narrate/>` | 「朗读本节」：浏览器语音合成读出所在 Block 的文字（跳过按钮与图） | `label` `rate`；浏览器不支持时自动隐藏 |

底层（自定义图解时用）：`play(midis, {dur, arp, at})`、`sequence(steps, {gap, onStep})`、`stop()`、`useAudioState()`；
乐理工具：`romanOf("G7","C")`→V7、`voiceChord("F",{prev,style:"smooth"})`、`parseNote("C#4")`、`parseChord("G7")`、`intervalName(7)`、`cycle(0, 3)`、`freq(midi, "just")`、`pcName(pc, "flat")`、`tonnetzPc(i, j)`。

## ABC 记谱速查（写 `<Score>` 用）
- 音高：`C D E F G A B` = C4–B4，`c d e …` = 高八度（C5–），`c'` 再高八度；`C,` 低八度（C3），`C,,` 再低。
- 升降还原：`^F`（F♯）`_B`（B♭）`=F`（还原）；调号由 `keySig` 决定（`"G"`、`"F"`、`"Am"`、`"Eb"` …）。
- 时值（以 `unit` 为单位，默认四分音符）：`C` 四分、`C2` 二分、`C4` 全音符、`C/2` 或 `C/` 八分、`C3/2` 附点四分；休止符 `z`（`z4` 全休止）。
- 和弦：`[CEG]4`（同时发声）；和弦记号写在音符前：`"Am"[A,CE]4`；小节线 `|`，终止线 `|]`，反复 `|: … :|`。
- 大谱表：`<Score abc="[EGc]4 | [DGB]4 |]" bass="C,4 | G,,4 |]"/>`（`abc` 为高音谱表，`bass` 为低音谱表，小节数要一致）。
- 歌词：在完整 ABC 中用 `w: This is the se-cond` 行。
- 写完务必在页面上点「▶ 播放乐谱」听一遍，并与原书谱例逐音核对。

## 写作建议
- **先听后讲**：每个新概念先给一个 `<Play>`，让耳朵先有印象，再解释结构。
- **对比要成对**：大/小三和弦、协和/不协和、平均律/纯律——用 `seq` 连续播放两者（`<Play seq={["E","Em"]}>`）。
- 书中的静态图尽量换成可点击的组件：网格图 → `<Tonnetz>`，和弦进行 → `<Progression>`，五线谱谱例 → 用 ABC 转写成 `<Score>`（看原书页面图逐音核对）。实在做不了的才用原书插图（本地 `public/figures/`，不入库）。
- 每章至少一个 `<EarQuiz>`（4–6 题），考「听出来」而不是「背出来」。
- 色彩约定沿用原书（如《图解和声》大三红、小三蓝），并在图例或说明里写明。

## 已知限制 / 后续
- 合成音色是「示意级」，不追求真实钢琴；若需要真实音色，可在 `engine.js` 增加采样音源（注意体积与版权）。
- `Narrate` 依赖系统中文语音，质量因浏览器/系统而异；需要高质量朗读时应预生成音频文件。

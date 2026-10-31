# 可听组件（`@kit/audio`）—— 给音乐/声音类书籍

让读者**边看边听**：页面里的和弦、音程、音阶都能点了就响，图解本身就是乐器。
试点书：《图解和声》`/home/zijian/books/harmony`（`chapters/ch01.jsx` 为完整范例）。

```jsx
import { Play, SoundBar, Keyboard, PitchCircle, IntervalLab, Tonnetz, EarQuiz, Narrate } from "@kit/audio";
```
不在 `@kit` 主入口导出，只有用到的书才打包（约 10 KB gzip）。

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
| `<Tonnetz/>` | 网格图（横向纯五度、右上大三度、左上小三度；朝上三角大三=红，朝下小三=蓝）。点交点听音、点三角听和弦，选中后可「只动三音」大小互换 | `cols rows center unit` · `highlight={["C","Em"]}`（每个和弦只标离中心最近的一处）· `notes={[0,2,4]}` 标出音级集合 · `axes={["fifths","M3","m3"]}` · `showAxesToggle` · `select="M0"` · `spell="flat"|"sharp"|"both"` · `onChord(name)` |
| `<EarQuiz items/>` | 听音练习：先听再选，计分 | `items=[{q, play:{chord|notes|seq, arp, melodic, gap}, options, answer, why}]` |
| `<Narrate/>` | 「朗读本节」：浏览器语音合成读出所在 Block 的文字（跳过按钮与图） | `label` `rate`；浏览器不支持时自动隐藏 |

底层（自定义图解时用）：`play(midis, {dur, arp, at})`、`sequence(steps, {gap, onStep})`、`stop()`、`useAudioState()`；
乐理工具：`parseNote("C#4")`、`parseChord("G7")`、`intervalName(7)`、`cycle(0, 3)`、`freq(midi, "just")`、`pcName(pc, "flat")`、`tonnetzPc(i, j)`。

## 写作建议
- **先听后讲**：每个新概念先给一个 `<Play>`，让耳朵先有印象，再解释结构。
- **对比要成对**：大/小三和弦、协和/不协和、平均律/纯律——用 `seq` 连续播放两者（`<Play seq={["E","Em"]}>`）。
- 书中的静态图尽量换成可点击的组件；组件做不到的（五线谱谱例），用原书插图（本地 `public/figures/`，不入库）。
- 每章至少一个 `<EarQuiz>`（4–6 题），考「听出来」而不是「背出来」。
- 色彩约定沿用原书（如《图解和声》大三红、小三蓝），并在图例或说明里写明。

## 已知限制 / 后续
- 没有五线谱渲染（需要时可引入 VexFlow 或 abcjs）。
- 合成音色是「示意级」，不追求真实钢琴；若需要真实音色，可在 `engine.js` 增加采样音源（注意体积与版权）。
- `Narrate` 依赖系统中文语音，质量因浏览器/系统而异；需要高质量朗读时应预生成音频文件。

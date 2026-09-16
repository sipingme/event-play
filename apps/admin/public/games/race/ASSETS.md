# 庆典赛马素材 v1

2026-09-16：使用内置 image_gen 工具生成原创位图，没有复制竞品素材。

- `stadium-v1.png`：1672 × 941，场景背景，文字及队伍数据不在图片中。
- `horse-strip-v1.png`：2172 × 724，RGBA 透明四帧横向序列。CSS 逐帧播放；暂停、断线、遮罩、结算时停止，遵循减少动态效果设置。生成序列仍有轻微帧间差异，正式商用可进一步人工校准。
- 本版庆典主题用于所有 race 游戏；其他玩法主题不变。未新增主题选择器。
- 赛道是限时积分的相对位置，不是到达终点的百分比；获胜依据实际服务端分数。

## Background prompt (verbatim)

Use case: stylized-concept. Asset type: production background plate for a Chinese corporate celebration horse racing browser game. Generate original polished painterly 2.5D game illustration, landscape 16:9. Rich warm vermilion and champagne gold at sunset, elegant celebratory stadium. Layout constraints: top 28 percent contains hazy warm red sky, distant Chinese-inspired stadium architecture and filled grandstands with small red flags, leave the upper center calm for live title overlay. Middle from 30 to 88 percent is a broad empty ochre sandy racetrack seen side-on, perfectly horizontal, no perspective vanishing point, no lane markings (program will add flexible lanes), subtle sand texture, sparse white fence along far side. Bottom 10 percent contains dark silhouettes of cheering audience and a few flags framing the lower corners. Cinematic warm rim light, fine atmospheric particles, deep layered environment, high quality hand-painted game art, readable uncluttered track. NO horses, NO riders, NO text, NO logos, NO numbers, NO signs, NO UI, NO watermarks. Actual usable background asset, not a UI mockup.

## Horse prompt (verbatim)

Use case: stylized-concept. Production 2D game sprite sheet on genuinely transparent alpha background. ONE horizontal row of FOUR evenly spaced equal-sized cells. Each cell contains the SAME chestnut racehorse with black mane and a jockey in cream-and-gold riding silks and helmet, galloping toward the RIGHT in exact side view. Four successive distinct phases of a gallop cycle: extended, gathering, tucked, pushing off. Identical proportions, scale, warm light and position registration in each cell; horse feet baseline at same height. Each entire horse and rider fully inside its own cell, generous transparent gutter around each. Polished detailed painterly 2.5D mobile game illustration, realistic horse anatomy, gold saddle cloth without number. No scenery, NO floor, NO shadows outside character, NO dust, NO labels, NO text, no border, no watermark. Wide 4:1 sprite strip, all four cells aligned. Transparent background essential. This will be used as a CSS steps(4) animation, not a concept poster.

# 卡通赛马 v2 素材记录

使用内置 image_gen 生成及改色。原始 v1 庆典素材保留；本版不使用竞品原图。

## 产物

- stadium-cartoon-v2.png：晴天卡通赛场背景。
- horse-cartoon-red-v2.png：红队四帧 RGBA 透明角色。
- horse-cartoon-blue-v2.png：蓝队四帧 RGBA 透明角色。
- horse-cartoon-green-v2.png：绿队四帧 RGBA 透明角色。
- horse-cartoon-purple-v2.png：紫队四帧 RGBA 透明角色。

四套角色尺寸均为 2172 × 724，一行四格，保留透明通道。使用 CSS 逐帧动画，不是骨骼动画；生成帧仍可能有轻微帧间变化。暂停/断线/遮罩/结束时停止奔跑，并尊重减少动态效果设置。

玩法和计分保持不变。页面按主题分离背景、角色、实时文本；本轮不增加主题选择器或自动生成服务。

## 实际提示词

### 背景首次尝试（生成超时，未采用）

undefined

### 背景最终采用提示词

Original 16:9 2D cartoon horse racing game BACKGROUND ONLY. Bright clean casual game art, flat colors, light cel shading, simple rounded forms, crisp outlines, no realistic textures. Top 35%: turquoise sky, white clouds, rounded trees and cheerful small countryside grandstands with colorful bunting and white fence. Leave sky center empty for a title. Middle 38–85%: very broad EMPTY pale tan sandy racecourse, completely horizontal side view, no perspective, no lane markings. Bottom 15%: green grass and low white fence. Calm uncluttered, warm sunny daylight, cheerful sports festival. NO horses, NO riders, NO words, NO letters, NO UI, NO logos, NO watermark. Usable game environment plate, not a poster.

### 红色角色母版

Use case: stylized-concept. Production sprite sheet for bright 2D cartoon casual horse racing game. Transparent alpha background. Wide 3:1 image with exactly FOUR equal-width cells in ONE horizontal row. In every cell the SAME cute chestnut pony and small jockey faces RIGHT, strict side view. Big rounded horse head, friendly large eye, short strong legs, compact rounded body, dark brown mane and tail; jockey has big helmet and simple face, RED helmet RED shirt RED saddle blanket, white breeches. Clean polished 2D cartoon, bold clear contours, flat colors with just 2-tone cel shadows, no realistic fur, no painterly texture, not 3D. Four sequential running poses: legs extended, forelegs gathering, legs tucked, back legs pushing. Each entire pony and rider fits completely within its own cell with 12% clear padding on every side, same center and baseline, identical size. Leave top and bottom transparent, no overlap between cells. No text, numbers, logos, borders, floor, shadow, scenery, dust or watermark. Genuinely transparent background, not a checkerboard. Render as ready-to-use animation sprite strip, NOT an illustration containing a race.

### blue

Use case: precise-object-edit. Edit target: attached transparent four-frame cartoon horse sprite sheet. Change ONLY the RED helmet, RED shirt and RED saddle blanket to BLUE across all four frames. Preserve horse brown fur, skin, white breeches, black outlines, every pose, exact cell layout, character proportions, image dimensions, all transparent padding and genuine alpha transparency. No new elements, no text, no background. Output same sprite sheet, only team clothing color changed.

### green

Use case: precise-object-edit. Edit target: attached transparent four-frame cartoon horse sprite sheet. Change ONLY the RED helmet, RED shirt and RED saddle blanket to EMERALD GREEN across all four frames. Preserve horse brown fur, skin, white breeches, black outlines, every pose, exact cell layout, character proportions, image dimensions, all transparent padding and genuine alpha transparency. No new elements, no text, no background. Output same sprite sheet, only team clothing color changed.

### purple

Use case: precise-object-edit. Edit target: attached transparent four-frame cartoon horse sprite sheet. Change ONLY the RED helmet, RED shirt and RED saddle blanket to PURPLE across all four frames. Preserve horse brown fur, skin, white breeches, black outlines, every pose, exact cell layout, character proportions, image dimensions, all transparent padding and genuine alpha transparency. No new elements, no text, no background. Output same sprite sheet, only team clothing color changed.

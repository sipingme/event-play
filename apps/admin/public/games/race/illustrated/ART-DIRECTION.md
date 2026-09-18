# 竞速卡通素材 v2

制作方式：内置 imagegen；以项目已有赛马背景与红队马匹为风格参考，未使用竞品素材。2026-09-17。

文件位置：`apps/admin/public/games/race/illustrated/`，七款各一张背景和一张透明角色，文件名为 `{variant}-{bg|sprite}-v2.png`。原赛马素材不变。游戏库与大屏共用这些文件。

角色红色涂装通过 SVG 蒙版按队伍着色，保留玻璃、象牙白、皮肤和轮廓。动效为页面位移、浮动和尾迹，并非多帧骨骼动画。积分与文字均不烘焙到图片。

## 最终提示词

### 背景共用提示

Use case: style-transfer. Transform the reference into a new wide 16:9 game background. Preserve its polished cheerful hand-painted 2.5D cartoon illustration style, soft dimensional light, layered scenery, saturated friendly colors, rounded shapes and level of detail. Scene: [SCENE]. Empty playable environment only. Match reference's straight side-on race camera, not a road receding into the distance. No foreground characters or vehicles, no text, no logos, no UI, no lane lines. Wide 16:9 landscape composition.

### 角色共用提示

Use case: style-transfer. Use the reference ONLY for art direction, replace the horse and rider entirely. Create ONE single isolated game sprite: [ACTOR]. Match the reference's polished cute 2.5D painted cartoon style, bold readable silhouette, soft dimensional shading, glossy highlights, subtle dark outlines and rounded toy-like proportions. Single sprite, NOT a sheet, full object visible centered filling 85% of image with small safety margins. GENUINELY TRANSPARENT background with alpha, no backdrop, no floor, no ground shadow, no text, no logo, no watermark. Red is the team accent, other colors mostly neutral ivory/gray and blue glass. Landscape canvas except upright rocket/balloon use square canvas.

### yacht

SCENE: a turquoise coastal regatta bay, distant cheerful spectator stands, palm trees, lighthouse and colorful pennants along the horizon at 35% height; lower 60% open calm turquoise racing water

ACTOR: a compact sporty white and red luxury racing motor yacht, rounded friendly proportions, blue glass cabin, clearly pointing RIGHT in side profile

### car

SCENE: a sunny festive motor racing stadium, distant city and cheerful spectator grandstands with pennants at 35% height; lower 60% open horizontal dark gray asphalt racing surface, no painted lane lines

ACTOR: a cute chunky red racing sports car pointing RIGHT in side profile, glossy bodywork, big black racing wheels, blue glass windows, playful proportions

### motorbike

SCENE: a sunny countryside motor racing stadium, rolling green hills, cheerful stands and colorful pennants at 35% height; lower 60% open horizontal gray asphalt racing surface, no painted lane lines

ACTOR: a cute big-headed helmeted rider in red racing suit leaning forward on a red sport motorcycle pointing RIGHT in side profile, clear wheels, friendly cartoon expression

### spaceship

SCENE: a playful colorful outer space racing arena with softly painted distant planets and nebula, festive orbital gates only near the sides; center and lower 60% open blue-indigo space for horizontal racing, no spacecraft

ACTOR: a cute red and ivory compact racing spaceship pointing RIGHT in side profile, blue bubble cockpit, stubby wings, rounded silhouette, no exhaust flame

### rocket

SCENE: a playful cartoon space launch sky, blue-indigo upper atmosphere with tiny stars, soft cloud layers at the sides, small launch facilities at the bottom edge; center 75% open for vertical racing, no rockets

ACTOR: a cute red and ivory rocket upright pointing UP, frontal view, round blue porthole, chunky red nose cone and fins, friendly rounded silhouette, no flame

### penguin

SCENE: a sunny festive alpine winter sports venue with rounded snow mountains, pine trees and spectator stands with pennants at 35% height; lower 60% wide open horizontal snow racing field, no painted lane lines

ACTOR: a cute expressive penguin skiing toward RIGHT in side profile wearing a red bobble hat and red scarf, orange beak and feet, two skis, round eyes and joyful determined expression

### balloon

SCENE: a cheerful warm sunrise sky above green rolling hills and a small balloon festival venue at the bottom edge, soft painted clouds framing sides; center 75% open for vertical racing, no balloons

ACTOR: a cute upright red and ivory striped hot air balloon, frontal view, rounded inflated envelope with subtle stitched panels, ropes and little wicker basket, complete silhouette

### 热气球背景最终修订

Use case: style-transfer. Edit this cartoon launch-sky background into a hot-air-balloon festival sky, preserving EXACTLY the composition with 80% OPEN SKY and ground confined to the bottom 15%. Replace space stars with warm peach-gold sunrise light and soft fluffy clouds ONLY along left/right edges. Replace the launch towers and industrial buildings with small festive spectator stands and green distant hills at the bottom edge. The central area from y=0 to y=750 of a 900-high canvas must be entirely open sky, NOT grass or land. Keep the polished hand-painted cheerful 2.5D cartoon style, rounded clouds and layered detail. NO balloons, vehicles, text, numbers, UI or logos. Wide 16:9.

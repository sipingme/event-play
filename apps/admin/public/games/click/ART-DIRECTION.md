# 点击游戏 · 赛马同系列插画

使用内置 imagegen 生成，保留 PNG alpha；仅在 SVG 中选择图集帧及进行队色替换，不修改源图。背景、主体、文字和实时积分分层渲染。新素材均位于本目录。

火箭复用 ../race/illustrated/rocket-{sprite,bg}-v2.png；拔河复用 ../race/stadium-cartoon-v2.png。气球与爆米花共用嘉年华背景，其余各有独立场景。

## 动态映射

- 拔河：红蓝双队图层随贡献差平移。
- Boss：护盾显示、击败缩放由贡献进度控制。
- 气球：体积增长、满格上浮。
- 火箭：点火尾焰与达标升空。
- 花朵：三个图集帧分别对应萌芽、花苞和开放。
- 高楼：同一层楼的插画按进度向上叠加。
- 品牌：徽章和上传 Logo 逐渐点亮。
- 爆米花：空桶与玉米堆分层，进度控制堆积高度。

## 最终生成提示词

### tug-sprite-v1.png

参考：D:/2026/eventplay/apps/admin/public/games/race/illustrated/climb-sprite-v2.png

Use case: stylized-concept. Production 2.5D cartoon game sprite. Input image is STYLE REFERENCE ONLY: match its bold clean outlines, rich dimensional shading, rounded shapes and polished cheerful casual game illustration, NOT flat vector. Subject: Wide 3:2 composition: two cute athletic teammates wearing red tracksuits, boy and girl, full bodies visible, leaning backwards to the LEFT and gripping a taut rope extending to the RIGHT. Expressive happy determined faces. One combined two-person team sprite, empty transparent space surrounding. Rope horizontal at waist height, no opponent. Genuinely transparent background with alpha, no black or white backdrop, no text, no UI, no watermark, no logos, no clipping. Warm light from upper left.

### boss-sprite-v1.png

参考：D:/2026/eventplay/apps/admin/public/games/race/illustrated/climb-sprite-v2.png

Use case: stylized-concept. Production 2.5D cartoon game sprite. Input image is STYLE REFERENCE ONLY: match its bold clean outlines, rich dimensional shading, rounded shapes and polished cheerful casual game illustration, NOT flat vector. Subject: One adorable round purple forest monster boss, tiny cream horns, big expressive eyes, rounded paws, soft belly, tiny leafy shoulder armor. Determined but friendly face, full body frontal three-quarter view. Single sprite, no shield, no effects. Genuinely transparent background with alpha, no black or white backdrop, no text, no UI, no watermark, no logos, no clipping. Warm light from upper left.

### balloon-sprite-v1.png

参考：D:/2026/eventplay/apps/admin/public/games/race/illustrated/climb-sprite-v2.png

Use case: stylized-concept. Production 2.5D cartoon game sprite. Input image is STYLE REFERENCE ONLY: match its bold clean outlines, rich dimensional shading, rounded shapes and polished cheerful casual game illustration, NOT flat vector. Subject: One inflated glossy red party balloon with golden star ornament painted on it, tied at bottom with short golden curling ribbon. Rounded pear shape, gentle highlights and painted dimensional shading. Single balloon sprite only, no pump, no basket. Genuinely transparent background with alpha, no black or white backdrop, no text, no UI, no watermark, no logos, no clipping. Warm light from upper left.

### flower-sprite-v1.png

参考：D:/2026/eventplay/apps/admin/public/games/race/illustrated/climb-sprite-v2.png

Use case: stylized-concept. Production 2.5D cartoon game sprite. Input image is STYLE REFERENCE ONLY: match its bold clean outlines, rich dimensional shading, rounded shapes and polished cheerful casual game illustration, NOT flat vector. Subject: A 3-frame horizontal sprite sheet, exact three equal square cells across a 3:1 canvas. Same terracotta flowerpot at same bottom baseline and same size in all cells. LEFT: tiny seedling with two leaves. CENTER: medium green stem with leaves and closed pink flowerbud. RIGHT: tall beautiful fully open pink flower with a cheerful golden center, lush green leaves. Each object fully contained with padding in its own cell, no overlap between cells, no grid lines. Transparent background. Genuinely transparent background with alpha, no black or white backdrop, no text, no UI, no watermark, no logos, no clipping. Warm light from upper left.

### tower-sprite-v1.png

参考：D:/2026/eventplay/apps/admin/public/games/race/illustrated/climb-sprite-v2.png

Use case: stylized-concept. Production 2.5D cartoon game prop sprite. Input image is STYLE REFERENCE ONLY: match bold clean outlines, rich dimensional shading, rounded shapes and polished cheerful game illustration, NOT flat vector. Subject: One modular building floor block, front elevation with subtly visible right side, pastel warm cream masonry with red trim, three glossy blue windows, flat horizontal top and bottom so identical floors can stack without seams. Squat rectangular single floor only, width three times height. No roof, no ground, no crane, no perspective vanishing tilt. Centered with empty padding. Genuinely transparent background with alpha, no black or white backdrop, no text, UI, watermark or logos. Warm light from upper left.

### brand-sprite-v1.png

参考：D:/2026/eventplay/apps/admin/public/games/race/illustrated/climb-sprite-v2.png

Use case: stylized-concept. Production 2.5D cartoon game prop sprite. Input image is STYLE REFERENCE ONLY: match bold clean outlines, rich dimensional shading, rounded shapes and polished cheerful game illustration, NOT flat vector. Subject: One elegant cartoon celebration medallion on small golden pedestal. Thick shiny gold circular frame with blue gems, small gold stars and orange ribbon at base. The central circular disk is blank pale cream and takes 60 percent of width so a real brand logo can be overlaid by software. Entire frame and base visible. No lettering or symbols inside blank central disk. Genuinely transparent background with alpha, no black or white backdrop, no text, UI, watermark or logos. Warm light from upper left.

### popcorn-sprite-v1.png

参考：D:/2026/eventplay/apps/admin/public/games/race/illustrated/climb-sprite-v2.png

Use case: stylized-concept. Production 2.5D cartoon game prop sprite. Input image is STYLE REFERENCE ONLY: match bold clean outlines, rich dimensional shading, rounded shapes and polished cheerful game illustration, NOT flat vector. Subject: Two-cell horizontal sprite atlas on a 2:1 canvas, each cell square with generous padding, no dividing lines. LEFT cell: one EMPTY red-and-cream striped popcorn bucket with gold trim, opening visible, a blank cream oval label; front view, no popcorn in bucket. RIGHT cell: compact low mound of fluffy golden buttery popcorn kernels, only popcorn, width nearly same as bucket opening, no bucket. Both isolated, no overlap, actual transparent background everywhere else. Genuinely transparent background with alpha, no black or white backdrop, no text, UI, watermark or logos. Warm light from upper left.

### forest-bg-v1.png

参考：D:/2026/eventplay/apps/admin/public/games/race/stadium-cartoon-v2.png

Use case: stylized-concept. 16:9 production game background. Input is STYLE REFERENCE ONLY. Match its polished bright hand-painted 2.5D cartoon style, rounded forms, dimensional shading and warm light. New location: Friendly forest adventure clearing. Rounded lush trees frame edges, tiny expedition tents and wooden supply crates on far left and right, mountains and bright sky behind. Open soft grass and sandy clearing across bottom 60 percent. Keep center upper sky clear for title and center/lower play area uncluttered for foreground sprites and score UI. Horizon near 35 percent. No characters, text, logos, UI, watermark or racecourse. Background only.

### garden-bg-v1.png

参考：D:/2026/eventplay/apps/admin/public/games/race/stadium-cartoon-v2.png

Use case: stylized-concept. 16:9 production game background. Input is STYLE REFERENCE ONLY. Match its polished bright hand-painted 2.5D cartoon style, rounded forms, dimensional shading and warm light. New location: Dreamlike sunny flower garden. Pastel greenhouse and flower beds at back left/right, rounded hedges, butterflies near corners. Open warm pale stone garden courtyard across bottom 60 percent. Keep center upper sky clear for title and center/lower play area uncluttered for foreground sprites and score UI. Horizon near 35 percent. No characters, text, logos, UI, watermark or racecourse. Background only.

### carnival-bg-v1.png

参考：D:/2026/eventplay/apps/admin/public/games/race/stadium-cartoon-v2.png

Use case: stylized-concept. 16:9 production game background. Input is STYLE REFERENCE ONLY. Match its polished bright hand-painted 2.5D cartoon style, rounded forms, dimensional shading and warm light. New location: Cheerful carnival town plaza. Ferris wheel in distance, red cream striped snack shop and popcorn machine far left, balloon stall far right, colorful pennants. Open peach paved plaza across bottom 60 percent. Keep center upper sky clear for title and center/lower play area uncluttered for foreground sprites and score UI. Horizon near 35 percent. No characters, text, logos, UI, watermark or racecourse. Background only.

### town-bg-v1.png

参考：D:/2026/eventplay/apps/admin/public/games/race/stadium-cartoon-v2.png

Use case: stylized-concept. 16:9 production game background. Input is STYLE REFERENCE ONLY. Match its polished bright hand-painted 2.5D cartoon style, rounded forms, dimensional shading and warm light. New location: Colorful cartoon town building site. Rounded pastel houses in distance, small yellow crane at far right and neat brick pallets far left. Open cream paved construction plaza across bottom 60 percent. Friendly safe toy-like architecture. Keep center upper sky clear for title and center/lower play area uncluttered for foreground sprites and score UI. Horizon near 35 percent. No characters, text, logos, UI, watermark or racecourse. Background only.

### stage-bg-v1.png

参考：D:/2026/eventplay/apps/admin/public/games/race/stadium-cartoon-v2.png

Use case: stylized-concept. 16:9 production game background. Input is STYLE REFERENCE ONLY. Match its polished bright hand-painted 2.5D cartoon style, rounded forms, dimensional shading and warm light. New location: Celebration festival stage outdoors in daylight. Blue sky, two rounded golden decorative arches at far sides, colorful side curtains and warm stage lamps, small confetti at outer edges. Broad open golden stage floor across bottom 60 percent. No center screen or medallion. Keep center upper sky clear for title and center/lower play area uncluttered for foreground sprites and score UI. Horizon near 35 percent. No characters, text, logos, UI, watermark or racecourse. Background only.

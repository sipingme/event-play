# 点击游戏首版

点击类共 9 个示例：原有左右冲刺赛 + 本次 8 款。新增模板 ID 为 click-{variant}。

| variant | 名称 | 规则 |
|---|---|---|
| tug | 团队拔河 | 两队，计时结束按贡献分判胜，同分并列 |
| boss | 齐心打 Boss | 全场合作；破盾、攻击、击败阶段；达标结束 |
| balloon | 气球充气赛 | 各队气球变大，满格放飞，积分继续累计；计时排名 |
| rocket | 火箭发射 | 全场蓄能、点火、升空；达标结束 |
| flower | 开花大作战 | 全场萌芽、长叶、开花；达标结束 |
| tower | 欢乐盖高楼 | 楼层按积分增长；视觉满格后继续计分，计时排名 |
| brand | 点亮品牌 | 品牌 Logo 或文字随全场进度点亮；达标结束 |
| popcorn | 爆米花派对 | 桶内爆米花随积分增加；满格后继续计分，计时排名 |

默认 60 秒、目标 200，试玩由现有服务限制到 30 秒。目标可在活动编辑器调整。
clickVariant 存入活动快照、联机配置、重赛配置。服务端校验 variant 与 mechanic/inputMode 一致；重复信令、限速、暂停和断线规则复用现有机制。

合作类复用 light，竞争类复用 race/tap，拔河复用 tug。旧活动不带 clickVariant，保持原效果。
八款场景已升级为赛马同系列 2.5D 卡通插画：12 个新增背景/主体素材，复用同系列火箭及赛场背景。SVG 负责分层、队色和积分驱动动画，不再用简易矢量角色。原始素材与提示词见 apps/admin/public/games/click/ART-DIRECTION.md。音效及更丰富粒子效果仍可继续打磨；Boss 破盾目前为视觉阶段，不含额外战斗数值规则。

验证：npm test；python -m unittest test_main；tests/browser-click-games.cjs（隔离 UI 4191 + 内存 API 8012）。未部署服务器或提交 GitHub。

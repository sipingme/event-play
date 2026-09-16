# EventPlay 管理端实施说明

## 启动

在 `D:\2026\eventplay\apps\admin` 中执行：

```powershell
npm install
npm run dev -- --hostname 127.0.0.1 --port 4180
```

访问 http://127.0.0.1:4180/dashboard 直接体验，或访问 `/login` 查看登录页。

## 已实现

- Next.js App Router、TypeScript、shadcn/ui、TanStack Query、TanStack Form。
- 登录、注册、邮箱验证、找回及重置密码表单与校验。
- 工作台、模板选择、活动搜索/复制/归档、手动保存草稿。
- 队伍、人数、时长、品牌 Logo 配置；三套主题、竞速和拔河示意预览。
- 本地规则匹配修改、撤销；不可变发布快照与草稿版本冲突检查。
- 模拟控制台：开局、暂停、继续、结束、中止；独立演示大屏。
- 模拟报告及 JSON 导出、品牌素材设置、明暗主题。

## 明确限制

这是前端演示，不可用于真实活动。数据只保存在当前浏览器 localStorage，不跨设备同步。
认证接口返回 HTTP 503，不会创建账号、发送邮件或保存密码。工作台不受真实身份保护。
“一句话”目前是可见的本地规则匹配，不是大模型。大屏是 SVG/CSS 示例，不是 PixiJS 正式引擎。
控制台贡献为固定速度模拟，真实玩家为 0。无微信入场码、联机、奖品发放和正式发布。
品牌色暂作为资料记录；预览采用预设主题色。草稿需要手动保存。

## 后续顺序

### 主持人端（已实现的本地彩排）

入口 `/host`：列出已发布演示版本的活动，恢复未结束局次或建立新局。独立于后台侧栏，适配手机/平板与桌面。
`/host/[id]`：开场人工检查、二次确认开局、暂停/恢复、提前结算、中止、分阶段口播、模拟战队贡献、最近 50 条手动操作记录。
`/screen/[id]`：同步游戏阶段与遮罩。遮罩不暂停计时。检查项不是自动投屏检测。
保留旧控制台 URL 的跳转。数据仍是同浏览器 localStorage，无真实身份、权限、WebSocket 或跨设备同步。

### 接入顺序

1. FastAPI 身份认证、组织权限与数据库；替换 service.ts 的本地存储实现。
2. 活动、素材上传、版本发布接口；登录保护、会话过期和错误恢复。
3. AI 结构化配置生成与校验，接入真实生成进度。
4. 小程序身份和房间入场、WebSocket 服务端权威计分、PixiJS 播放器。
5. 并发和断线压测、正式结果持久化与品牌战报。

## 验证

`npm test`：发布快照、过期草稿、房间状态转换和配置校验，3 项通过。
`npm run typecheck` 通过；`npm run build -- --webpack` 生产构建通过。
新增业务可用 `node node_modules/oxlint/bin/oxlint src/features/eventplay src/app` 单独检查。
全仓库 lint 仍包含上游模板未使用组件的 React 编译器/规范问题，未通过；没有隐藏这些规则。

## 模板来源

基于 https://github.com/Kiranism/next-shadcn-dashboard-starter ，保留原 MIT LICENSE。EventPlay 使用根目录统一 Git 仓库；模板原 Git 元数据备份在本机根目录 `.git-template-backup/admin.git`，不上传。
清理了 Clerk、Sentry、聊天、看板等示例集成；没有采用 enterprise-workflow-ui 视觉规范。
核心业务集中在 `src/features/eventplay`；`src/app` 负责路由。

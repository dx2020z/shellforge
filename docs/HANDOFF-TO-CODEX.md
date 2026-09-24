# ShellForge · 交接给 Codex 的完整上下文

> 交接时间：2026-09-23 下午
> 交接人：Claude（上一轮规划者）
> 接手方：Codex（继续开发）
> 项目根目录：`D:\中转桌面\游戏开发项目`
> 交付截止：2026-09-24 上午（时间紧）

---

## 0. 你接手时先读这一段

Codex 你在本轮对话中，为"接入 Tripo/DeepSeek"做规划，做到一半因额度耗尽中断。**你的中断位置是**：你已确认了核心差距（旧方案生成单部件 vs 用户要生成整只怪物），提示"仅填密钥不够，需要调整生成和入库流程"，并问了用户两个问题（Tripo/DeepSeek 控制台网址、比赛提交链接）。

**你中断之后发生的事**（由 Claude 完成）：
1. 定位到你的输出目录 `D:\中转桌面\游戏开发项目`（分支 `codex/shellforge-local`，无 commit）
2. **导入了队友美术包**（9 个 Tripo 生成的 GLB 部件已接入游戏默认界面并验证 HTTP 200）
3. **核实了密钥已由用户填好**（`.env.local` 三个密钥位置已填）
4. **核实了 DeepSeek 模型名必须用 `deepseek-flash`**（`deepseek-v4-flash` 已退役）
5. **读遍了生成链路全部代码**，确认当前是"单部件生成"架构

**你要做的核心工作**：把"单部件生成"扩展成"用户一次性描述头/身/脚 → 三个部件生成 → 拼成整只怪物 → 战斗"。

---

## 1. 用户的玩法诉求（最新确认版 · 以此为准）

用户原话（2026-09-23）：

> "让玩家自己一次性说明自己想要什么头？什么身体？什么脚？然后 DeepSeek 来理解后，分别让 3d 生成对应的怪物部件进行组合。如果你觉得这样不能组成一个整体的怪物的话，则需要能够让 DeepSeek 直接基于这三个要求来组合成一个完整的怪物描述，最终让 3d 生成一个完整的怪物模型，然后进行战斗。"

**拆解为需求**：
- **主路线**：玩家在**一个界面**里，一次性输入对"头 / 身体 / 脚"的描述（可以是三段文字，也可以是一句话里包含三者）
- DeepSeek 理解后，**分别产出三个部件各自的英文 3D prompt**
- 分别提交 Tripo 生成**三个部件 GLB**（头一个、身一个、腿一个）
- 三个 GLB 装配到现有三槽位 → 玩家看到"一整只怪物"
- 用这只怪物和系统内置敌人战斗（复用现有战斗系统）
- **降级路线**（仅在主路线拼不出可用整体时启用）：DeepSeek 把三个要求合成一个完整怪物描述 → Tripo 生成一个整体 mesh → 直接上战斗

**★ Claude 的判断（已向用户说明）**：主路线技术可行，且是**唯一现实选择**。因为：
- 现有架构（`CreatureScene.tsx` 三 anchor Y=2.4/1.5/0.68）本身就是三槽位拼装设计
- 队友 9 个资产正是按三槽位拼装生成的，已通过实际拼装验证
- 降级路线若早用，会推翻"缴获/传承/换装"整个战斗系统（整只 mesh 无法拆件），截止时间前不可行

---

## 2. 用户想法的演进（避免误读）

| 阶段 | 用户的表述 | 实质 |
|---|---|---|
| 最初（9-22） | "玩家输入一个描述，它能够生成这个3D的怪物" | 想要"一句话 → 整只怪物" |
| 上一轮（9-23 上午） | "整只怪物" vs "单部件" | 意识到旧方案是单部件，要整只 |
| **最新（9-23 下午，以此为准）** | "一次性说明要什么头/什么身体/什么脚，分别生成三个部件进行组合" | **明确为：一次输入三个槽位描述 → 生成三个部件 → 拼成整只** |

**关键**：用户已从"一句话生成整只"收敛到"一次输入、三段描述、生成三部件、拼装"。这**降低**了实现难度，且完全贴合现有架构。不要按"单次调用生成整只 mesh"去实现。

---

## 3. 本轮 Claude 已完成的改动（不要重复做）

### 3.1 队友美术包导入（已完成并验证）
把 `C:\Users\hp\Desktop\ShellForge_美术资产.zip` 的 9 个部件接入工程：

- 复制 GLB → `public/assets/parts/<id>/model.glb`
- 复制 PNG → `public/assets/parts/<id>/preview.png`
- 重写 `public/assets/parts/<id>/manifest.json`：
  ```json
  {
    "modelPath": "/assets/parts/h01/model.glb",
    "previewPath": "/assets/parts/h01/preview.png",
    "scale": 1,
    "rotation": [0, 0, 0],
    "offset": [0, 0, 0]
  }
  ```
- 覆盖的 id：`h01 h02 h03 b01 b02 b03 l01 l02 l03`
- **验证**：`npm run build` 成功；`npm start` 后 9 个 GLB + 9 个 PNG + 9 个 manifest 全部 HTTP 200

**注意**：队友 GLB 每个 12–16MB（超出策划稿 5MB 目标，队友 README 自述未减面）。一次战斗要加载玩家3件+敌人3件≈90MB，**存在加载慢的风险**，演示前需实测。

### 3.2 密钥核实（用户已填，你无需再填）
- `DEEPSEEK_API_KEY` = 已填
- `DEEPSEEK_MODEL` = 已填（**必须是 `deepseek-flash`**；`deepseek-v4-flash` 是已退役旧名）
- `TRIPO_API_KEY` = 已填
- `TRIPO_MODEL` = `v3.1-20260211`
- `.env.local` 已被 `.gitignore` 忽略（`.env*`），不会进仓库。**你不得读取、输出、提交任何密钥内容。**

---

## 4. 当前工程真实现状

### 4.1 技术栈与结构
- Next.js 16.3.5 + React 19.3.0 + Three.js 0.186.0，TypeScript
- 启动：`npm run build` → `npm start`（端口 3018，仅监听 127.0.0.1）
- 校验：`npm test`（17 项）、`npm run typecheck`
- 关键目录：
  - `src/domain/` — 游戏逻辑（catalog 部件表、engine 战斗、game 流程、storage 存档）
  - `src/server/` — 服务端（config、http、model-tasks、providers/{deepseek,tripo,local,types}）
  - `src/app/api/` — 路由（generation/part、generation/model、generation/model/[id]、models/[id]、status）
  - `src/features/` — 前端（forge/ForgePanel 外观祭坛、viewer/CreatureScene 3D、viewer/PartViewer、battle/BattleStage）
  - `src/components/GameClient.tsx` — 主界面壳

### 4.2 当前生成链路（单部件）
```
ForgePanel.tsx  (选中一个部件 → 输入描述)
  → POST /api/generation/part  {partId, prompt}
      → deepseek.ts generateDraft()  (一次一个 partId，system prompt 写死 "Keep the specified slot; no full creature")
  → ForgePanel 显示 draft（名称/描述/visualPrompt）
  → 点"生成3D" → POST /api/generation/model {id, partId, prompt:visualPrompt}
      → model-tasks.ts createTask() → tripo.ts submitTripo()
  → 轮询 GET /api/generation/model/[id] → pollTask() → queryTripo() → downloadModel()
  → 成功 → GET /api/models/[id] 返回 GLB → ForgePanel "装配生成模型" → onApply → CreatureScene 显示
```

### 4.3 关键限制（实现时必须遵守）
- `src/server/http.ts: assertLocalRequest` — 生成接口**仅本机可调**（host 必须 localhost/127.0.0.1，且同源）。跨设备演示会 400。
- `readJson` — 请求体 > 6000 字节直接拒绝。三部件描述要注意长度。
- `src/assets/schema.ts: isModelPath` — modelPath 必须匹配 `^/assets/parts/[a-z0-9_./-]+$` 且以 `.glb` 结尾，或 `/api/models/<uuid>`。
- `readAppearances` — 部件 id 必须匹配 `/^[hbl]0[1-3]$/`。
- `model-tasks.ts: downloadModel` — GLB 硬上限 40MB；下载域名默认只允许 `tripo3d.ai` 及子域（其余需填 `TRIPO_ASSET_HOSTS`）。
- Tripo 返回的 URL **会过期**，必须提交后尽快下载（现有 `pollTask` 已实现）。
- Tripo 是异步的，**生成约 60–90 秒**（官方文档示例 90s）；现有轮询间隔 60 秒、最多自动查 10 次。

---

## 5. 待做清单（你的工作）

### 任务 A（核心）：把单部件生成扩展为"三部件一次生成"
1. **新增/改造服务端接口**：接受用户的"头/身/脚三段描述"，用 DeepSeek 一次产出三个部件的 `PartDraft`（各含中文名、描述、英文 visualPrompt）
   - 建议新路由：`POST /api/generation/creature`，body `{head, body, legs}`（或 `{description}` 让 DeepSeek 自己拆三段）
   - DeepSeek system prompt 需强化："为用户描述的头/身/腿分别产出独立、互相协调的部件 prompt，每个部件是独立可拼装的模块"
   - 保留 Zod/结构白名单校验 + 失败回退 `local.ts`（现有 `parseDeepSeekDraft` 模式）
2. **前端新增"整只生成"入口**（`GameClient.tsx` 的 tab 或 ForgePanel 内）：
   - 一个输入区，玩家分别填头/身/脚的描述（或一句话）
   - 点"孵化" → 调新接口拿三个 draft → 并发/串行提交三个 Tripo 任务
   - 三个任务进度分别显示（复用 `ModelTask` 状态机与 `localStorage` 持久化）
3. **装配**：三个 GLB 就绪后，分别 `onApply` 到 `h0x/b0x/l0x` 三个槽位，`CreatureScene` 自然拼成整只
4. **校准**：不同部件朝向/比例可能不齐。现有 `ForgePanel.tsx:73` 装配时默认 `rotation:[0,90,0]`，队友 manifest 是 `[0,0,0]`——**新生成部件的朝向需要实际观察后校准**，可复用"模型转向 90°"按钮或写进 manifest

### 任务 B：生成等待体验
- Tripo 生成 60–90 秒，三个零件最坏更久。需要一个"孵化中"的进度表现，避免玩家以为卡死。
- 复用用户既有 90 秒演示剧本里"全屏孵化动画覆盖生成延迟"的设计（见 `docs/` 或用户记忆）。

### 任务 C：演示降级兜底
- 队友 9 个 GLB 已就位，可作为**预置怪物库**：即使 API 现场失败，也能用内置部件组合出"怪物"继续演示。
- 确保"无密钥/API 失败"时游戏仍可玩（当前已实现回退，勿破坏）。

### 任务 D：提交材料
- 工程 git **尚无任何 commit**（只有 init）。需要 `git add` + 首次 commit + 推 GitHub（比赛要求公开仓库链接）。
- 提交时注意 `.gitignore` 已排除 `.env* / .runtime / node_modules / .next / delivery / work`。

---

## 6. 比赛提交要求（已确认）

- 可玩 Demo
- 项目介绍（商业计划或技术说明）
- GitHub 仓库 / 官网链接
- 参赛成员信息
- 参选主题与赛道：**报「NEW LIFE · AI 游戏与交互世界」赛道**
  - ⚠️ **坑**：规则里出现的 "SHELL FORGE" 是**另一个硬件赛道**，与我们的游戏名 ShellForge 同名但无关，不要报错赛道
- 小红书笔记（可选）
- 评分：创新2 + 技术难度1.5 + 完成度1.5 + 商业价值1（通用6）+ 现场可玩1 + 生成式深度1 + 涌现1 + 叙事1（NEW LIFE专属4）
- ⚠️ **AI 只生成外观不够**：评分要求描述影响怪物的能力/战斗选择/传承。当前 `deepseek.ts` 明确"不发明数值和技能"，**这一点可能是失分项**，需评估是否让描述影响数值。

---

## 7. 你（Codex）开工前必须遵守

1. **R1 先勘察**：动手前先跑命令取真实值（字段名、返回码类型、CLI 参数、路径），不要凭记忆
2. **R2 改完真跑**：改主进程/入口/构建配置后，必须真实启动并检查 stderr 与关键输出，不能只看 `typecheck` 通过
3. **R3 改名删除后全项目 grep 核验零残留**
4. **R4 外部系统首跑成功≠稳定**：Tripo 先单次跑通，再观察连续 3–5 次
5. **不读/不输出/不提交密钥**
6. **保留用户已有进度与无关改动**，不擅自回滚
7. **`.env.local` 不要覆盖**

---

## 8. 验收标准（完成任务的判定）

- [ ] 用户在**一个界面**输入头/身/脚描述（或一句话）
- [ ] DeepSeek 产出三个部件的独立 prompt（真实调用，非本地回退）
- [ ] Tripo 真实生成三个部件 GLB 并下载到 `.runtime/models`
- [ ] 三个 GLB 装配成完整怪物，在 3D 场景显示
- [ ] 用该怪物与内置敌人完成一场战斗
- [ ] 真实启动无 stderr 错误，首页/资源/API 均 200
- [ ] 无密钥或 API 失败时游戏仍可玩（回退不破坏）
- [ ] Git 首次 commit + 公开仓库链接

---

## 9. 参考文档（工程内）
- `docs/ART_AND_API.md` — 美术接入规格与 API 填写说明
- `docs/IMPLEMENTATION.md` — 上一轮实施与验收记录
- `docs/ONLINE_TEAM_TASKS.md` — 五人协作边界
- `README.md` — 项目总览

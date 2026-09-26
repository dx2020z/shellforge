# 交接说明：ShellForge《造物之海》（给接手的开发者 / GPT）

> 写于 2026-09-26。**动手之前请从头读完这份说明。**
> 这个文件夹里的代码已经整体换成了重写后的 v2 版本（由 Claude 在 `ShellForge-v2` 文件夹里完成，再同步到这里）。
> 旧版代码没有丢：git 历史里有，旁边的 `游戏开发项目-旧版备份-日期时间` 文件夹里也有一份完整备份。
> 从现在起，**这个文件夹（游戏开发项目）就是唯一的正式项目**。`ShellForge-v2` 只是当时的工作副本，不要再往那边改。

---

## 1. 现在是什么状态

- 可以玩的完整版本，手机和电脑都能玩。本地启动：双击 `启动游戏.cmd`，会打开 http://localhost:3020。
- 核心玩法是「写字对决」：写一句话锻造造物，对决里用话语卡、临场写字出招。规则见 `README.md` 的「怎么玩」。
- 已经验证过：`npm run check`（类型检查、111 个单元测试、资源体积）和 `npm run build` 都通过。
- DeepSeek（写造物、嘲讽、墓志铭）和 Tripo（按原话生成专属 3D 部件）在用户电脑上实测可用。
- 还没部署上线。这个文件夹目前的 git 改动都没有提交。

## 2. 你的第一个任务：提交并部署

1. `git status` 看一下改动，提交到 GitHub。提交信息可以写：`v2：写字对决版 + 预生成模型`。
   - **必须提交**：`public/assets/gen/`（22 套、约 20 MB 的预生成模型）、`src/domain/generated-models.json`（它们的清单）、`public/assets/creatures/`、`public/assets/parts/`。
   - **不要提交**（已经写在 `.gitignore` 里）：`.env*`（`.env.example` 除外）、`assets-src/`、`.runtime/`、`docs/screens/`、`node_modules/`、`.next/`。
2. 在 Vercel 导入这个 GitHub 仓库，框架选 Next.js，保持默认设置。Node 版本要 22 或更高。
3. 在 Vercel → Settings → Environment Variables 里，按 `.env.example` 填这些变量。值请用户自己填，**不要读取、打印或复制 `.env.local` 里的值**：
   - `DEEPSEEK_API_KEY`、`DEEPSEEK_MODEL`（`DEEPSEEK_BASE_URL` 可以不填）
   - `TRIPO_API_KEY`、`TRIPO_MODEL`（`TRIPO_BASE_URL`、`TRIPO_ASSET_HOSTS` 可以不填）
   - `SHELLFORGE_DAILY_FORGE_LIMIT`：全站每天最多锻造几次，默认 400。
   - `SHELLFORGE_DAILY_MODEL_LIMIT`：全站每天最多生成几件 Tripo 部件，默认 300，也就是约 100 只造物。超过以后只用预生成部件，不再扣 Tripo 额度。
4. 在 Vercel → Storage 里开通 **Blob** 和 **Upstash Redis**，并连接到这个项目。开通后会自动写入 `BLOB_READ_WRITE_TOKEN`、`UPSTASH_REDIS_REST_URL`、`UPSTASH_REDIS_REST_TOKEN`。
   - **没开这两个，线上不会启用 Tripo。** 代码里写死了这条规则（`src/server/config.ts` 的 `tripoUsable`）：Vercel 函数没有持久磁盘，生成的模型和任务记录会丢，既白花钱，玩家刷新后专属外形也会不见。这时游戏照常能玩，只用预生成部件。
5. 重新部署以后，打开 `https://你的域名/api/status`，应该看到 `deepseek: true, tripo: true, durable: true`。
6. 用手机和电脑各打开一次正式域名。新玩家应该看到**空存档**，没有任何造物。

## 3. 玩家的数据存在哪里（重要）

- **进度存在每位玩家自己的浏览器里**（localStorage 的 `shellforge.v2.save` 这一项）：包括造物、名册、谜语、守卫库、成长和传承。服务器不保存任何玩家存档，也没有账号。
  - 玩家关掉浏览器、重启电脑或手机、你重新部署网站，存档都**不会丢**。
  - 这些情况会丢：玩家清除浏览器数据或网站数据、用无痕模式、换了浏览器或设备，或者访问的域名变了（Vercel 预览地址 `xxx-git-xxx.vercel.app` 和正式域名是两份存档）。**请始终让玩家用同一个正式域名。**
  - 游戏启动时会调用 `navigator.storage.persist()`，请浏览器把存档当作持久存储，减少 iPhone Safari 这类浏览器自动清理的机会。
  - 存档每一步都会立即写入。读档用严格校验（`src/domain/save.ts`）；读不懂的存档会另外存成 `shellforge.v2.save.broken`，并尝试自动找回，不会直接清空。
- **Tripo 生成的专属模型**：线上存在 Vercel Blob（公开 CDN 地址），存档里只记这个地址。
- **生成任务记录和限流计数**：线上存在 Upstash Redis，本地存在 `.runtime/`。
- 以后如果要加「导出 / 导入存档」或云端账号，请在 `src/domain/save.ts` 的基础上扩展，不要改现有字段的含义。

## 4. 已经做完的，请不要改（除非用户明确要求）

| 模块 | 文件 | 说明 |
|---|---|---|
| 对决规则引擎 | `src/domain/duel.ts` | 纯函数，结果可重现：话语卡用过歇两回合、墨水、读不懂的话算扑击、谜语、三件连携、守卫狂暴。改数值前先跑 `npx tsx scripts/duel-sim.ts` 看平衡。 |
| 守卫 | `src/domain/duel-guards.ts` | 6 位预设守卫和亡者守卫。守卫的部件永远不和玩家撞款。 |
| 名册、成长、传承 | `src/game/logic.ts` | 名册最多 5 只，印记上限 5，传承。 |
| 存档格式和校验 | `src/domain/save.ts` | 严格校验、坏档备份。**新增的模型地址格式必须加进 `MODEL_URL`，否则玩家存档会被判成坏档**（已经踩过这个坑）。 |
| 预生成模型 | `src/domain/pregen-catalog.ts`、`generated-models.json`、`public/assets/gen/` | 已经花了 Tripo 额度，质检也通过了，不要删、不要重新生成。 |
| 部件挑选 | `src/domain/model-pool.ts` | 按原话挑最像的部件；写到哪种动物，就用那种动物的部件。 |
| Tripo 调用规则 | `src/server/model-tasks.ts`、`providers/tripo.ts` | 同一个任务编号只提交一次；结果不明时不自动重试；按部位用固定的提示词模板。 |
| 装配比例 | `src/three/part-fit.ts`、`assembly.ts` | 头宽是身宽的 72–100%；躯干太瘦高时会压扁一些。 |

## 5. 项目约定（来自 CLAUDE.md，仍然有效）

- 不要读取、打印或复制任何 `.env` 文件里的值。
- 调用 Tripo 会花钱。批量生成或测试生成之前，必须先问用户。
- 不要把 `assets-src/` 里的原始大模型复制进 `public/`；要压缩就用 `scripts/optimize-models.ts` 或 `scripts/pregen.ts`。
- 不要复刻任何知名角色或品牌的形象（旧的第 13 套已经排除）。
- 全游戏的引号统一用「」。

## 6. 常用命令

| 命令 | 作用 |
|---|---|
| 双击 `启动游戏.cmd` | 本地启动（端口 3020） |
| `npm run check` | 类型检查 + 测试 + 资源体积（提交前必跑） |
| `npm run build` | 生产构建 |
| `npx tsx scripts/duel-sim.ts` | 对决平衡模拟 |
| `npx tsx scripts/duel-flow.ts mobile\|desktop\|landscape` | 全流程截图（先 `npm start`；截图在 `docs/screens/`） |
| `/design/models` 页面，或 `npx tsx scripts/model-sheet.ts` | 预生成模型质检 |
| 双击 `预生成模型.cmd` | 补生成或重做预生成部件（**会花 Tripo 额度，先问用户**） |

## 7. 可以接着做的方向（和用户确认后再做）

- 上线后用手机实测，重点看横屏、小屏和 iPhone Safari。
- 存档导出 / 导入（换设备时带走进度）。
- 守卫台词由 DeepSeek 根据玩家原话临场生成。
- 每日挑战：每天换一位守卫、一道谜语。
- 造物卡分享页：一个链接就能看到这只造物。

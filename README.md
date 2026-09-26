# ShellForge · 造物之海

写下一句话，它就成为你的造物。带着它潜入深海，挑战遗迹守卫。胜利缴获部件，失败传承血脉。

> 当前进度：**写字对决版**——工坊写一句话锻造 → 对决里用话语卡和临场写字出招 → 6 位预设守卫 + 亡者守卫 → 成长、传承、名册 5 只。手机与电脑都能玩。
> 接手的开发者请先读根目录的 **交接说明-给GPT.md**。
> `/?demo=1` 是独立的演示存档；`/?offline=1` 完全离线。设计系统预览：`/design`，预生成模型质检：`/design/models`。

## 怎么玩（写字对决样板）

1. 工坊里先看守卫的**三道谜语**，再写一句话描述你的造物。写下的词会变成它身上的**话语卡**，比如「喷火」→ 灼烧、「硬壳」→ 坚壳。
2. 对决里，守卫头上会亮出它这回合要做的事（「直刺」「上弦」「合甲」…），只给一句提示，不给数字、不给标准答案。
3. 你的出招就是说话：点一张话语卡（每句只能说一次），或者用墨水**临场写一句**（最多 12 个字，共 3 滴墨）。守卫读得懂的动作会变成一招，读不懂就落空。
4. 谜语要用写字去解：写出守卫怕的东西、绕到它的死角、或者写出它的秘密，会有很大的效果。解开的谜语会一直记着，下一代造物也知道。
5. 海沟里有 6 位属性各不相同的守卫（铜甲斥候、熔岩蟹卫、海草齿轮鹿、螳螂虾刃卫、火山蜥蜴、帽檐古龙），打败一位就轮到下一位。
6. 名册最多同时养 **5 只活着的造物**，在工坊上方点头像切换出战的那只；空位可以写一只新的。
7. 每只造物只有一条命。输了，造物长眠、留下墓志铭：可以选一件部件传给下一代，也可以不传承、让它安静离开（空出名额）。也可以随时撤退保命。
8. 长眠的造物会进档案库，**同时变成海沟里的「亡者守卫」**：它用你当初写下的话出招，谜语藏在它的原话里。你死得越多，守卫库就越大，之后的造物可能会遇到它。
9. 右上角书本图标是图鉴：档案库（所有造物，按血脉）和守卫库（预设守卫 + 亡者守卫），任何一只造物都能导出造物卡（PNG）。

键盘：数字键说出对应的话语卡，`W` 临场写一句，空格「扑过去」。

## 最简单的启动方式

双击项目文件夹里的 **启动游戏.cmd**。它会：

1. 项目里没有密钥文件 `.env.local` 时给出提示（脚本不会显示里面的内容）；
2. 关掉占着 3018 / 3020 端口的旧服务；
3. 第一次运行时自动 `npm install`；
4. 启动游戏并自动打开 <http://localhost:3020>（正式模式）。

## 本地运行

需要 Node.js 22.16 或更高版本。

```powershell
npm install
# 把 .env.example 复制为 .env.local 并填入密钥（不要发到聊天里、不要提交）
npm run dev
```

打开 <http://localhost:3020>（加 `?demo=1` 是一份独立的演示存档，AI 照常可用；加 `?offline=1` 才完全离线、不调用 DeepSeek / Tripo）。没有密钥也能玩：锻造会使用本地关键词映射，3D 使用预置部件。

## 常用命令

| 命令 | 作用 |
|---|---|
| `npm run dev` | 开发服务器（端口 3020） |
| `npm run build` / `npm start` | 生产构建与启动 |
| `npm run check` | 类型检查 + 单元测试 + 资源检查 |
| `npm test` | 单元测试（vitest） |
| `npm run check:assets` | 扫描 GLB 三角面、贴图尺寸、文件大小 |
| `npm run audit` | 7 种尺寸巡检：溢出、裁切、字号、触屏点击区域、图片模糊 |
| `npm run screens` | 用 Playwright 截图 390×844 与 1440×900，存到 `docs/screens/` |
| `npm run fonts` | 重新子集化字体（原始字体放 `assets-src/fonts/`，不入库） |
| `npm run check:deepseek` | 用 `.env.local` 里的配置实测一次 DeepSeek（不打印密钥） |
| `npm run sim` | 战斗平衡模拟：新手 / 贪心 / 随机三种策略，按验收区间标出未达标项 |
| `npx tsx scripts/flow.ts mobile\|desktop\|landscape [--loss]` | 全流程截图（先 `npm start`） |
| `npx tsx scripts/optimize-models.ts` | 把 `assets-src/legacy-models` 里的旧生成模型压缩进 `public/assets/creatures` |
| 双击 `预生成模型.cmd`（或 `npx tsx scripts/pregen.ts`） | 调 Tripo 预生成 16 套动物/植物部件 + 6 套守卫外形到 `public/assets/gen`，可续跑；`--redo 套装:槽位` 重做单件（**会扣 Tripo 额度**） |
| `npx tsx scripts/model-sheet.ts [套装,套装]` | 预生成模型质检联系表（先 `npm start`，也可直接打开 `/design/models`） |

## 部署（GitHub + Vercel）

1. 代码推到 GitHub 仓库。
2. 在 Vercel 用 GitHub 登录，导入仓库，框架选 Next.js（默认即可）。
3. 在 Vercel 的 Environment Variables 里填 `.env.example` 中的变量。
4. 在 Vercel 的 Storage 里开通 **Blob**（保存生成的 3D 模型）和 **Upstash Redis**（生成任务记录与限流），它们会自动写入 `BLOB_READ_WRITE_TOKEN` 和 `UPSTASH_REDIS_REST_*`。
5. 以后每次推送到主分支都会自动上线。手机和电脑打开同一个网址即可游玩；进度保存在各自的浏览器里。

公网接口的保护：只接受本站页面发起的请求（同源），按 IP 每小时限流，全站每日锻造上限由 `SHELLFORGE_DAILY_FORGE_LIMIT` 控制（默认 400），全站每日 Tripo 专属部件上限由 `SHELLFORGE_DAILY_MODEL_LIMIT` 控制（默认 300 件 ≈ 100 只造物；超过后只用预生成部件，不再扣费）。

部署前检查：
- `public/assets/gen/`（约 20 MB 的预生成模型）和 `src/domain/generated-models.json` **必须提交**；`assets-src/`、`.env*`、`.runtime/`、`docs/screens/` 不提交（已在 `.gitignore`）。
- `npm run check`（类型检查 + 测试 + 资源体积）和 `npm run build` 都通过再推送。
- 新玩家打开网址是空存档（没有任何造物），第一只造物锻造时先穿预生成部件，Tripo 专属外形好了自动换上。

## 目录

```
src/
  app/            页面与 API 路由（/api/forge、/api/models/tasks、/api/lines/*、/api/status）
  server/         DeepSeek 与 Tripo 调用、生成任务、存储适配（本地文件 / Redis / Blob）、限流
  domain/         关键词、预置部件、造物档案、存档 v2
  three/          装配归一化、模型缓存、统一材质、取景
  ui/             设计系统组件（按钮、面板、贝壳生命、潮能珍珠、潮位、意图气泡、行动卡……）
scripts/          资源检查、截图、字体子集化、DeepSeek 自检
tests/            vitest 单元测试
docs/             迁移报告、设计参考、截图
public/           预置部件 GLB、子集化字体
```

## 安全约定

- 密钥只放在 `.env.local`（本地）或 Vercel 后台（线上），从不进入浏览器或仓库。
- Tripo 是付费接口：同一任务编号只提交一次；结果不明时不会自动重试。

# ShellForge v0.2 · 当前实施与验收记录

本文件保留此前 v0.2 阶段的历史验收记录；2026-09-23 新增的三件孵化入口、真实 API 联调与当前限制见 `CREATURE_GENERATION.md`。下文“未配置”和“60 秒查询”等表述仅描述当时版本。

更新：2026-09-23。本文件替代此前 v0.1 清单；旧清单曾把“备份存档”和“完整队友包”勾为完成，但当时源码没有相应实现，不能作为验收证据。

## 本轮目标与范围

用户原意：不像真正游戏；需要队友美术接入、3D 生成和 DeepSeek 配置，并继续推进。
本轮交付：可见的完整 3D 造物、可换装的三个槽位、双方自动战斗演出、胜败结算、浏览器存档、真实 GLB 加载、服务端生成适配器和完整队友工程包。
当前仍是单机自动战斗原型，不是实时动作游戏、多人联网产品或自由技能生成系统。外观生成不会改变平衡数值。
用户已授权在 D:\中转桌面\游戏开发项目实施。先在 Codex 工作区编写和验证，再按哈希防冲突同步，不覆盖独立改动或密钥。

## 环境和勘察证据

- staging：C:\Users\hp\Documents\Codex\2026-09-22\bang\work\shellforge-source。
- 目标 Git 分支：运行 git -C 目标目录 branch --show-current，实际输出 codex/shellforge-local；初始业务文件均未提交，未擅自创建提交或回滚。
- Node 22.16.0；Next 16.3.5、React 19.3.0、Three 0.186.0。package-lock 与 package 版本统一为 0.2.0。
- 查询 node_modules/next/dist/bin/next start --help，确认 -H/--hostname；启动仅监听 127.0.0.1。
- 查询 three/src/renderers/webgl/WebGLShadowMap.js，确认 PCFSoftShadowMap 已移除；改用 PCFShadowMap。
- powershell.exe 5.1 实跑同步 -CheckOnly：Target=D:\中转桌面\游戏开发项目，Pending=66，Files=71，Conflicts=0。该次只读，不代表已同步。
- 旧样式问题的已知机制：运行中的生产进程与被覆盖的 .next 构建不一致，HTML 引用了不存在的旧哈希 CSS。现在停止旧进程后构建，启动后核对 HTML 引用的全部 CSS/JS。

## 已接入实际页面

- src/features/viewer/CreatureScene.tsx：共用 Three 场景、拖动旋转缩放、组装和双方战场、攻击位移／受击／倒地、WebGL 失败时二维回退。
- procedural.ts：九件可区分的低多边形内置零件。作为本地可玩的造型，不冒充 AI 或队友美术。
- public/assets/parts/<id>/manifest.json：GLB、预览和变换；按槽位高度归一化。模型缺失、格式或配置错误保留程序造型。
- BattleStage：自动、暂停、倍速和跳过；基于已保存事件演出，不在 UI 重算伤害；结算回调每场一次。
- game/storage：战斗中不能换装；损坏战斗快照、非法装备、地图越界被拒绝；写入前保留上一份有效存档；无法持久化时明确提示。
- ForgePanel：本地／DeepSeek 来源标签，设定采用，Tripo 明示消耗额度后提交，状态查询、模型装配、转向与恢复。
- server/providers：DeepSeek JSON 请求和结构白名单、Tripo v3 创建／查询、超时与降级。密钥只在 .env.local 服务端读取。
- model-tasks：本机任务持久化、同 ID 防重发、结果不明不自动重试、60 秒查询间隔、GLB 下载限额和受信域名、缓存模型路由。
- scripts/pack-teammates.mjs：完整源码和运行配置；排除密钥、存档、依赖及缓存。具体分工见 ONLINE_TEAM_TASKS.md。

## 本地验证证据

2026-09-23 最新源码：
- node scripts/test.mjs：17 项通过，0 失败，退出码 0。包括胜败、传承、重复奖励、坏存档、战斗换装锁、素材变换、LLM 不改属性、缺钥回退、Tripo 数字状态码、付费任务防重发和下载路径。
- Next 生产构建：退出码 0；TypeScript 通过；生成首页及五条 API 路由；staging BUILD_ID 为 lf1ZbrLOswA5w3PgGuIJv。
- 前一轮真实启动 3019：Ready；首页 200；HTML 引用 11 个 CSS/JS 均 200；/api/status 返回 version=0.2.0 且两项 configured=false；生成设定返回 local；非法 partId 返回 400；GLB 样本返回 200。
- 浏览器桌面 1440×1000 与窄屏初次渲染均显示完整场景（窄屏上下排列）。换岩甲身后角色身体改变，生命 50→62、攻击 23→18、防御 9→14、速度 14→12。
- 浏览器实际流程：默认第一战获胜，领取钻角头，蓝图 5→6；第二战失败，选焰喙头传承；刷新后第 2 代、生命 55、历史 2 场保持；再次挑战获胜、领取盾壳头，推进第三位守卫。
- 暂停时 55/55 与 60/60 保持；继续与 2× 可播放完成。
- 外观祭坛未配置时显示 LOCAL 与“尚未生成新模型”，3D 收费按钮禁用。
- 临时接入真实 test-head.glb，蓝色头出现在完整角色上；实测截图 outputs/ShellForge-v0.2-GLB-validation.png。
- 临时坏路径 missing.glb：DOM 显示“h01 模型加载失败，保留内置外观”，角色仍可用。验收后已恢复 manifest 为 modelPath=null，不交付坏路径。
- 验收发现并修正：Three 阴影兼容警告、过宽 CSS 选择器影响画面标签位置、刷新后仍提示第一位守卫。最终生产启动将在目标目录另行补记。

## 未验证与差距

没有用户的真实 API 密钥，未执行真实 DeepSeek 或 Tripo 付费调用；离线样本测试和适配器完成不等于账号联通。
尚无队友正式美术；当前只验证内置样本 GLB，正式资源需按面数、贴图、轴向和接缝重新验收。
没有音效、骨骼动画、局外经济、账号云存档、多人对战、长期平衡数据。不要将这些未来项混入已完成功能。
依赖的安装网络和另一台队友电脑未实测，完整包包含锁文件，不含 node_modules。

## 本次纠偏

偏差：用户要能玩且能接美术/API 的原型 → 旧版本主要是属性表单、占位符与“已记录描述”。
主因：实现和验收缺口；没有美术队友不是表单式交付的充分理由。
修正规则：展示型功能必须从实际入口验证“画面变化＋交互闭环＋错误回退”，不能用类型检查和空接口替代。
本条保存在项目记录；未声称写入 E 盘永久错误索引。


## D 盘最终交付验证（2026-09-23）

- Windows PowerShell 5.1 同步退出码 0：Written=66，Files=71，无冲突。旧文件备份位于 Codex work/shellforge-backups/20260923-083538；同步排除了 .env.local 和缓存。
- D 盘根目录已在不存在的前提下创建 .env.local 空白模板，没有填写或读取用户密钥。
- 在 D:\中转桌面\游戏开发项目实际执行 next build --webpack，退出码 0；目标 BUILD_ID=6c_MgIXyklyamgU7z6Cq2。
- D 盘实际启动：next start -H 127.0.0.1 -p 3018，Ready in 1148ms。启动日志及请求后的 stderr 无错误。
- node work/smoke-shellforge.mjs http://localhost:3018：退出码 0，home=200，assets=11，allAssets=200，version=0.2.0，draftSource=local，invalidInput=400，crossOrigin=400，glb=200；两服务 configured=false。
- 浏览器打开 localhost:3018：正确恢复原有第 2 代、6/9 蓝图、未结算战斗；自动播放到传承选择。未代替用户选择或清除原进度。
- 使用独立网址 127.0.0.1:3018 验证新存档组装；存档与 localhost 各自独立，未清除任何已有档案。实际画面保存至 outputs/ShellForge-v0.2-game.png。
- 窄屏 390×844 设定下，实际内容宽 383 与 viewport 383 一致，无横向溢出，canvas 358×420。已撤销临时尺寸覆盖，浏览器返回 localhost 原进度。
- 最终构建没有新增控制台 error/warn；控制台中旧 PCFSoftShadowMap 警告来自此前 3019 旧构建的历史日志。
- 剩余验收仅包括用户真实 API 凭据、队友正式美术、其他电脑/浏览器性能与实际游玩反馈。
- 启动器补充端口保护：实跑 start-local.cmd，在 3018 已运行时退出码 2、输出 Port 3018 is in use，跳过构建；随后原服务仍返回 v0.2.0。避免重复启动再次破坏运行中 CSS/JS。3019 临时验收服务已关闭，仅保留 D 盘 3018 游戏。

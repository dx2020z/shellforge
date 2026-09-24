# ShellForge · 造物之海

ShellForge 是一个本地可玩的 Next.js 游戏原型：玩家用自然语言描述造物，系统生成头、身体、腿三件部件设定，组装成 3D 怪物并通过回合制战斗推进远征。

## 核心玩法循环

1. 在造物工坊输入一句话，或分别描述头、身体和腿。
2. DeepSeek 生成名称、传说、部件外观与能力理由；Tripo 为三个槽位并行生成独立 3D 模型。
3. 在组装台检查模型朝向、比例和接缝，必要时调整部件方向。
4. 观察守卫意图，选择攻击、守护或机动行动；文字描述决定部件能力，玩家操作决定战斗结果。
5. 胜利后缴获蓝图；失败时传承一件自创部件，其余自创部件实例按规则移除。

## 快速开始

需要 Node.js `>=22.16`。

```powershell
npm install
Copy-Item .env.example .env.local
# 编辑 .env.local，填入本机服务端密钥和模型名
npm run dev
```

打开 <http://127.0.0.1:3018>。密钥只放在服务端 `.env.local`，不要使用 `NEXT_PUBLIC_` 前缀，也不要提交 `.env.local`。

没有密钥也能试玩：预置部件、战斗、缴获、传承和浏览器存档都可用。打开 <http://127.0.0.1:3018/?demo=1> 可进入离线演示模式；该模式使用内置规则和 GLB，不调用 DeepSeek 或 Tripo。

生产构建使用：

```powershell
npm run build
npm start
```

## 平衡性模拟

运行 `npm run sim` 会覆盖六位守卫、三类基准造物，并输出贪心与随机策略胜率。当前矩阵如下：

| 守卫 | 克制型：贪心 / 随机 | 中性型：贪心 / 随机 | 被克型：贪心 / 随机 |
|---|---:|---:|---:|
| 1 | 100.0% / 30.0% | 75.0% / 0.9% | 35.0% / 0.0% |
| 2 | 92.0% / 0.0% | 84.0% / 0.2% | 60.0% / 0.0% |
| 3 | 100.0% / 7.9% | 72.5% / 0.0% | 45.0% / 0.0% |
| 4 | 100.0% / 2.3% | 65.0% / 0.5% | 40.0% / 0.0% |
| 5 | 100.0% / 0.2% | 66.3% / 0.0% | 45.0% / 0.0% |
| 6 | 100.0% / 0.0% | 84.0% / 0.3% | 40.0% / 0.0% |

## 技术栈

Next.js 16、React 19、TypeScript、Three.js、Vitest、Node.js。服务端负责 DeepSeek/Tripo 调用、任务队列、GLB 缓存和存档边界；浏览器负责 3D 舞台、战斗操作和本地存档。

## 目录结构

```text
src/app/                 Next.js 页面和 API 路由
src/components/          游戏界面与页面编排
src/domain/              战斗、存档、部件和规则
src/features/            工坊、战斗视图和 3D 舞台
src/server/              DeepSeek、Tripo、任务和模型缓存服务
public/assets/parts/     对外提供的优化版预置 GLB
assets-src/              原始大模型文件（忽略，不上传）
.runtime/                本地生成模型和任务日志（忽略，不上传）
scripts/                 模拟、资产检查和队友打包脚本
tests/                   Node 与 React 测试
docs/                    接入、交接、策划和实施记录
```

## 常用检查

```powershell
npm test
npm run typecheck
npm run check:assets
npm run sim
```

# ShellForge v0.2 · 五人协作边界

目标：先验证一局 3–5 分钟的“拼装 → 对战 → 缴获／传承 → 再拼装”。当前已有可组合的程序化 3D 角色，不再等待美术才验证玩法。美术和 API 都替换同一套槽位外观。

## 主机 / 项目负责人（用户与 Codex）

负责 src/domain、src/server、src/assets、src/contracts、src/components/GameClient、src/app、工程配置、存档和最终集成。队友文件先在备份或独立分支核查，再替换，最后统一 npm test、npm run typecheck、npm run build 和浏览器验证。

已有接口变化：BattleStageProps 新增可选 appearances；eventIndex 表示已播放动作数，0 时显示初始生命。CreatureScene 承担统一 3D 角色加载。不要把旧 v0.1 BattleStage 覆盖回来。

## 原组三人中的美术同伴

只交 public/assets/parts/<部件 ID>/ 下的 GLB、预览和 manifest.json。先做 h01 一个头验证朝向、尺寸、接缝，再做其他部件。规格见 ART_AND_API.md。画风为锈铜、海绿、发光核心的低多边形机械生物；让三个头、三种身躯、三组腿在剪影上能分清。

验收：同一躯体换头可识别；连接不明显悬空；组装与对战都显示；无外置贴图和压缩解码依赖；坏模型不阻断战斗。交付含文件清单、面数、贴图规格和短录屏。

## 原组三人中的玩法／策划同伴

先试玩六位守卫。只交 docs/playtest-feedback.md（可自行创建），记录“组合、守卫、先后手、胜负、是否有可理解的改装选择”，每项建议写明问题和预期效果。先用当前规则比较攻击、护甲、速度、火焰、格挡、贯穿；暂不直接改 engine 和 catalog，避免数值版本分叉。

核心规则：头部决定技能；属性三件相加；速度高者先手；普通伤害 max(1, 攻击-floor(0.6×防御))；火焰 +2，前两次格挡普通伤害 -4，第 3/6/9 次贯穿忽略防御；15 回合按剩余生命比例裁定。失败蓝图不丢，唯一传承印记装备后 HP +5，不堆叠。

## 线上 A · 战斗节奏与反馈

允许修改 src/features/battle/BattleStage.tsx、BattleStage.module.css，可新增同目录展示辅助文件。保留 props 契约，用传入 events 播放，不重算伤害、不读取存档、不直接调用生成 API，不改通用 CreatureScene。

第一批任务：优化打击字幕、暂停/继续、倍速、终局节奏；考虑减少动态效果系统偏好；可添加本地且有使用权的短音效，默认静音，用户主动开启。音效文件归 public/audio/battle/。交付需演示暂停、恢复、跳过、胜败，onComplete 每场最多触发一次。

## 线上 B · 美术预览和装配工具

允许修改 src/features/viewer/PartViewer.tsx、PartViewer.module.css，可新增同目录以 PartPreview 开头的展示文件。不改 CreatureScene.tsx、procedural.ts、src/assets/schema.ts、业务存档及 API；公共加载器改动需先向主机反馈。

第一批任务：把预览做得更清楚，展示缺贴图／不支持压缩的提示；提供面数、包围盒检查的设计建议。资源来自主工程 manifest，不能引入 CDN 或让密钥进入浏览器。交付需展示正常预览、坏路径、切换部件；保持 onLoadError 回调。

## 交接包与合并

运行 npm run pack:teammates 会生成完整可运行的 delivery/online-team-v02；其中没有 node_modules、.next、.env.local、.runtime 或用户进度。队友解压后 npm install，再 npm run dev。不要只拿几个组件而缺运行环境。

每次只回传各自允许范围内的文件，并附：基于 v0.2、修改清单、启动命令、截图或录屏、已知问题。不要回传依赖目录、密钥、缓存或整份旧主工程。主机控制契约文件，两名线上队友不同时改同一可变文件。

整体验收顺序：默认组合第一战获胜并解锁头部 → 第二战验证失败和传承 → 换装再次挑战 → 刷新恢复 → 替换一个真实 GLB → 非法模型回退 → 无密钥可玩。真实 API 的验收必须在用户填写密钥后单独记录。

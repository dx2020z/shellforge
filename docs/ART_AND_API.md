# ShellForge v0.2 · 美术与生成服务接入

本文件配合 v0.2 主工程使用。主工程：D:\中转桌面\游戏开发项目。所有命令在该目录的 PowerShell 运行。

## 先玩起来

```powershell
npm install
npm run build
npm start
```

浏览器打开 http://localhost:3018。正在运行的旧服务先在其终端按 Ctrl+C，再构建和启动；不要在生产服务读 .next 时覆盖构建文件，否则 HTML 引用的 CSS/JS 可能不存在。

开发时使用 npm run dev；停止开发服务后再打正式包。无需密钥即可组装、战斗、缴获、传承、保存与恢复。不要直接双击 HTML 文件。

## 美术怎样接入

**可以替换，但不是任意模型都能无条件适配。** 当前为三个固定槽位，GLB 加载器已接入真实角色和双方战场。整个人物需拆成头、身体、成对腿三个文件。当前没有骨骼动画混合或自动绑定；战斗演出通过整组位移、转动、粒子完成。

交付目录以 h01 为例：

```text
public/assets/parts/h01/
  manifest.json
  model.glb
  preview.png
```

manifest.json：

```json
{
  "modelPath": "/assets/parts/h01/model.glb",
  "previewPath": "/assets/parts/h01/preview.png",
  "scale": 1,
  "rotation": [0, 0, 0],
  "offset": [0, 0, 0]
}
```

- 路径从 /assets 开始，文件名用小写英文和数字。JSON 不接受注释；预览图可用 PNG/WebP/SVG，建议透明背景、240×160。
- GLB 2.0，贴图内嵌，一个文件交付。第一阶段不使用外部贴图、Draco 或 Meshopt 压缩、FBX、OBJ。
- 建议单件 ≤15,000 三角面、单贴图 ≤1024×1024、文件 ≤10 MB；加载硬上限 40 MB。面数/贴图建议仍需性能实测。
- 坐标 Y 向上、角色朝 +Z。腿部是完整一对。美术枢轴会被加载器按包围盒居中处理。
- 先旋转，再按槽位高度自动归一化：头 0.95、身 1.25、腿 1.15；最后乘 scale。rotation 单位为度，offset 为归一化后的场景单位，取值范围 ±5。
- 槽位中心：头 Y=2.4、身体 Y=1.5、腿 Y=0.68。肩、手臂暂随身体交付。
- 默认 modelPath=null，使用内置低多边形造物。缺文件、配置错误、加载失败时保留内置造型，画面右下角“素材状态”显示原因。
- 新增文件后若使用 npm start，建议重启服务；修改配置后点“接入设置 → 重新加载素材”。
- 若生成外观覆盖了某个部件，先在“外观祭坛”点“恢复本地外观”，即可显示队友交付的 manifest 素材。
- 内置验收样本：public/assets/parts/samples/test-head.glb。临时将 h01 的 modelPath 指向它，重新加载，观察蓝色测试头和“h01 GLB 已载入”；验收后改回 null 或正式模型。

| ID | 部件 | 槽位 |
|---|---|---|
| h01 / h02 / h03 | 焰喙头 / 盾壳头 / 钻角头 | 头 |
| b01 / b02 / b03 | 岩甲身 / 兽骨身 / 苔藓身 | 身体 |
| l01 / l02 / l03 | 疾行足 / 重载足 / 跃击足 | 腿 |

美术同伴只需交对应目录。组装属性、奖励和存档由主工程负责。PartViewer 会读取 manifest 的预览；部件库仍使用统一的内置图标，避免整张卡因坏图失去可识别性。

## DeepSeek 和 Tripo 填在哪里

项目根目录将 .env.example 复制成 .env.local；此文件不会进入源码交付包。用编辑器填入，勿贴密钥到聊天或截图。

```dotenv
DEEPSEEK_API_KEY=你的密钥
DEEPSEEK_BASE_URL=https://api.deepseek.com
DEEPSEEK_MODEL=你账户实际支持的模型名

TRIPO_API_KEY=你的密钥
TRIPO_BASE_URL=https://openapi.tripo3d.ai/v3
TRIPO_MODEL=v3.1-20260211
TRIPO_ASSET_HOSTS=
```

模型名必须与账号支持范围一致。2026-09-23 实测 DeepSeek 官方账号使用 `deepseek-flash`；这里对接 **Tripo 官方 v3 API**。第三方转发平台或旧 v2 地址不能只改 URL 就当兼容，需要根据其文档调整 src/server/providers/tripo.ts。

1. 保存配置、重启服务，在页面右上角查看“配置已填写”。这只表示字段齐全，**不表示联通成功**。
2. 默认进入“孵化整只”，在同一界面填写头、身体、脚的描述，点击“用 DeepSeek 设计三件”。“单件调整”保留旧的逐件功能。
3. 返回源标签 DEEPSEEK 才是实际文本响应；失败或未配置会标注 LOCAL，并解释降级。LLM 只能产生名称、描述、3D 提示词；数值与技能沿用已选蓝图。
4. 点击“生成三件 3D（消耗 Tripo 额度）”才会依次提交三个模型任务。每件独立保存编号并约每 5 秒查询原任务；也可手动查询。
5. 成功后服务端保存 GLB 到 .runtime/models，三件都就绪时点击“装配整只怪物并出战”。朝向不合适可在“单件调整”里转向；更细的校准交给美术。
6. 网络超时显示“提交结果不明”时，不自动重发。先“查询原任务”，再到 Tripo 控制台核查。任务编号保存在浏览器和服务端。
7. 生成成功但 CDN 下载被拒绝时，核对官方返回的真实 CDN 域名，将该**精确域名**填入 TRIPO_ASSET_HOSTS，逗号分隔，然后重启、查询原任务。不要填写不明代理或本机/内网地址。默认允许 tripo3d.ai、tripo3d.com 及其子域。
8. 本原型生成接口只允许本机同站调用，不是多人在线服务。不要将此开发服务器当公网产品部署。

缓存任务 JSON 不含密钥；它包含生成描述、状态和供应商任务 ID。备份时同时保留浏览器存档与 .runtime/models，否则生成外观文件会找不到并回退。重开游戏不会删除已下载模型或取消供应商任务。

## 已实现与尚未验证

- 已实现：服务端 REST 调用、结构校验、明确降级、持久化任务、同编号防重发、GLB 下载和游戏加载。
- 接口测试使用官方字段结构的离线样本，不能证明真实账号、余额、区域网络和模型权限可用。
- 待真实凭据后：先跑一次完整文本→模型→装配，再单次观察 3–5 次成功率与耗时，之后再决定是否提高并发或轮询频率。
- 本轮不包含自由新增技能、完整角色自动拆件、多人匹配、商业部署、模型内容审核平台。

官方接口依据（核对日期 2026-09-22）：
- DeepSeek JSON 模式：https://api-docs.deepseek.com/guides/json_mode/
- DeepSeek Chat Completions：https://api-docs.deepseek.com/api/create-chat-completion/
- Tripo 文生模型：https://developers.tripo3d.ai/en/docs/generation-text-to-model/standard
- Tripo 任务查询：https://developers.tripo3d.ai/en/docs/task-query
- GLTFLoader：https://threejs.org/docs/pages/GLTFLoader.html

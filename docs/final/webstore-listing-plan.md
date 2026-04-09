# ChatDot 插件商店页面填写方案

## 一、 核心思路与策略 (基于官方最佳实践)
- **痛点直击**：同时解决 AI 深度用户在长对话中频繁滚动寻找上下文，以及 ChatGPT 长会话逐渐卡顿的痛点。
- **文字规范**：摘要必须控制在132字符以内；描述均采用官方推荐的“**概览段落 + 核心功能列表**”结构，绝对不堆砌无关关键词。
- **视觉规范**：图标只放Logo；截图尺寸强制使用官方要求的 1280x800 或 640x400，**无边框全出血**；宣传图强调高对比度，**严禁夸大宣传（如使用“全网第一”等词语）**。

---

## 二、 商店基础信息 (文字部分)

### 商品摘要 (Summary)
> **官方要求**：不超过132个字符的简明词组，突出最核心的受众使用场景。

- **推荐文案**：为 AI 对话页面添加右侧导航栏、消息大纲和 ChatGPT 会话精简。快速定位历史提问并缓解长对话卡顿。

### 商品描述 (Description)
> **官方要求**：概览段落 + 简要列出主要功能。说明用户为什么喜欢，避免拼写错误和重复性的无关关键词。

建议直接粘贴以下纯文本到商店后台：

随着与 ChatGPT、Gemini、Claude 和豆包（更多平台逐步接入中）等 AI 助手对话的深入，记录往往会变得很长。回头寻找某轮特定提问、重新梳理上下文时，通常只能反复滚动页面，既低效，也会打断思路。

ChatDot 面向 AI 深度用户设计，可在支持的 AI 对话网页右侧注入一个轻量、低打扰的导航侧边栏与消息大纲面板。在 ChatGPT 上，还可以启用会话精简模式，只保留最近 N 轮对话，以减轻长会话带来的页面负担。通过它，您可以像查看文档目录一样纵览整段对话，并快速定位到任意一条记录。

核心功能：
  悬浮大纲目录：自动提取页面中的用户提问，生成摘要式索引面板，点击即可直达。
  快捷逐条导航：提供「上一条 / 下一条 / 顶端 / 底端」按钮，一键穿梭整段对话；跳转后目标消息会高亮显示。
  即时上下文预览：鼠标悬停在导航按钮上，即可侧边预览目标消息内容，无需实际跳转也能先判断上下文。
  ChatGPT 会话精简：支持手动精简、恢复显示和自动精简，只保留最近 N 轮可见对话，缓解长对话滚动与输入卡顿。
  智能可见性：侧边栏默认低透明度显示，仅在页面可滚动且鼠标悬停时完整展开，尽量不遮挡页面内容。
  原生级视觉融合：支持浅色、深色和跟随系统主题，内置中文、English、日本語、한국어四种语言。
  多平台支持：当前支持 ChatGPT、Gemini、Claude 和豆包，并针对豆包反向滚动列表优化跳转定位。
  本地运行：核心逻辑全部在本地完成，不依赖云端账号体系，不上传聊天内容。

---

## 三、 视觉素材清单与规范 (图像部分)

官方对视觉资源的审核极为严格，请**严格按照以下参数交付设计资产**：

| 素材类型 | 尺寸要求 | 官方核心红线与执行规范 | ChatDot 具体执行方案 |
| :--- | :--- | :--- | :--- |
| **商店图标 (Store Icon)** | `128x128 px` | 保持纯品牌识别，**严禁放入截图或产品UI细节** | 直接沿用项目中现有的 `icons/icon128.png`，保持清爽的纯图 Logo。 |
| **屏幕截图 (Screenshots)** | `1280x800 px` 或 `640x400 px` | 1-5张，需采用方角，**严禁包含内边距（必须为全出血）**，图片文字极简，不可失真模糊。 | 建议制作四张：<br>**图1**：核心痛点展示（展示右侧大纲导航条的总体注入效果）。<br>**图2**：操作反馈特写（展示 Hover 时的消息内容预览窗口，以及元素的跳转高亮）。<br>**图3**：会话精简设置与精简后的 10 轮可见效果。<br>**图4**：恢复显示与自动精简设置（含暗模式）。 |
| **宣传图块 (Small Promo)** | `440x280 px` | 使用清晰对比与明确边界，避免素材基调与产品视觉脱节。 | 采用与产品一致的浅色薄荷基调，突出 ChatDot Logo，并明确展示“长对话精简 / 保留最近 N 轮 / 恢复显示”等核心文案。 |
| **主打图块 (Marquee Promo)** | `1400x560 px` | 设计尽量专业，图片缩小一半时仍清晰。**严禁带有“编辑精选/第一”等虚假声明**。 | 左侧文案必须包含“导航 + 大纲 + ChatGPT 会话精简”三点价值；右侧真实渲染导航栏、大纲面板和“Keep recent 10 turns”类精简状态；平台标签只保留 ChatGPT、Gemini、Claude、Doubao。 |

---

## 四、 提交流程强相关行动点 (Next Steps)

1. **隐私说明对齐**：由于插件请求了 ChatGPT / Gemini / Claude / 豆包（更多平台逐步接入中）相关 host permission 权限，在商店提交页中的【隐私】模块，**必须明确声明此权限仅用于读取当前页面的聊天 DOM 节点以生成大纲，不收集、不上传任何数据**。
2. **反馈渠道 (参与模块)**：遵循商店最佳实践中的“参与”环节要求，必须在开发者资料栏附带项目的 [Github Issues](https://github.com/Lcc1ccl/chatdot/issues) 链接，用于接收 bug 反馈。
3. **测试打包**：确保已移除之前废弃的 Cloud Sync 功能相关文件（我们在历史变更中已彻底清除），以保证代码包（`release.zip`）处于最纯净的状态应对机器审查。

---

## 五、 权限使用说明 (Privacy & Permissions Justification)

在 Chrome Web Store 开发者后台的“**隐私 (Privacy)**”选项卡中，您需要为 `manifest.json` 中声明的每一项权限提供合理性说明。建议您直接用英文填写（这有助于快速通过机器与人工审核），以下是为您定制的基础文案：

### 1. 为什么需要 `storage` 权限？ (Why do you need 'storage' permission?)
**建议直接填写的文案**：
> The `storage` permission is exclusively used to save and retrieve user preferences configured in the extension's popup menu. This includes settings such as enabling/disabling the floating navigation bar, toggling message previews, setting scroll behaviors, and saving the preferred UI language. All preference data is strictly saved locally on the user's device. No user data is transmitted to or stored on any remote servers.

### 2. 为什么需要请求主机权限？ (Why do you need host permissions?)
**建议直接填写的文案**：
> Host permissions are fundamentally required for the core functionality of this extension. We need to inject our content scripts (navigation sidebar and outline panel UI) into the supported AI chat interfaces: ChatGPT, Gemini, Claude, and Doubao, with more platforms being added over time. To generate the navigation index, the script must parse the local DOM to identify user message elements and calculate navigation targets.
> **Important Privacy Notice:** The extension only reads the DOM locally to enable navigation. It does NOT track, collect, log, or transmit any user chats or page contents to external servers. All operations are strictly executed client-side.

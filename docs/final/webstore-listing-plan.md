# ChatDot 插件商店页面填写方案

## 一、 核心思路与策略 (基于官方最佳实践)
- **痛点直击**：解决 AI 深度用户在长对话中频繁滚动寻找上下文的痛点。
- **文字规范**：摘要必须控制在132字符以内；描述均采用官方推荐的“**概览段落 + 核心功能列表**”结构，绝对不堆砌无关关键词。
- **视觉规范**：图标只放Logo；截图尺寸强制使用官方要求的 1280x800 或 640x400，**无边框全出血**；宣传图强调高对比度，**严禁夸大宣传（如使用“全网第一”等词语）**。

---

## 二、 商店基础信息 (文字部分)

### 商品摘要 (Summary)
> **官方要求**：不超过132个字符的简明词组，突出最核心的受众使用场景。

- **推荐文案**：为 ChatGPT 添加智能右侧导航侧边栏与消息大纲。支持一键快速定位、跳至任意历史提问，附带消息内容悬浮预览。

### 商品描述 (Description)
> **官方要求**：概览段落 + 简要列出主要功能。说明用户为什么喜欢，避免拼写错误和重复性的无关关键词。

**概览（Overview）**：
随着与 ChatGPT 等 AI 助手对话的深入，记录往往变得极长。回头寻找某轮特定提问或梳理上下文时，只能依赖低效的鼠标滚动，严重打断思考心流。
ChatDot 专为 AI 深度用户设计，能够在网页右侧无缝注入一个轻量级、低打扰的**导航侧边栏**与**消息大纲面板**。通过它，您可以像查阅文档目录一样纵览所有对话节点，一键精准定位至任何一条记录。

**核心功能（Key Features）**：
- **悬浮大纲目录**：自动提取整个页面的用户提问，生成摘要型索引面板，点击即可直达。
- **快捷逐条导航**：提供「上一条/下一条/顶端/底端」按键，一键穿梭对话长廊。跳转后目标消息附带专属的高亮视觉反馈。
- **即时上下文预览**：鼠标悬停在导航按键上，即可在左侧弹出目标消息内容的浮动预览，无需真实跳转也能知晓上下文。
- **智能可见性与无感打扰**：侧边栏默认以低透明度显示，仅在页面存在滚动条且鼠标悬停时完全展示，绝不遮挡页面的重要内容。
- **原生级视觉融合**：全自动感知并适配 AI 对话网站原生的亮/暗色模式，内置中文、English、日本語及한국어多语言设置。
- **安全与极简**：基于 SPA 原生感知架构开发。核心逻辑完全在本地闭环运行，无云端账号体系，绝对守护您的对话隐私。

---

## 三、 视觉素材清单与规范 (图像部分)

官方对视觉资源的审核极为严格，请**严格按照以下参数交付设计资产**：

| 素材类型 | 尺寸要求 | 官方核心红线与执行规范 | ChatDot 具体执行方案 |
| :--- | :--- | :--- | :--- |
| **商店图标 (Store Icon)** | `128x128 px` | 保持纯品牌识别，**严禁放入截图或产品UI细节** | 直接沿用项目中现有的 `icons/icon128.png`，保持清爽的纯图 Logo。 |
| **屏幕截图 (Screenshots)** | `1280x800 px` 或 `640x400 px` | 1-5张，需采用方角，**严禁包含内边距（必须为全出血）**，图片文字极简，不可失真模糊。 | 建议制作三张：<br>**图1**：核心痛点展示（展示右侧大纲导航条的总体注入效果）。<br>**图2**：操作反馈特写（展示 Hover 时的消息内容预览窗口，以及元素的跳转高亮）。<br>**图3**：设置与大纲面板展开态（含暗模式）。 |
| **宣传图块 (Small Promo)** | `440x280 px` | 使用饱和色设计，边缘界定清晰。避免大面积白色/浅灰。 | 采用高饱和的“科技蓝”为主色调，中间放置纯白色 ChatDot Logo，无需冗杂文案。 |
| **主打图块 (Marquee Promo)** | `1400x560 px` | 设计尽量专业，图片缩小一半时仍清晰。**严禁带有“编辑精选/第一”等虚假声明**。 | 采用深色背景体现极客质感，右侧放置清晰的右侧导航操作动线概念图，左侧搭配一行精简的 Slogan（如："流畅穿梭你的 AI 对话"）。 |

---

## 四、 提交流程强相关行动点 (Next Steps)

1. **隐私说明对齐**：由于插件请求了 `"https://chatgpt.com/*"` 的 host permission 权限，在商店提交页中的【隐私】模块，**必须明确声明此权限仅用于读取当前页面的聊天 DOM 节点以生成大纲，不收集、不上传任何数据**。
2. **反馈渠道 (参与模块)**：遵循商店最佳实践中的“参与”环节要求，必须在开发者资料栏附带项目的 [Github Issues](https://github.com/Lcc1ccl/chatdot/issues) 链接，用于接收 bug 反馈。
3. **测试打包**：确保已移除之前废弃的 Cloud Sync 功能相关文件（我们在历史变更中已彻底清除），以保证代码包（`release.zip`）处于最纯净的状态应对机器审查。

---

## 五、 权限使用说明 (Privacy & Permissions Justification)

在 Chrome Web Store 开发者后台的“**隐私 (Privacy)**”选项卡中，您需要为 `manifest.json` 中声明的每一项权限提供合理性说明。建议您直接用英文填写（这有助于快速通过机器与人工审核），以下是为您定制的基础文案：

### 1. 为什么需要 `storage` 权限？ (Why do you need 'storage' permission?)
**建议直接填写的文案**：
> The `storage` permission is exclusively used to save and retrieve user preferences configured in the extension's popup menu. This includes settings such as enabling/disabling the floating navigation bar, toggling message previews, setting scroll behaviors, and saving the preferred UI language. All preference data is strictly saved locally on the user's device. No user data is transmitted to or stored on any remote servers.

### 2. 为什么需要请求主机权限？ (Why do you need host permissions, e.g., `https://chatgpt.com/*`?)
**建议直接填写的文案**：
> Host permissions are fundamentally required for the core functionality of this extension. We need to inject our content scripts (navigation sidebar and outline panel UI) seamlessly into specific AI chat interfaces like `https://chatgpt.com/*`. To generate the navigation index, the script must parse the local DOM to identify user message elements and calculate scroll offsets. 
> **Important Privacy Notice:** The extension only reads the DOM locally to enable navigation. It does NOT track, collect, log, or transmit any user chats or page contents to external servers. All operations are strictly executed client-side.

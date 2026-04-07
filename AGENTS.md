# ChatDot 仓库工作约束

## 项目定位
- 这是一个原生 Chrome Extension（Manifest V3），不是 React、Vite、Node、后端服务或需要构建产物的 Web App。
- 项目目标是在 AI 对话页面（ChatGPT / Gemini / Claude / 豆包，更多平台逐步接入中）注入右侧浮动导航栏，提供顶部/底部跳转、上一条/下一条用户消息跳转、悬浮预览、大纲面板和设置联动。
- 默认开发方式是“直接将仓库目录作为已解压扩展加载到 Chrome”，除非明确要求，不要引入构建链、包管理器迁移、TypeScript 重写或框架化改造。

## 关键文件
- `manifest.json`：扩展入口与权限配置。当前为 Manifest V3，只声明 `storage` 权限，并在 chatgpt.com / chat.openai.com / gemini.google.com / claude.ai / www.doubao.com 注入 `content.js` 与 `content.css`。
- `content.js`：运行时核心。负责查找滚动容器、识别用户消息、注入导航 UI、更新计数器、显示悬浮预览、渲染大纲面板、监听 DOM 变化、处理 SPA 路由切换。
- `content.css`：侧边栏、大纲面板、悬浮预览和高亮样式。
- `popup.html`：扩展弹窗设置界面。
- `popup.js`：设置读写、i18n、`chrome.storage.local` 持久化、向 content script 广播 `settingsChanged`。
- `icons/`：扩展图标资源。
- `README.md`、`data-flow.md`、`permission-map.md`、`docs/checklists/manual-test-checklist.md`、`docs/reports/preflight-report.md`、`docs/reports/rhc-scan.md`、`docs/`：说明与发布辅助材料，不是运行时源码。
- `release.zip`：发布产物，不是源码真相，除非明确要求，不要把它当作主要修改对象。

## 已知实现边界
- 当前支持的 AI 平台：ChatGPT、Gemini、Claude 和豆包（更多平台逐步接入中）。通过 `PLATFORM_SELECTORS` + `detectPlatform()` 根据 hostname 自动选择对应平台的 DOM 选择器。
- 当前设置项为：
  - `enabled`
  - `scrollMode`
  - `showPreview`
  - `showOutline`
  - `language`
  - `themeMode`（light / dark / system）
- 涉及设置、状态同步或 UI 开关时，优先复用现有 `chrome.storage.local` 与 `settingsChanged` 消息机制。
- 涉及文案时，保持中文、English、日本語、한국어四套内容同步。
- 涉及页面选择器或滚动逻辑时，优先增强兼容性，不要无故重写整套 DOM 检测方案。

## 工作原则
- 先阅读现有实现，再做最小必要修改。
- 不重构无关代码，不为了“更现代”而引入额外工程复杂度。
- 优先使用原生 JavaScript、HTML、CSS，保持源码可直接加载。
- 保持 Manifest V3 和最小权限原则；若确需新增权限、host 匹配、外部依赖或远程资源，先明确说明必要性和影响范围。
- 不增加遥测、云同步、远程脚本、动态执行代码或其他会提升审核风险的实现。
- `popup.html` 当前已使用 Google Fonts 链接；除非明确要求，不要继续扩大外部资源依赖面。
- 若修改会影响滚动定位、消息提取、路由监听、设置同步或 Chrome Web Store 合规性，必须明确说明影响。

## 默认执行方式
1. 先用几句话说明你对需求的理解。
2. 明确将修改哪些文件，以及为什么改这些文件。
3. 优先给出最小补丁，而不是大规模重构。
4. 完成后必须汇报：
   - 改了什么
   - 为什么这样改
   - 如何验证
   - 如何回滚

## 默认验证清单
- `manifest.json` 仍然是合法 JSON。
- 扩展可被 Chrome 以“加载已解压的扩展程序”方式正常加载。
- ChatGPT 页面能注入导航栏。
- 顶部、底部、上一条、下一条跳转行为正常。
- 悬浮预览正常。
- 大纲面板的展开、关闭、定位和高亮正常。
- Popup 修改设置后，`content.js` 能即时响应。
- 切换 ChatGPT 会话后，导航能重新初始化。
- 未额外引入不必要的权限、远程执行风险或新的工程依赖。

## 禁止事项
- 不要把该仓库误判为需要 `npm install` 或构建步骤的项目，除非仓库后续真实新增了这类结构。
- 不要默认删除现有文档、发布材料或产物。
- 不要无理由改变现有 UI 风格和交互语言。
- 不要输出空泛建议代替实际修改。
- 需求不明确时，先采用最保守、最小变更假设，再继续执行。

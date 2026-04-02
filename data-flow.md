# ChatDot 数据流说明 (Data Flow)

## 概述
ChatDot 遵循极简的本地数据处理原则，**没有任何外部网络请求、遥测或远程数据发送**。一切交互和存储均在用户本机和指定的聊天页面内完成。

## 详细数据流向梳理

### 1. 本地存储数据 (Local Storage)
- **读取与来源**: `popup.js` 当用户在 popup 界面点击开关或切换滚动模式、语言时，生成配置项的键值对。
- **存储位置**: `chrome.storage.local`（浏览器本地沙盒扩展存储）。
- **发送目的地**: 仅在本地被 `content.js` 读取应用（如控制侧边栏显隐、界面文案展示），**不上传到任何服务器**。

### 2. 页面内容读取 (DOM Reading)
- **读取数据**: 
  - 通过 `document.querySelectorAll` 及其衍生方法检测页面中的对话滚动容器。
  - 读取 ChatGPT 页面中的 `[data-message-author-role="user"]` 等节点。
  - 提取用户的最近会话文本内容（用于“上一跳/下一跳”提示、以及大纲预览），截取最多 80 个字符展示。
- **处理目的地**: 仅存储于内存中的 DOM 节点变量中，用于即时渲染和重绘本扩展注入的 `NavigationSidebar` 和 `chatdot-msg-preview` 悬浮预览层。
- **发送目的地**: **无发送行为**。提取文字仅用于本地 DOM 绘制。一旦页面重置或销毁，数据从内存释放。

### 3. API 与外部通信交互
- **远程通信**: 不存在 `fetch`, `XMLHttpRequest`, `WebSocket`, `EventSource` 等调用。
- **注入通信**: `popup.js` 及其宿主会通过 `chrome.tabs.sendMessage` 向 `content.js` 单向广播设置更新（如 `settingsChanged` 事件），传递对象为当前的布尔值和配置字符参数。

## 结论
该扩展为纯前端增强工具，数据环境实现完全的 **100% 封闭/本地化**，符合最严格的隐私合规要求。

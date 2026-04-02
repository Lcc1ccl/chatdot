# ChatDot 权限映射及说明 (Permission Map)

## 当前配置的权限
在 `manifest.json` 中配置了以下权限：

```json
"permissions": ["storage"]
```

## 权限逐项说明
- **`storage`**: 
  - **用途**: 用于持久化存储用户的配置项。目前主要存储：`enabled`（是否启用导航）, `scrollMode`（滚动模式：平滑/瞬移）, `showPreview`（是否开启悬浮预览）, `showOutline`（是否显示大纲面板）, `language`（语言偏好）。
  - **调用位置**: 存在于 `popup.js` （设置写入） 及 `content.js` （读取这些配置并应用）。

## host_permissions 分析
- **当前配置**: 无
- **说明**: 扩展只针对特定的 URL（在 `content_scripts.matches` 中声明的 `https://chatgpt.com/*` 和 `https://chat.openai.com/*`）注入脚本。未使用泛域名匹配或未解释的主机权限。

## 结论
所有请求的权限均合理且有明确的业务用途。**无过宽或多余的未使用权限，符合 Chrome Web Store 要求的“最小权限原则”**。

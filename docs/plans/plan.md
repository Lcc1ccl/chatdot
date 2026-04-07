# ChatDot 开发计划 (v1.1.0 更新版)

> 最后更新：2026-04-07（完成 Popup UI、文案与目录整理）

---

## 当前版本状态

| 维度 | 状态 |
|------|------|
| 版本号 | `1.1.0`（manifest.json） |
| 平台支持 | ChatGPT / Gemini / Claude / DeepSeek / 豆包 |
| 主题模式 | Light / Dark / System 跟随 |
| 国际化 | 中文 / English / 日本語 / 한국어 |
| 商店状态 | ✅ 1.0 已上架，当前推进 `v1.1.0` 更新版 |

---

## 待办任务

### P0 — 上架必须项

- [x] **生成商店多语言文案**
  - 基于 `docs/final/webstore-listing-plan.md` 已有中文文案
  - 需输出：English / 日本語 / 한국어 版本的 Summary + Description
  - 目标文件：`docs/final/store-listing-i18n.md`

- [ ] **更新商店宣传图**
  - 当前已有：`docs/final/small_promo.jpg`（440×280）、`docs/final/marquee_promo.jpg`（1400×560）
  - 需更新内容：体现新增平台（Gemini / Claude / DeepSeek / 豆包）支持
  - 截图规格：1280×800，全出血，无边框
  - 截图建议（3张）：
    1. 核心功能总览（右侧导航栏注入效果）
    2. 悬浮预览 + 跳转高亮特写
    3. 大纲面板展开 + 暗色模式
  - 脚本：`scripts/generate_promos.py`（检查是否可复用）

- [x] **打包发布 release.zip**
  - 排除：`tests/`、`scripts/`、`docs/`、`plan.md`、`*.md`（除 README）、`.git`
  - 包含：`manifest.json`、`content.js`、`content.css`、`navigation-logic.js`、`popup.html`、`popup.js`、`icons/`
  - 验证：Chrome 加载已解压 → 各平台冒烟测试通过 → 再打包

### P1 — UI 迭代 & 质量保障

- [x] **Popup 底部：GitHub Star → 好评支持**
  - 将底部 GitHub Star 区域文案改为「好评支持」（鼓励用户前往 Chrome 商店打分）
  - 点击跳转：`https://chromewebstore.google.com/detail/<extension-id>/reviews`
  - GitHub 图标保留但移至底部**右下角**，仅显示图标（无文本），链接仍指向 GitHub 仓库
  - 涉及文件：`popup.html`（结构）、`popup.js`（i18n 文案 + 链接逻辑）、`content.css`（布局调整）
  - 国际化：中 / EN / 日 / 韩四套文案同步更新

- [x] **Popup 增加「更新日志」入口**
  - 在 Popup 顶部或标题栏区域新增一个更新日志图标（建议：📋 或 changelog 类图标）
  - 点击后以**弹窗（modal）** 形式展示最近更新内容（内容写死在 `popup.js` 中，无需网络请求）
  - 弹窗内容格式：版本号 + 日期 + 更新条目列表，最多展示最近 3 个版本
  - 初始内容：v1.1.0（新增 Gemini/Claude/DeepSeek/豆包支持 + 主题模式）
  - 涉及文件：`popup.html`（图标 + modal 结构）、`popup.js`（事件与渲染）、`popup-logic.js`（changelog 数据 + i18n）
  - 国际化：changelog 条目同步提供中 / EN 两套（日韩可复用英文）

- [ ] **执行手动冒烟测试**
  - 参照 `docs/checklists/manual-test-checklist.md`
  - 覆盖：ChatGPT、Gemini、Claude（需绕过 Cloudflare）、DeepSeek、豆包
  - 记录测试结果至 `docs/reports/smoke-test-v1.1.0.md`

- [x] **整理目录结构**
  - 已移动：`scripts/navigation-logic.test.js` → `tests/navigation-logic.test.js`
  - 已归档：计划、测试清单、预检报告、RHC 扫描统一收纳到 `docs/` 子目录

### P2 — 可选优化

- [ ] **Claude 平台兼容性**
  - 当前 claude.ai 存在 Cloudflare 拦截问题，需在真实用户环境下验证选择器是否生效
  - 补充 `PLATFORM_SELECTORS` 的降级策略

- [ ] **更新 README**
  - 加入 v1.1.0 新增平台与主题模式说明
  - 补充各平台截图（可从冒烟测试时顺带截取）

---

## 参考文件索引

| 文件 | 用途 |
|------|------|
| `AGENTS.md` | AI 工作约束与禁止事项 |
| `docs/checklists/manual-test-checklist.md` | 手动冒烟测试清单 |
| `docs/final/webstore-listing-plan.md` | 商店上架方案（文案 + 素材规范 + 权限说明） |
| `docs/final/small_promo.jpg` | 商店小横幅（440×280） |
| `docs/final/marquee_promo.jpg` | 商店主横幅（1400×560） |
| `scripts/generate_promos.py` | 宣传图生成脚本 |
| `docs/reports/preflight-report.md` | 发布前质检报告 |
| `docs/reports/rhc-scan.md` | 远程代码风险扫描报告 |
| `permission-map.md` | 权限来源与使用说明 |
| `data-flow.md` | 数据流说明 |

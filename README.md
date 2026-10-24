<div align="center">

<img src="https://cdn-icons-png.flaticon.com/512/727/727245.png" width="120" alt="云音匣 Logo">

# 🎵 云音匣 · CloudMusicFree

**一个开箱即用的网易云音乐免费播放器 · 纯前端 · 零后端 · 支持 PWA 安装**

搜索 / 解析 / 播放 / 歌词 / 歌单 / 下载 · 一个 HTML 全部搞定

[![Vue 3](https://img.shields.io/badge/Vue-3.x-42b883?style=flat-square&logo=vue.js)](https://vuejs.org/)
[![PWA](https://img.shields.io/badge/PWA-Ready-5A0FC8?style=flat-square&logo=pwa)](https://web.dev/progressive-web-apps/)
[![Cloudflare Pages](https://img.shields.io/badge/Deploy-Cloudflare%20Pages-F38020?style=flat-square&logo=cloudflare)](https://pages.cloudflare.com/)
[![License](https://img.shields.io/badge/License-MIT-yellow?style=flat-square)](LICENSE)

[🚀 在线体验](https://cloudmusicfree.pages.dev) · [📖 功能清单](#-功能特性) · [☁️ 部署指南](#%EF%B8%8F-部署方式) · [💬 反馈](/issues/new)

</div>

---

## 📖 项目简介

**云音匣** 是一个纯前端实现的网易云音乐播放器，用户无需登录、无需部署后端服务器，直接把 HTML 拖到浏览器里就能使用。所有请求都通过**第三方公开代理 API** 转发，避开官方接口的加密与跨域限制。

> 🎯 **设计初衷**：让「听歌」这件事回归简单 —— 不装 App、不注册账号、不要广告，打开网页就能听。

<table>
<tr>
<td width="50%">

### ✨ 核心亮点

- 🚀 **纯前端**：单 HTML 即可运行，零后端成本
- ☁️ **Cloudflare Pages**：全球 CDN 加速，免费 HTTPS
- 🎨 **5 套主题**：暖色 / 暗夜 / 海洋 / 梦幻 / 日落
- 📱 **PWA 安装**：像 App 一样装到桌面
- 🎧 **四级解析**：外链 → v1音质 → 老接口 → 兜底
- 🌐 **10 个 API 故障转移**：某个接口挂了自动切换

</td>
<td width="50%">

### 🎯 适用场景

- 📻 想听歌但不想装 App
- 🧑‍💻 学习前端 PWA / Vue3 实战
- 🎁 送朋友一个「私人音乐站」
- ☁️ 用 Cloudflare Pages 免费托管
- 🧪 研究第三方 API 的容错设计
- 🎨 折腾 UI 主题和字体

</td>
</tr>
</table>

---

## 🎉 功能特性

### 🎧 播放能力

| 功能 | 说明 |
|---|---|
| 🔍 关键词搜索 | 支持歌名、歌手模糊搜索，30 条结果 |
| 🆔 ID / 链接解析 | 粘贴网易云歌曲 ID 或完整 URL 自动识别 |
| 📀 歌单加载 | 粘贴歌单 ID / 链接即可加载全部歌曲 |
| 🎵 无损音质 | 支持 128k / 192k / 320k / FLAC 自动降级 |
| ⏯️ 完整播放器 | 进度条、音量、上一首/下一首、单曲/列表循环 |
| 🖼️ 全屏播放页 | 封面 + 滚动歌词 + 大进度条 |
| 🪄 迷你播放器 | 缩小为悬浮窗，边听边干别的 |

### 📝 歌词与交互

- 📃 **LRC 歌词解析**：滚动居中、当前行高亮
- ✨ **逐字高亮**：支持带时间戳的逐字歌词
- 🎤 **全屏歌词**：配合封面沉浸式听歌
- ⌨️ **键盘快捷键**：空格暂停、↑↓ 调音量、←→ 快进
- 📋 **播放队列**：拖拽排序、清空队列

### 📚 歌单与账号

- 💿 **我的歌单**：填入 Cookie 后自动读取「创建 / 收藏」的歌单
- 🔥 **热门推荐**：随机加载热歌榜、欧美榜等官方榜单
- 🔗 **自定义歌单**：支持任意公开歌单 ID / 链接
- 🎯 **全部歌曲加载**：突破 1000 首限制，分页拉取完整曲目

### 🎨 个性化

- 🎨 **5 套主题**：默认暖色 / 暗夜黑 / 海洋绿 / 梦幻紫 / 日落橙
- 🖼️ **自定义背景**：填入任意图片 URL，刷新自动应用
- 🪟 **多层透明度**：主容器、卡片、遮罩分别可调
- 🔮 **毛玻璃强度**：0–30px 自由控制模糊度
- 🔠 **字体大小**：80%–140% 全局缩放
- 🔤 **自定义字体**：上传 TTF/OTF/WOFF，IndexedDB 持久保存
- 📱 **屏幕方向**：自动 / 强制竖屏 / 强制横屏
- 🖥️ **全屏模式**：一键进入 / 退出全屏

### 🛠️ 其他能力

- ⬇️ **MP3 下载**：自动写入封面、标题、歌手 ID3 标签
- 🎬 **MV 播放**：内嵌 iframe 播放网易云 MV
- 💬 **精彩评论**：查看歌曲热门评论
- 📤 **分享截图**：一键生成带封面的分享图片
- ⏰ **睡眠定时**：15 / 30 / 60 分钟后自动暂停
- 📦 **导入 / 导出设置**：所有配置打包成 JSON 一键迁移
- 📲 **PWA 安装**：桌面 / 主屏幕安装，离线可打开

---

## ☁️ 部署方式

### ⭐ 推荐：Cloudflare Pages（全球 CDN · 免费 HTTPS · 自动部署）

Cloudflare Pages 是目前**免费方案里最稳定、速度最快**的选择，特别适合这个纯静态项目。

#### 方案 A：GitHub 集成（推荐，自动部署）

> 之后每次 `git push` 都会自动重新部署，无需手动操作。

1. **Fork 本仓库** 到你的 GitHub 账号
2. 登录 [Cloudflare Dashboard](https://dash.cloudflare.com/)
3. 左侧菜单 → **Workers & Pages** → **Create** → **Pages** → **Connect to Git**
4. 授权 GitHub，选择你的 `CloudMusicFree` 仓库
5. 配置构建参数：

   | 配置项 | 值 |
   |---|---|
   | **Project name** | `cloudmusicfree`（自定义，会影响域名） |
   | **Production branch** | `main` |
   | **Framework preset** | `None` |
   | **Build command** | *(留空)* |
   | **Build output directory** | `/` 或 `.` |
   | **Root directory** | *(留空)* |

6. 点击 **Save and Deploy**，等待 30 秒左右
7. 部署完成后会得到域名：`https://cloudmusicfree.pages.dev` 🎉

#### 方案 B：直接上传（无需 Git）

适合不想折腾 Git 的用户：

1. 本地下载或解压项目文件夹
2. 登录 [Cloudflare Dashboard](https://dash.cloudflare.com/)
3. **Workers & Pages** → **Create** → **Pages** → **Upload assets**
4. 项目名随意填，比如 `cloudmusicfree`
5. 把整个项目文件夹拖进上传框（含 `index.html`、`script.js`、`style.css`、`assets/` 等）
6. 点击 **Deploy site**
7. 完成后同样得到 `https://xxx.pages.dev` 域名

#### 方案 C：Wrangler CLI（高级）

```bash
# 1. 安装 wrangler
npm i -g wrangler

# 2. 登录 Cloudflare
wrangler login

# 3. 在项目根目录执行
wrangler pages deploy . --project-name=cloudmusicfree

# 型材优化销料管理系统

面向门窗 / 幕墙型材加工场景的切割优化与业务管理系统：按订单需求做套裁排料、管理原材料库存与采购、跟踪余料去向，并用 AI 顾问给出定尺与采购建议。

[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![React](https://img.shields.io/badge/React-19-61dafb?logo=react&logoColor=white)](https://react.dev/)
[![Node](https://img.shields.io/badge/Node-%3E%3D20-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![Express](https://img.shields.io/badge/Express-4-000000?logo=express&logoColor=white)](https://expressjs.com/)
[![Live on Render](https://img.shields.io/website?url=https%3A%2F%2Fprofile-cutting-optimizer.onrender.com&label=live)](https://profile-cutting-optimizer.onrender.com)

## 🚀 在线体验

直接打开即用（Render 免费实例，长时间无访问会休眠，首次打开需等待约半分钟唤醒）：

**https://profile-cutting-optimizer.onrender.com**

## ✨ 功能特性

- **切割优化**：FFD / CG（列生成）算法，按型号、颜色、长度做套裁排料，输出利用率、废料统计与排料方案
- **需求 / 库存 / 采购管理**：需求单、原材料库存、采购单的录入与管理
- **销料管理**：排料产生的余料建档、分配与跟踪
- **定尺方案**：固定长度组合方案管理，支持锁定（pinned）型号
- **AI 顾问**：基于当前排料数据给出定尺与采购建议（需自行配置 API Key）
- **设备授权**：基于机器码的授权验证，保障业务数据安全

## 💻 本地运行

环境要求：Node.js ≥ 20

```bash
npm install
npm run dev
```

- 前端：http://localhost:3000
- 后端 API：http://localhost:3001（前端 `/api` 请求会自动代理过去）

AI 顾问如需直连 Gemini，可在项目根目录创建 `.env.local` 并写入：

```
GEMINI_API_KEY=<your-key>
```

也可以在系统「设置」里配置 OpenAI 兼容接口（Base URL + Key + 模型名）。

生产构建与启动：

```bash
npm run build   # 生成 dist/
npm start       # 生产模式启动 server.ts，同时提供 API 与前端页面
```

服务监听 `PORT` 环境变量（未设置时默认 3001）。

> 说明：仓库中未包含 `package-lock.json`（体积超出 GitHub 文件 API 单次写入限制），
> `npm install` 会按 `package.json` 的版本范围全新解析依赖，已验证可正常构建。

## 🛠️ 技术栈

| 层 | 技术 |
|---|---|
| 前端 | React 19 + Vite 6 + TypeScript + TailwindCSS 4 + shadcn/ui + Recharts |
| 后端 | Node.js + Express（优化计算 API、设备授权 API，并托管前端静态资源） |
| 优化引擎 | glpk.js / javascript-lp-solver（后端 worker 线程中运行） |

## 📦 部署

### Render（当前线上环境）

仓库根目录附带 `render.yaml`（Web Service、Free 计划、构建/启动命令已配好），在 Render 用 Blueprint 方式导入本仓库即可。注意：Render 创建免费服务需要绑定信用卡（仅 $1 预授权验证，不扣费）。

- 构建命令：`npm install && npm run build`
- 启动命令：`npm start`
- 环境变量：`NODE_ENV=production`（`PORT` 由 Render 自动注入）

## 🔑 设备授权

首次打开页面会显示机器码，请将机器码添加到 `database/licenses.json`：

```json
{
  "DEV-XXXXXXXX": {
    "remark": "备注，如：张三的电脑",
    "expireDate": "2099-12-31"
  }
}
```

只有登记在案且未过期的设备才能通过验证进入系统。

## ❓ 常见问题

**Q: 打开线上地址很慢 / 显示服务正在唤醒？**
A: Render 免费实例在无访问 15 分钟后会休眠，下次访问需要约半分钟唤醒，属正常现象。

**Q: AI 顾问提示没有配置 Key？**
A: 在系统「设置」中配置 OpenAI 兼容接口，或在服务端 `.env.local` 中设置 `GEMINI_API_KEY`。

**Q: 构建失败怎么办？**
A: 确认 Node.js ≥ 20；删除 `node_modules` 后重新 `npm install` 再构建。

## 📁 项目结构

```
├── src/                    # 前端源码（React）
│   ├── components/         # 业务组件（需求/库存/采购/销料/排料结果/AI顾问…）
│   ├── lib/optimizer.ts    # 优化相关类型与客户端逻辑
│   └── services/aiService.ts
├── server.ts               # Express 后端（/api/* + 静态资源托管）
├── optimizer-worker.ts     # 优化计算 worker
├── database/licenses.json  # 设备授权名单
├── index.html / vite.config.ts
└── render.yaml             # Render 部署配置
```

## 📄 许可证

本项目采用 [MIT](LICENSE) 开源许可证。

# 型材优化销料管理系统

一套面向门窗 / 幕墙等型材加工场景的切割优化与业务管理系统：按订单需求做套裁排料、
管理原材料库存与采购，并跟踪销料（余料）去向，另带 AI 顾问给出定尺与采购建议。

## 功能特性

- **切割优化**：支持 FFD / CG（列生成）算法，按型号、颜色、长度做套裁排料，输出利用率、废料统计与排料方案
- **需求 / 库存 / 采购管理**：需求单、原材料库存、采购单的录入与管理
- **销料管理**：排料产生的余料建档、分配与跟踪
- **定尺方案**：固定长度组合方案管理，支持锁定（pinned）型号
- **AI 顾问**：基于当前排料数据给出定尺与采购建议（需自行配置 API Key）
- **设备授权**：基于机器码的授权验证，未授权设备无法进入系统，暂时取消了前面的授权验证界面，可以自己重新恢复

## 技术栈

- 前端：React 19 + Vite 6 + TypeScript + TailwindCSS 4 + shadcn/ui + Recharts
- 后端：Node.js + Express（提供优化计算 API、设备授权 API，并托管前端静态资源）
- 优化引擎：glpk.js / javascript-lp-solver（后端 worker 线程中运行）

## 本地运行

环境要求：Node.js ≥ 20

```bash
npm install
npm run dev
```

- 前端：http://localhost:3000
- 后端 API：http://localhost:3001（前端 `/api` 请求会自动代理过去）

AI 顾问如需直连 Gemini，可在项目根目录创建 `.env.local` 并写入：

```
GEMINI_API_KEY=你的Key
```

也可以在系统「设置」里配置 OpenAI 兼容接口（Base URL + Key + 模型名）。

## 生产构建与启动

```bash
npm run build   # 生成 dist/
npm start       # 生产模式启动 server.ts，同时提供 API 与前端页面
```

服务监听 `PORT` 环境变量（未设置时默认 3001）。

> 说明：仓库中未包含 `package-lock.json`（体积超出 GitHub 文件 API 单次写入限制），
> `npm install` 会按 `package.json` 的版本范围全新解析依赖，已验证可正常构建。

## 部署到云端

### Railway（推荐，免信用卡试用）

1. 在 Railway 新建 Project → Deploy from GitHub repo，选择本仓库
2. 构建命令：`npm install && npm run build`；启动命令：`npm start`
3. 环境变量：`NODE_ENV=production`（`PORT` 由 Railway 自动注入）
4. 在 Networking 中 Generate Domain 生成公网地址

新用户有 $5 / 30 天试用额度；试用结束后服务会停止，可按需升级或迁移。

### Render

仓库根目录已附带 `render.yaml`（Web Service、Free 计划、构建/启动命令已配好），
在 Render 用 Blueprint 方式导入本仓库即可。注意：Render 创建免费服务需要绑定信用卡
（仅 $1 预授权验证，不扣费）。

## 设备授权

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

## 项目结构

```
├── src/                    # 前端源码（React）
│   ├── components/         # 业务组件（需求/库存/采购/销料/排料结果/AI顾问…）
│   ├── lib/optimizer.ts    # 优化相关类型与客户端逻辑
│   ├── lib/optimizer.server.ts
│   └── services/aiService.ts
├── server.ts               # Express 后端（/api/* + 静态资源托管）
├── optimizer-worker.ts     # 优化计算 worker
├── database/licenses.json  # 设备授权名单
├── index.html / vite.config.ts
└── render.yaml             # Render 部署配置
```

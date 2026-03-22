# Kipdok

> Send fast. Keep local. Find it later.

[English](./README.md)

Kipdok 是一个自托管的文本与文件收件箱，适合想在自己的机器上快速接收浏览器提交内容的人使用。它强调快速投递、本地落盘、可搜索回看，以及最基础的审计留痕。

它不是云盘、同步盘，也不是团队协作文档系统。这个项目只专注一件事：让你能够把文字和文件快速发到自己控制的设备上，并且之后还能继续查找和管理。

## 功能特点

- 通过浏览器提交文本消息和文件
- 基于 SQLite 和本地文件系统的本地优先存储
- 收件箱支持搜索、筛选、下载和软删除
- 传输队列支持逐文件上传和下载进度显示
- 仪表盘支持查看存储占用、活动趋势和最近事件
- 可选使用 Tailscale 提供仅 Tailnet 或公网入口
- 内置英文和简体中文界面

## 页面截图

| 登录页 | 收件箱 |
| --- | --- |
| ![登录页](./docs/screenshots/login-page.png) | ![收件箱](./docs/screenshots/inbox-page.png) |
| 中转台 | 统计页 |
| ![中转台](./docs/screenshots/upload-page.png) | ![统计页](./docs/screenshots/dashboard-page.png) |

## 技术栈

- Next.js App Router
- React 19
- Prisma
- SQLite
- 本地磁盘文件存储

## 快速开始

### 本地开发

```bash
npm install
npm run setup
npm run dev
```

Kipdok 在仓库根目录只支持一个生效中的环境配置文件：`.env`。
不要同时保留 `.env.local`、`.env.production` 或其他 `.env*` 覆盖文件。

默认登录地址：

```text
http://127.0.0.1:3000/kipdok/login
```

### Docker

```bash
npm run setup:env
docker compose up -d --build
```

## 环境变量

项目提供了一个示例文件：[.env.example](./.env.example)

```env
DATABASE_URL="file:./data/db/app.db"
DATA_ROOT="./data"
SESSION_SECRET="replace-with-a-long-random-secret"
INITIAL_ADMIN_USERNAME="admin"
INITIAL_ADMIN_PASSWORD="replace-with-a-strong-password"
APP_NAME="Kipdok"
APP_BASE_URL="http://127.0.0.1:3000/kipdok"
MAX_UPLOAD_SIZE_MB="100"
```

### 必需配置

- `DATABASE_URL`：数据库连接串
- `DATA_ROOT`：上传文件、日志、导出文件和本地数据库文件的根目录
- `SESSION_SECRET`：会话签名密钥
- `INITIAL_ADMIN_USERNAME`：首个管理员用户名
- `INITIAL_ADMIN_PASSWORD`：首个管理员密码
- `APP_BASE_URL`：应用对外的基地址

## 数据目录结构

运行时，应用会在 `DATA_ROOT` 下写入这些目录：

- `uploads/`：按日期分组的上传文件
- `messages/`：追加写入的消息日志
- `db/`：本地 SQLite 数据库文件
- `logs/`：服务日志及相关运行输出
- `export/`：后续导出内容的目标目录

上传文件落盘时会生成新文件名，格式由时间戳、清洗后的原始文件名和一段 SHA-256 摘要组成。原始文件名仍会保存在数据库元数据中。

## 生产运行

### 构建并启动

```bash
npm install
npm run build
npm run start -- --hostname 127.0.0.1 --port 3002
```

### 一键应用配置变更

修改 `.env` 后，执行：

```bash
npm run apply
```

这个命令会删除冲突的 `.env*` 文件、把 `.env` 规范成 LF 换行、执行 Prisma、重新构建应用，并重载当前配置的 launchd 服务。
平时执行 `npm run dev`、`npm run build`、`npm run start` 时，如果仓库里又出现了额外的 `.env*` 覆盖文件，也会直接拒绝继续运行。

### 初始化数据库

```bash
npx prisma generate
npx prisma db push
```

### 常驻运行辅助脚本

- `npm run service:launchd:install`
- `npm run service:systemd:render`

## 网络接入

Kipdok 可以在有或没有 Tailscale 的情况下运行。

常见接入模式包括：

- 仅本地访问，通过反向代理暴露
- 使用 `tailscale serve` 提供 Tailnet 私有访问
- 使用 `tailscale funnel` 提供公网访问

仓库内置了一些常用的服务管理和 Tailscale 辅助脚本：

- [`scripts/setup-tailscale-access.sh`](./scripts/setup-tailscale-access.sh)
- [`scripts/install-launchd-service.sh`](./scripts/install-launchd-service.sh)
- [`scripts/render-systemd-unit.sh`](./scripts/render-systemd-unit.sh)
- [`scripts/network-profile.sh`](./scripts/network-profile.sh)

## 仓库脚本

- `npm run setup`：生成或更新本地环境变量、安装依赖并准备 Prisma
- `npm run setup:env`：只生成或更新本地环境变量
- `npm run apply`：应用当前 `.env`、重新构建并重载 launchd 服务
- `npm run mock:reset`：先备份当前 live 数据，再切换到 README 用的安全 mock 数据，并把 launchd 服务重新拉起
- `npm run dev`：启动开发服务器
- `npm run build`：构建生产版本
- `npm run start`：启动生产服务
- `npm run lint`：运行 ESLint
- `npm run docker:up`：构建并启动 Docker 栈
- `npm run docker:down`：关闭 Docker 栈

## 适合的部署环境

更适合：

- 家庭服务器
- 小型 Linux 虚拟机
- Mac mini
- 可写本地磁盘的 NAS
- 私有开发机

不太适合：

- 无状态 serverless 平台
- 没有持久化本地磁盘的环境

## 许可证

[MIT](./LICENSE)

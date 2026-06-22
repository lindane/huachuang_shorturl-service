# 短链接服务 - 代码理解文档

## 1. 项目概述

这是一个基于 Node.js + Express 的轻量级短链接服务，支持将长链接转换为短链接、自定义短码、统计查询以及 302 重定向功能，数据存储在本地 SQLite 数据库中。

**技术栈：**

- **运行时**：Node.js
- **Web 框架**：Express v5.2.1
- **数据库**：SQLite（通过 better-sqlite3 v12.11.1 驱动）
- **加密模块**：Node.js 内置 crypto（用于随机短码生成）

---

## 2. 文件结构说明

### 2.1 `server.js` — Express 应用入口

| 职责 | 关键模块/路由 |
|------|--------------|
| 启动 Express 服务器、加载中间件 | `express.json()` JSON 解析中间件 |
| 定义 HTTP 路由 | `POST /api/shorten`、`GET /api/stats`、`GET /:code` |
| 统一错误处理 | 四参数错误处理中间件 |
| 启动时自动建表 | `db.createTable()` |

### 2.2 `db.js` — 数据库操作模块

| 函数 | 签名 | 说明 |
|------|------|------|
| `insertUrl(code, originalUrl)` | 新增 | 插入短码与原始链接的映射，返回自增 ID |
| `findUrlByCode(code)` | 查询 | 根据短码查询完整记录，找不到返回 undefined |
| `findUrlByOriginalUrl(originalUrl)` | 查询 | 根据原始链接查询记录，用于去重 |
| `createTable()` | DDL | 创建 `urls` 表（IF NOT EXISTS，幂等） |
| `countUrls()` | 统计 | 返回短链接总条数 |
| `getRecentUrls(limit)` | 查询 | 按创建时间倒序返回最近 limit 条记录（仅含 code 和 original_url） |

### 2.3 `utils.js` — 工具函数模块

| 导出项 | 类型 | 说明 |
|--------|------|------|
| `CHARS` | 常量 | 短码字符集：大写字母 + 小写字母 + 数字，共 62 个字符 |
| `generateShortCode()` | 函数 | 生成 6 位随机短码 |
| `isValidUrl(url)` | 函数 | 校验 URL 是否以 `http://` 或 `https://` 开头 |
| `isValidCustomCode(code)` | 函数 | 校验自定义短码是否为 4-20 位字母和数字 |

### 2.4 `init.js` — 数据库初始化脚本

独立可运行的初始化脚本，调用 `db.createTable()` 创建数据库表，适合部署时手动执行（`server.js` 启动时也会自动调用，所以此脚本非必须）。

### 2.5 `package.json` — 项目配置

- 依赖：`express@^5.2.1`、`better-sqlite3@^12.11.1`
- 主入口为 `index.js`（实际使用 `server.js` 作为启动入口）

---

## 3. 接口文档

### 3.1 POST /api/shorten — 生成短链接

**请求：**

```
POST /api/shorten
Content-Type: application/json

{
  "url": "https://www.example.com",
  "custom_code": "mycode"    // 可选，不传则随机生成
}
```

| 参数 | 必填 | 说明 |
|------|------|------|
| `url` | 是 | 原始长链接，必须以 `http://` 或 `https://` 开头 |
| `custom_code` | 否 | 自定义短码，4-20 位字母和数字 |

**成功响应 (200)：**

```json
{
  "short_url": "http://localhost:3000/mycode"
}
```

**错误响应：**

| 状态码 | 返回格式 | 场景 |
|--------|----------|------|
| 400 | `{ error: "URL is required" }` | 未传 url 参数 |
| 400 | `{ error: "Invalid URL format. URL must start with http:// or https://" }` | URL 格式不合法 |
| 400 | `{ error: "Invalid custom code. Must be 4-20 characters, letters and numbers only" }` | 自定义短码格式不合法 |
| 409 | `{ error: "Custom code already in use" }` | 自定义短码已被占用 |
| 500 | `{ error: "Failed to generate unique short code" }` | 10 次重试未生成唯一随机短码 |
| 500 | `{ error: "Internal server error" }` | 数据库或其他服务端异常 |

---

### 3.2 GET /api/stats — 查询统计信息

**请求：**

```
GET /api/stats
```

**成功响应 (200)：**

```json
{
  "total": 42,
  "recent": [
    { "code": "abc123", "original_url": "https://example.com" },
    { "code": "xyz789", "original_url": "https://google.com" }
  ]
}
```

| 字段 | 类型 | 说明 |
|------|------|------|
| `total` | number | 数据库中短链接总条数 |
| `recent` | array | 最近创建的 5 条记录，按创建时间倒序 |

**错误响应：**

| 状态码 | 返回格式 | 场景 |
|--------|----------|------|
| 500 | `{ error: "Internal server error" }` | 数据库或其他服务端异常 |

---

### 3.3 GET /:code — 短码重定向

**请求：**

```
GET /abc123
```

**成功响应 (302)：**

响应头 `Location: https://www.example.com`，浏览器自动跳转。

**错误响应：**

| 状态码 | 返回格式 | 场景 |
|--------|----------|------|
| 404 | 纯文本 `404 Not Found` | 短码不存在 |
| 500 | `{ error: "Internal server error" }` | 数据库或其他服务端异常 |

---

## 4. 数据流图（POST /api/shorten）

以下为客户端发起 `POST /api/shorten` 请求到最终返回短链接的完整数据流向：

```
客户端
  │
  ▼
① Express JSON 中间件 (express.json())
  │  解析 request body 为 { url, custom_code }
  ▼
② URL 必填校验
  │  无 url → 返回 400 { error: "URL is required" }
  ▼
③ URL 格式校验 (isValidUrl)
  │  非 http/https 开头 → 返回 400 { error: "Invalid URL format..." }
  ▼
④ 自定义短码分支判断
  │
  ├─ 传了 custom_code ─┐
  │                     ▼
  │              ④a 自定义短码格式校验 (isValidCustomCode)
  │                     │  非法 → 返回 400
  │                     ▼
  │              ④b 短码唯一性查询 (db.findUrlByCode)
  │                     │  已存在 → 返回 409
  │                     ▼
  │              ④c 写入数据库 (db.insertUrl)
  │                     │
  │                     ▼
  │                返回 200 { short_url }
  │
  └─ 未传 custom_code ─┐
                        ▼
                 ④d 原始链接去重查询 (db.findUrlByOriginalUrl)
                        │  已存在 → 直接返回已有的 short_url
                        ▼
                 ④e 循环生成随机短码 (generateShortCode)
                        │  最多重试 10 次
                        │  每次用 db.findUrlByCode 检查唯一性
                        │  10 次都冲突 → 返回 500
                        ▼
                 ④f 写入数据库 (db.insertUrl)
                        │
                        ▼
                   返回 200 { short_url }
```

---

## 5. 数据库表结构

### `urls` 表

| 字段名 | 类型 | 约束 | 说明 |
|--------|------|------|------|
| `id` | INTEGER | PRIMARY KEY AUTOINCREMENT | 自增主键 |
| `code` | TEXT | NOT NULL UNIQUE | 短码，唯一索引 |
| `original_url` | TEXT | NOT NULL | 原始长链接 |
| `created_at` | DATETIME | DEFAULT CURRENT_TIMESTAMP | 创建时间，默认为当前时间 |

建表 SQL（位于 `db.js` 的 `createTable` 函数）：

```sql
CREATE TABLE IF NOT EXISTS urls (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL UNIQUE,
  original_url TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
)
```

数据库文件路径：项目根目录下的 `shorturl.db`。

---

## 6. 关键逻辑说明

### 6.1 短码生成算法 (generateShortCode)

**源码位置**：`utils.js` 第 5-12 行

**工作原理：**

1. 使用 Node.js 内置 `crypto.randomBytes(6)` 生成 6 字节（48 位）的加密安全随机字节
2. 字符集 `CHARS` 包含 62 个字符（26 大写 + 26 小写 + 10 数字）
3. 对每个随机字节取模 `% 62`，映射到 `CHARS` 中的一个字符
4. 循环 6 次，拼接成 6 位短码返回

**特点：**
- 使用加密安全的随机源（非伪随机），碰撞概率低
- 6 位短码的组合空间为 `62^6 ≈ 568 亿`，足够日常使用
- 即使发生碰撞，上层逻辑会重试最多 10 次

---

### 6.2 自定义短码校验规则

**源码位置**：`utils.js` 第 18-20 行，`server.js` 第 22-33 行

**正则表达式**：`/^[a-zA-Z0-9]{4,20}$/`

| 规则 | 说明 |
|------|------|
| 长度 | 4 到 20 个字符（含边界） |
| 字符集 | 仅允许大小写字母和数字，不允许特殊字符（`-`、`_`、空格等均非法） |
| 唯一性 | 若短码已在数据库中存在，返回 409 Conflict |

校验顺序：先校验格式，再校验唯一性。

---

### 6.3 统一错误处理中间件

**源码位置**：`server.js` 第 91-94 行

```javascript
app.use((err, req, res, next) => {
  console.error(err.message);
  res.status(500).json({ error: 'Internal server error' });
});
```

**作用：**

1. 采用 Express 四参数格式 `(err, req, res, next)`，是 Express 识别错误处理中间件的标准签名
2. 所有路由处理器内部用 `try-catch` 包裹，捕获到异常后通过 `next(err)` 传递到此中间件
3. 统一将服务端异常（如数据库错误）转换为：
   - 控制台：打印错误消息（`console.error`），便于排查
   - HTTP 响应：状态码 500 + 统一 JSON 格式 `{ error: "Internal server error" }`
4. 防止异常堆栈信息泄露到客户端，同时保证错误响应格式的一致性

**触发流程：**

```
路由处理器 try-catch 捕获异常
  │
  ▼
调用 next(err)
  │
  ▼
Express 将 err 传递给错误处理中间件
  │
  ▼
console.error(err.message)  +  返回 500 { error: "Internal server error" }
```

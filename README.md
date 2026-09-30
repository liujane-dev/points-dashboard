# points-dashboard

孩子积分管理系统，一个简洁的单页 Dashboard，用于记录加分、扣分和奖励兑换。

记录保存在本地轻量数据库 `data/points.sqlite`。删除记录采用软删除：写入 `deletedAt`，不从数据库移除，统计时自动忽略。

## 本地开发

```bash
npm install
npm run dev
```

`npm run dev` 会同时启动：

- 前端 Vite 开发服务器
- 本地 SQLite API，用于读写 `data/points.sqlite`

如果需要在多台机器间同步数据，可以提交 SQLite 数据库文件：

```bash
git add data/points.sqlite
git commit -m "Update points records"
git push
```

## 当前范围

- React + TypeScript + Vite 项目骨架
- Tailwind CSS 基础样式
- SQLite 本地持久化：`data/points.sqlite`
- 总览、体能积分、游戏扣分、奖励兑换、规则设置
- 新增加分/扣分记录
- 新增奖励兑换记录
- 标记删除记录，并保留删除记录查询

## 存储方案

当前已从单文件 JSON 迁移到 `data/points.sqlite`：

- 写入更快：新增或删除只更新相关行，不再重写整份 JSON。
- 查询更强：后续可以按日期、分类、删除状态加索引和分页。
- 数据更安全：SQLite 支持事务，减少写入中断导致文件损坏的风险。

首次启动 API 时，如果发现旧的 `data/points.json` 且数据库为空，会自动导入旧数据。当前仓库已删除 `data/points.json`，后续以 `data/points.sqlite` 为准。

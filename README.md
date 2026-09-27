# points-dashboard

孩子积分管理系统，一个简洁的单页 Dashboard，用于记录加分、扣分和奖励兑换。

记录保存在仓库内的 `data/points.json`，因此提交到 Git 后，在其他机器 clone/pull 也能看到同一份记录。删除记录采用软删除：写入 `deletedAt`，不从文件移除，统计时自动忽略。

## 本地开发

```bash
npm install
npm run dev
```

`npm run dev` 会同时启动：

- 前端 Vite 开发服务器
- 本地文件 API，用于读写 `data/points.json`

新增或删除记录后，请执行：

```bash
git add data/points.json
git commit -m "Update points records"
git push
```

## 当前范围

- React + TypeScript + Vite 项目骨架
- Tailwind CSS 基础样式
- 仓库文件持久化：`data/points.json`
- 总览、体能积分、游戏扣分、奖励兑换、规则设置
- 新增加分/扣分记录
- 新增奖励兑换记录
- 标记删除记录，并保留删除记录查询

## 存储方案建议

当前使用 `data/points.json` 是最简单、最适合个人/家庭小工具的方案：可读、可手动编辑、Git diff 清楚、clone 后即可恢复数据。

如果后续记录变多，可以升级为：

- `data/records/*.json`：每条记录一个文件，Git 冲突更少，适合多台机器频繁更新。
- `data/points.sqlite`：查询更强，但 Git diff 不友好，更适合单机长期大量记录。
- 云端数据库：多设备实时同步最好，但需要登录、部署和权限管理。

下一步推荐先保留 `data/points.json`，等记录达到几百条或经常出现 Git 冲突时，再迁移到 `data/records/*.json`。

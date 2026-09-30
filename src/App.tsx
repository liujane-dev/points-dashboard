import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'

type RecordKind = 'earn' | 'deduct'
type Category = 'fitness' | 'gaming' | 'habit' | 'other'

type PointRecord = {
  id: string
  kind: RecordKind
  category: Category
  title: string
  points: number
  note: string
  createdAt: string
  deletedAt?: string | null
}

type Reward = {
  id: string
  name: string
  cost: number
  note: string
  createdAt: string
  deletedAt?: string | null
}

type Rule = {
  id: string
  kind: RecordKind
  category: Category
  title: string
  points: number
  enabled: boolean
}

type PointsData = {
  version: number
  debug?: {
    enabled: boolean
  }
  records: PointRecord[]
  rewards: Reward[]
  rules: Rule[]
}

type RecordFormState = {
  kind: RecordKind
  category: Category
  title: string
  points: string
  note: string
}

type RewardFormState = {
  name: string
  cost: string
  note: string
}

const initialData: PointsData = {
  version: 1,
  records: [],
  rewards: [],
  rules: [],
}

const initialRecordForm: RecordFormState = {
  kind: 'earn',
  category: 'fitness',
  title: '',
  points: '5',
  note: '',
}

const initialRewardForm: RewardFormState = {
  name: '',
  cost: '10',
  note: '',
}

const categoryLabels: Record<Category, string> = {
  fitness: '体能',
  gaming: '游戏',
  habit: '习惯',
  other: '其他',
}

const pageLinks = [
  { id: 'dashboard', label: '总览', emoji: '📊' },
  { id: 'fitness', label: '体能积分', emoji: '🏃' },
  { id: 'habit', label: '习惯积分', emoji: '🌱' },
  { id: 'gaming', label: '游戏扣分', emoji: '🎮' },
  { id: 'rewards', label: '奖励兑换', emoji: '🎁' },
  { id: 'rules', label: '规则设置', emoji: '⚙️' },
]

function isThisWeek(createdAt: string) {
  const date = new Date(createdAt)
  const now = new Date()
  const start = new Date(now)
  const day = start.getDay() || 7
  start.setHours(0, 0, 0, 0)
  start.setDate(start.getDate() - day + 1)
  return date >= start
}

function formatDateTime(createdAt: string) {
  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(createdAt))
}

function isActive(item: { deletedAt?: string | null }) {
  return !item.deletedAt
}

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  })

  if (!response.ok) {
    throw new Error(`请求失败：${response.status}`)
  }

  return response.json() as Promise<T>
}

function App() {
  const [data, setData] = useState<PointsData>(initialData)
  const [recordForm, setRecordForm] = useState<RecordFormState>(initialRecordForm)
  const [rewardForm, setRewardForm] = useState<RewardFormState>(initialRewardForm)
  const [status, setStatus] = useState('正在读取本地数据库...')

  async function refreshData() {
    const nextData = await requestJson<PointsData>('/api/points')
    setData(nextData)
  }

  useEffect(() => {
    refreshData()
      .then(() => setStatus('数据来自 data/points.sqlite'))
      .catch((error: unknown) => {
        setStatus(error instanceof Error ? error.message : '读取数据失败')
      })
  }, [])

  const stats = useMemo(() => {
    const activeRecords = data.records.filter(isActive)
    const activeRewards = data.rewards.filter(isActive)
    const totalEarned = activeRecords
      .filter((record) => record.kind === 'earn')
      .reduce((sum, record) => sum + record.points, 0)
    const totalDeducted = activeRecords
      .filter((record) => record.kind === 'deduct')
      .reduce((sum, record) => sum + record.points, 0)
    const totalRewardCost = activeRewards.reduce((sum, reward) => sum + reward.cost, 0)
    const weeklyRecordNet = activeRecords.filter((record) => isThisWeek(record.createdAt)).reduce((sum, record) => {
      return record.kind === 'earn' ? sum + record.points : sum - record.points
    }, 0)
    const weeklyRewardCost = activeRewards
      .filter((reward) => isThisWeek(reward.createdAt))
      .reduce((sum, reward) => sum + reward.cost, 0)

    return {
      balance: totalEarned - totalDeducted - totalRewardCost,
      totalEarned,
      totalDeducted,
      totalRewardCost,
      weeklyNet: weeklyRecordNet - weeklyRewardCost,
      todayCount: [...activeRecords, ...activeRewards].filter((item) => {
        return new Date(item.createdAt).toDateString() === new Date().toDateString()
      }).length,
      deletedCount: data.records.filter((record) => !isActive(record)).length + data.rewards.filter((reward) => !isActive(reward)).length,
    }
  }, [data])

  const recentItems = useMemo(() => {
    return [
      ...data.records.filter(isActive).map((record) => ({
        id: record.id,
        type: 'record' as const,
        title: record.title,
        detail: `${categoryLabels[record.category]} · ${record.kind === 'earn' ? '加分' : '扣分'}`,
        points: record.kind === 'earn' ? record.points : -record.points,
        note: record.note,
        createdAt: record.createdAt,
        deletedAt: record.deletedAt,
      })),
      ...data.rewards.filter(isActive).map((reward) => ({
        id: reward.id,
        type: 'reward' as const,
        title: reward.name,
        detail: '奖励兑换',
        points: -reward.cost,
        note: reward.note,
        createdAt: reward.createdAt,
        deletedAt: reward.deletedAt,
      })),
    ].sort((first, second) => new Date(second.createdAt).getTime() - new Date(first.createdAt).getTime())
  }, [data])

  const deletedItems = useMemo(() => {
    return [
      ...data.records.filter((record) => !isActive(record)).map((record) => ({
        id: record.id,
        type: 'record' as const,
        title: record.title,
        detail: `${categoryLabels[record.category]} · ${record.kind === 'earn' ? '加分' : '扣分'}`,
        points: record.kind === 'earn' ? record.points : -record.points,
        deletedAt: record.deletedAt,
      })),
      ...data.rewards.filter((reward) => !isActive(reward)).map((reward) => ({
        id: reward.id,
        type: 'reward' as const,
        title: reward.name,
        detail: '奖励兑换',
        points: -reward.cost,
        deletedAt: reward.deletedAt,
      })),
    ].sort((first, second) => new Date(second.deletedAt ?? '').getTime() - new Date(first.deletedAt ?? '').getTime())
  }, [data])

  async function addRecord(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setStatus('正在写入 data/points.sqlite...')
    await requestJson<PointRecord>('/api/records', {
      method: 'POST',
      body: JSON.stringify(recordForm),
    })
    setRecordForm({ ...initialRecordForm, kind: recordForm.kind, category: recordForm.category })
    await refreshData()
    setStatus('记录已保存到 data/points.sqlite')
  }

  async function addReward(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setStatus('正在写入 data/points.sqlite...')
    await requestJson<Reward>('/api/rewards', {
      method: 'POST',
      body: JSON.stringify(rewardForm),
    })
    setRewardForm(initialRewardForm)
    await refreshData()
    setStatus('奖励已保存到 data/points.sqlite')
  }

  async function deleteItem(type: 'record' | 'reward', id: string) {
    setStatus('正在标记删除并更新 data/points.sqlite...')
    await requestJson<{ ok: boolean }>(`/api/${type === 'record' ? 'records' : 'rewards'}/${id}`, {
      method: 'DELETE',
    })
    await refreshData()
    setStatus('已标记为 deleted，统计不会再计入')
  }

  async function hardDeleteItem(type: 'record' | 'reward', id: string) {
    const confirmed = window.confirm('确定要从 points.sqlite 永久删除这条已删除记录吗？此操作不可恢复。')
    if (!confirmed) {
      return
    }

    setStatus('正在从 data/points.sqlite 永久删除...')
    await requestJson<{ ok: boolean }>(`/api/${type === 'record' ? 'records' : 'rewards'}/${id}?hard=1`, {
      method: 'DELETE',
    })
    await refreshData()
    setStatus('已从 data/points.sqlite 永久删除')
  }

  return (
    <main className="min-h-screen bg-[#f7f5ef] px-4 py-6 text-slate-900 sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-6xl flex-col gap-6">
        <header id="dashboard" className="rounded-[2rem] bg-white/90 p-6 shadow-sm ring-1 ring-black/5 sm:p-8">
          <p className="text-sm font-semibold text-amber-600">Points Dashboard</p>
          <div className="mt-3 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-tight sm:text-5xl">孩子积分管理系统</h1>
              <p className="mt-3 max-w-2xl text-base leading-7 text-slate-600">
                记录加分、扣分和奖励兑换。所有记录会写入本地 SQLite 数据库，数据量变大后仍能保持轻快。
              </p>
            </div>
            <p className="rounded-full bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-700">{status}</p>
          </div>
        </header>

        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
          <SummaryCard label="当前积分" value={stats.balance} tone="bg-emerald-50 text-emerald-700" />
          <SummaryCard label="累计加分" value={`+${stats.totalEarned}`} tone="bg-sky-50 text-sky-700" />
          <SummaryCard label="累计扣分" value={`-${stats.totalDeducted}`} tone="bg-rose-50 text-rose-700" />
          <SummaryCard label="奖励消耗" value={`-${stats.totalRewardCost}`} tone="bg-violet-50 text-violet-700" />
          <SummaryCard label="本周净积分" value={stats.weeklyNet} tone="bg-amber-50 text-amber-700" />
          <SummaryCard label="已删除记录" value={stats.deletedCount} tone="bg-slate-100 text-slate-600" />
        </section>

        <section className="grid gap-6 lg:grid-cols-[240px_1fr]">
          <nav className="h-fit rounded-3xl bg-white p-3 shadow-sm ring-1 ring-black/5 lg:sticky lg:top-6">
            {pageLinks.map((page) => (
              <a
                key={page.id}
                href={`#${page.id}`}
                className="flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-amber-50 hover:text-amber-700"
              >
                <span className="text-xl">{page.emoji}</span>
                {page.label}
              </a>
            ))}
          </nav>

          <div className="grid gap-6">
            <section className="grid gap-6 xl:grid-cols-2">
              <RecordForm form={recordForm} setForm={setRecordForm} onSubmit={addRecord} />
              <RewardForm form={rewardForm} setForm={setRewardForm} onSubmit={addReward} />
            </section>

            <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-black/5">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h2 className="text-xl font-bold">最近记录</h2>
                  <p className="mt-1 text-sm text-slate-500">今天 {stats.todayCount} 条记录</p>
                </div>
              </div>
              <div className="mt-5 grid gap-3">
                {recentItems.length === 0 ? (
                  <p className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-500">还没有记录，先添加一条吧。</p>
                ) : (
                  recentItems.map((item) => (
                    <article key={`${item.type}-${item.id}`} className="flex flex-col gap-3 rounded-2xl border border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="font-semibold">{item.title}</p>
                        <p className="mt-1 text-sm text-slate-500">
                          {item.detail} · {formatDateTime(item.createdAt)}{item.note ? ` · ${item.note}` : ''}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className={`rounded-full px-3 py-1 text-sm font-bold ${item.points >= 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
                          {item.points >= 0 ? '+' : ''}{item.points}
                        </span>
                        <button
                          type="button"
                          onClick={() => void deleteItem(item.type, item.id)}
                          className="rounded-full bg-slate-100 px-3 py-1 text-sm font-semibold text-slate-600 transition hover:bg-slate-200"
                        >
                          标记删除
                        </button>
                      </div>
                    </article>
                  ))
                )}
              </div>
            </section>

            <CategorySection id="fitness" title="体能积分" emoji="🏃" records={data.records.filter((record) => isActive(record) && record.category === 'fitness')} />
            <CategorySection id="habit" title="习惯积分" emoji="🌱" records={data.records.filter((record) => isActive(record) && record.category === 'habit')} />
            <CategorySection id="gaming" title="游戏扣分" emoji="🎮" records={data.records.filter((record) => isActive(record) && record.category === 'gaming')} />
            <RewardsSection rewards={data.rewards.filter(isActive)} />
            <DeletedSection items={deletedItems} debugMode={data.debug?.enabled ?? false} onHardDelete={hardDeleteItem} />
            <RulesSection rules={data.rules} />
          </div>
        </section>
      </div>
    </main>
  )
}

function SummaryCard({ label, value, tone }: { label: string; value: number | string; tone: string }) {
  return (
    <article className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-black/5">
      <p className="text-sm text-slate-500">{label}</p>
      <p className={`mt-3 inline-flex rounded-2xl px-4 py-2 text-3xl font-bold ${tone}`}>{value}</p>
    </article>
  )
}

function RecordForm({
  form,
  setForm,
  onSubmit,
}: {
  form: RecordFormState
  setForm: (form: RecordFormState) => void
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
}) {
  return (
    <form onSubmit={onSubmit} className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-black/5">
      <h2 className="text-xl font-bold">新增加分 / 扣分</h2>
      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <label className="grid gap-2 text-sm font-semibold text-slate-600">
          类型
          <select value={form.kind} onChange={(event) => setForm({ ...form, kind: event.target.value as RecordKind })} className="rounded-2xl border border-slate-200 px-4 py-3">
            <option value="earn">加分</option>
            <option value="deduct">扣分</option>
          </select>
        </label>
        <label className="grid gap-2 text-sm font-semibold text-slate-600">
          分类
          <select value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value as Category })} className="rounded-2xl border border-slate-200 px-4 py-3">
            <option value="fitness">体能</option>
            <option value="gaming">游戏</option>
            <option value="habit">习惯</option>
            <option value="other">其他</option>
          </select>
        </label>
        <label className="grid gap-2 text-sm font-semibold text-slate-600 sm:col-span-2">
          事项
          <input required value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="例如：跳绳 10 分钟" className="rounded-2xl border border-slate-200 px-4 py-3" />
        </label>
        <label className="grid gap-2 text-sm font-semibold text-slate-600">
          分值
          <input required min="1" type="number" value={form.points} onChange={(event) => setForm({ ...form, points: event.target.value })} className="rounded-2xl border border-slate-200 px-4 py-3" />
        </label>
        <label className="grid gap-2 text-sm font-semibold text-slate-600">
          备注
          <input value={form.note} onChange={(event) => setForm({ ...form, note: event.target.value })} placeholder="可选" className="rounded-2xl border border-slate-200 px-4 py-3" />
        </label>
      </div>
      <button className="mt-5 w-full rounded-2xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-700">
        保存到本地数据库
      </button>
    </form>
  )
}

function RewardForm({
  form,
  setForm,
  onSubmit,
}: {
  form: RewardFormState
  setForm: (form: RewardFormState) => void
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
}) {
  return (
    <form id="rewards" onSubmit={onSubmit} className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-black/5">
      <h2 className="text-xl font-bold">新增奖励兑换</h2>
      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <label className="grid gap-2 text-sm font-semibold text-slate-600 sm:col-span-2">
          奖励
          <input required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="例如：兑换 20 分钟游戏时间" className="rounded-2xl border border-slate-200 px-4 py-3" />
        </label>
        <label className="grid gap-2 text-sm font-semibold text-slate-600">
          消耗积分
          <input required min="1" type="number" value={form.cost} onChange={(event) => setForm({ ...form, cost: event.target.value })} className="rounded-2xl border border-slate-200 px-4 py-3" />
        </label>
        <label className="grid gap-2 text-sm font-semibold text-slate-600">
          备注
          <input value={form.note} onChange={(event) => setForm({ ...form, note: event.target.value })} placeholder="可选" className="rounded-2xl border border-slate-200 px-4 py-3" />
        </label>
      </div>
      <button className="mt-5 w-full rounded-2xl bg-amber-500 px-5 py-3 text-sm font-semibold text-white transition hover:bg-amber-600">
        保存奖励兑换
      </button>
    </form>
  )
}

function CategorySection({ id, title, emoji, records }: { id: string; title: string; emoji: string; records: PointRecord[] }) {
  return (
    <section id={id} className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-black/5">
      <h2 className="text-xl font-bold">{emoji} {title}</h2>
      <div className="mt-4 grid gap-3">
        {records.length === 0 ? (
          <p className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-500">暂无记录。</p>
        ) : (
          records.map((record) => (
            <div key={record.id} className="flex items-center justify-between rounded-2xl bg-slate-50 p-4">
              <div>
                <p className="font-semibold">{record.title}</p>
                <p className="text-sm text-slate-500">{formatDateTime(record.createdAt)}</p>
              </div>
              <span className={record.kind === 'earn' ? 'font-bold text-emerald-700' : 'font-bold text-rose-700'}>
                {record.kind === 'earn' ? '+' : '-'}{record.points}
              </span>
            </div>
          ))
        )}
      </div>
    </section>
  )
}

function RewardsSection({ rewards }: { rewards: Reward[] }) {
  return (
    <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-black/5">
      <h2 className="text-xl font-bold">🎁 奖励兑换</h2>
      <div className="mt-4 grid gap-3">
        {rewards.length === 0 ? (
          <p className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-500">暂无奖励兑换。</p>
        ) : (
          rewards.map((reward) => (
            <div key={reward.id} className="flex items-center justify-between rounded-2xl bg-slate-50 p-4">
              <div>
                <p className="font-semibold">{reward.name}</p>
                <p className="text-sm text-slate-500">{formatDateTime(reward.createdAt)}</p>
              </div>
              <span className="font-bold text-violet-700">-{reward.cost}</span>
            </div>
          ))
        )}
      </div>
    </section>
  )
}

function DeletedSection({
  items,
  debugMode,
  onHardDelete,
}: {
  items: Array<{
    id: string
    type: 'record' | 'reward'
    title: string
    detail: string
    points: number
    deletedAt?: string | null
  }>
  debugMode: boolean
  onHardDelete: (type: 'record' | 'reward', id: string) => void
}) {
  return (
    <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-black/5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold">🗂️ 已删除记录</h2>
          <p className="mt-1 text-sm text-slate-500">这些记录保留在 data/points.sqlite 中，但不会参与任何积分统计。</p>
        </div>
        {debugMode ? (
          <span className="w-fit rounded-full bg-rose-50 px-3 py-1 text-xs font-bold text-rose-700">Debug: 可永久删除</span>
        ) : null}
      </div>
      <div className="mt-4 grid gap-3">
        {items.length === 0 ? (
          <p className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-500">暂无已删除记录。</p>
        ) : (
          items.map((item) => (
            <div key={`${item.type}-${item.id}`} className="flex flex-col gap-3 rounded-2xl bg-slate-50 p-4 opacity-75 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-semibold line-through decoration-slate-400">{item.title}</p>
                <p className="text-sm text-slate-500">
                  {item.detail} · 删除于 {item.deletedAt ? formatDateTime(item.deletedAt) : '未知时间'}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className="font-bold text-slate-500">{item.points >= 0 ? '+' : ''}{item.points}</span>
                {debugMode ? (
                  <button
                    type="button"
                    onClick={() => onHardDelete(item.type, item.id)}
                    className="rounded-full bg-rose-100 px-3 py-1 text-sm font-semibold text-rose-700 transition hover:bg-rose-200"
                  >
                    永久删除
                  </button>
                ) : null}
              </div>
            </div>
          ))
        )}
      </div>
    </section>
  )
}

function RulesSection({ rules }: { rules: Rule[] }) {
  return (
    <section id="rules" className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-black/5">
      <h2 className="text-xl font-bold">⚙️ 规则设置</h2>
      <p className="mt-1 text-sm text-slate-500">规则保存在 data/points.sqlite 中，后续可以加页面编辑。</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {rules.map((rule) => (
          <div key={rule.id} className="rounded-2xl bg-slate-50 p-4">
            <p className="font-semibold">{rule.title}</p>
            <p className="mt-1 text-sm text-slate-500">
              {categoryLabels[rule.category]} · {rule.kind === 'earn' ? '加' : '扣'} {rule.points} 分 · {rule.enabled ? '启用' : '停用'}
            </p>
          </div>
        ))}
      </div>
    </section>
  )
}

export default App

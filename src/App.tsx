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

type WeeklyNetPoint = {
  key: number
  label: string
  net: number
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
  fitness: 'Fitness',
  gaming: 'Gaming',
  habit: 'Habits',
  other: 'Other',
}

const pageLinks = [
  { id: 'dashboard', label: 'Dashboard', emoji: '📊' },
  { id: 'fitness', label: 'Fitness Points', emoji: '🏃' },
  { id: 'habit', label: 'Habit Points', emoji: '🌱' },
  { id: 'gaming', label: 'Gaming Deductions', emoji: '🎮' },
  { id: 'rewards', label: 'Rewards', emoji: '🎁' },
  { id: 'rules', label: 'Rules', emoji: '⚙️' },
]

const childName = (import.meta.env.VITE_CHILD_NAME || 'Vincent').trim()
const dashboardTitle = `${childName || 'Vincent'}'s Points Dashboard`

function isThisWeek(createdAt: string) {
  const date = new Date(createdAt)
  const now = new Date()
  const start = new Date(now)
  const day = start.getDay() || 7
  start.setHours(0, 0, 0, 0)
  start.setDate(start.getDate() - day + 1)
  return date >= start
}

function getWeekStart(date: Date) {
  const start = new Date(date)
  const day = start.getDay() || 7
  start.setHours(0, 0, 0, 0)
  start.setDate(start.getDate() - day + 1)
  return start
}

function formatWeekLabel(date: Date) {
  return new Intl.DateTimeFormat('en-US', {
    month: '2-digit',
    day: '2-digit',
  }).format(date)
}

function formatDateTime(createdAt: string) {
  return new Intl.DateTimeFormat('en-US', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(createdAt))
}

function isActive(item: { deletedAt?: string | null }) {
  return !item.deletedAt
}

function buildWeeklyNetPoints(records: PointRecord[], rewards: Reward[], weekCount = 8) {
  const currentWeekStart = getWeekStart(new Date())
  const points = Array.from({ length: weekCount }, (_, index) => {
    const weekStart = new Date(currentWeekStart)
    weekStart.setDate(currentWeekStart.getDate() - (weekCount - index - 1) * 7)

    return {
      key: weekStart.getTime(),
      label: formatWeekLabel(weekStart),
      net: 0,
    }
  })
  const pointByWeek = new Map(points.map((point) => [point.key, point]))

  for (const record of records.filter(isActive)) {
    const point = pointByWeek.get(getWeekStart(new Date(record.createdAt)).getTime())
    if (point) {
      point.net += record.kind === 'earn' ? record.points : -record.points
    }
  }

  for (const reward of rewards.filter(isActive)) {
    const point = pointByWeek.get(getWeekStart(new Date(reward.createdAt)).getTime())
    if (point) {
      point.net -= reward.cost
    }
  }

  return points
}

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  })

  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`)
  }

  return response.json() as Promise<T>
}

function App() {
  const [data, setData] = useState<PointsData>(initialData)
  const [recordForm, setRecordForm] = useState<RecordFormState>(initialRecordForm)
  const [rewardForm, setRewardForm] = useState<RewardFormState>(initialRewardForm)
  const [status, setStatus] = useState('Loading local database...')

  async function refreshData() {
    const nextData = await requestJson<PointsData>('/api/points')
    setData(nextData)
  }

  useEffect(() => {
    refreshData()
      .then(() => setStatus('Data loaded from data/points.sqlite'))
      .catch((error: unknown) => {
        setStatus(error instanceof Error ? error.message : 'Failed to load data')
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
        detail: `${categoryLabels[record.category]} · ${record.kind === 'earn' ? 'Earn' : 'Deduct'}`,
        points: record.kind === 'earn' ? record.points : -record.points,
        note: record.note,
        createdAt: record.createdAt,
        deletedAt: record.deletedAt,
      })),
      ...data.rewards.filter(isActive).map((reward) => ({
        id: reward.id,
        type: 'reward' as const,
        title: reward.name,
        detail: 'Reward redemption',
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
        detail: `${categoryLabels[record.category]} · ${record.kind === 'earn' ? 'Earn' : 'Deduct'}`,
        points: record.kind === 'earn' ? record.points : -record.points,
        deletedAt: record.deletedAt,
      })),
      ...data.rewards.filter((reward) => !isActive(reward)).map((reward) => ({
        id: reward.id,
        type: 'reward' as const,
        title: reward.name,
        detail: 'Reward redemption',
        points: -reward.cost,
        deletedAt: reward.deletedAt,
      })),
    ].sort((first, second) => new Date(second.deletedAt ?? '').getTime() - new Date(first.deletedAt ?? '').getTime())
  }, [data])

  const weeklyNetPoints = useMemo(() => buildWeeklyNetPoints(data.records, data.rewards), [data])

  async function addRecord(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setStatus('Writing to data/points.sqlite...')
    await requestJson<PointRecord>('/api/records', {
      method: 'POST',
      body: JSON.stringify(recordForm),
    })
    setRecordForm({ ...initialRecordForm, kind: recordForm.kind, category: recordForm.category })
    await refreshData()
    setStatus('Record saved to data/points.sqlite')
  }

  async function addReward(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setStatus('Writing to data/points.sqlite...')
    await requestJson<Reward>('/api/rewards', {
      method: 'POST',
      body: JSON.stringify(rewardForm),
    })
    setRewardForm(initialRewardForm)
    await refreshData()
    setStatus('Reward saved to data/points.sqlite')
  }

  async function deleteItem(type: 'record' | 'reward', id: string) {
    setStatus('Marking as deleted and updating data/points.sqlite...')
    await requestJson<{ ok: boolean }>(`/api/${type === 'record' ? 'records' : 'rewards'}/${id}`, {
      method: 'DELETE',
    })
    await refreshData()
    setStatus('Marked as deleted; it is no longer included in totals')
  }

  async function hardDeleteItem(type: 'record' | 'reward', id: string) {
    const confirmed = window.confirm('Permanently delete this soft-deleted item from points.sqlite? This cannot be undone.')
    if (!confirmed) {
      return
    }

    setStatus('Permanently deleting from data/points.sqlite...')
    await requestJson<{ ok: boolean }>(`/api/${type === 'record' ? 'records' : 'rewards'}/${id}?hard=1`, {
      method: 'DELETE',
    })
    await refreshData()
    setStatus('Permanently deleted from data/points.sqlite')
  }

  return (
    <main className="min-h-screen bg-[#f7f5ef] px-4 py-6 text-slate-900 sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-6xl flex-col gap-6">
        <header id="dashboard" className="rounded-[2rem] bg-white/90 p-6 shadow-sm ring-1 ring-black/5 sm:p-8">
          <p className="text-sm font-semibold text-amber-600">Points Dashboard</p>
          <div className="mt-3 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-tight sm:text-5xl">{dashboardTitle}</h1>
              <p className="mt-3 max-w-2xl text-base leading-7 text-slate-600">
                Track points earned, points deducted, and reward redemptions. All records are stored in a local SQLite database so the app stays fast as data grows.
              </p>
            </div>
            <p className="rounded-full bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-700">{status}</p>
          </div>
        </header>

        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
          <SummaryCard label="Current Points" value={stats.balance} tone="bg-emerald-50 text-emerald-700" />
          <SummaryCard label="Total Earned" value={`+${stats.totalEarned}`} tone="bg-sky-50 text-sky-700" />
          <SummaryCard label="Total Deducted" value={`-${stats.totalDeducted}`} tone="bg-rose-50 text-rose-700" />
          <SummaryCard label="Rewards Spent" value={`-${stats.totalRewardCost}`} tone="bg-violet-50 text-violet-700" />
          <SummaryCard label="This Week Net" value={stats.weeklyNet} tone="bg-amber-50 text-amber-700" />
          <SummaryCard label="Deleted Items" value={stats.deletedCount} tone="bg-slate-100 text-slate-600" />
        </section>

        <WeeklyNetChart points={weeklyNetPoints} />

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
                  <h2 className="text-xl font-bold">Recent Activity</h2>
                  <p className="mt-1 text-sm text-slate-500">Today {stats.todayCount} records</p>
                </div>
              </div>
              <div className="mt-5 grid gap-3">
                {recentItems.length === 0 ? (
                  <p className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-500">No records yet. Add one to get started.</p>
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
                          Delete
                        </button>
                      </div>
                    </article>
                  ))
                )}
              </div>
            </section>

            <CategorySection id="fitness" title="Fitness Points" emoji="🏃" records={data.records.filter((record) => isActive(record) && record.category === 'fitness')} />
            <CategorySection id="habit" title="Habit Points" emoji="🌱" records={data.records.filter((record) => isActive(record) && record.category === 'habit')} />
            <CategorySection id="gaming" title="Gaming Deductions" emoji="🎮" records={data.records.filter((record) => isActive(record) && record.category === 'gaming')} />
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

function WeeklyNetChart({ points }: { points: WeeklyNetPoint[] }) {
  const width = 720
  const height = 260
  const padding = { top: 28, right: 24, bottom: 48, left: 48 }
  const chartWidth = width - padding.left - padding.right
  const chartHeight = height - padding.top - padding.bottom
  const zeroY = padding.top + chartHeight / 2
  const maxAbs = Math.max(1, ...points.map((point) => Math.abs(point.net)))
  const barGap = 14
  const barWidth = Math.max(18, chartWidth / points.length - barGap)

  return (
    <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-black/5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-xl font-bold">📈 Weekly Net Points</h2>
          <p className="mt-1 text-sm text-slate-500">Last {points.length} weeks, after deductions and reward redemptions.</p>
        </div>
        <p className="text-sm font-semibold text-slate-500">This week {points.at(-1)?.net ?? 0} pts</p>
      </div>

      <div className="mt-5 overflow-x-auto">
        <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Weekly net points bar chart" className="min-w-[680px]">
          <line x1={padding.left} x2={width - padding.right} y1={padding.top} y2={padding.top} stroke="#e2e8f0" strokeDasharray="4 6" />
          <line x1={padding.left} x2={width - padding.right} y1={zeroY} y2={zeroY} stroke="#94a3b8" />
          <line x1={padding.left} x2={width - padding.right} y1={height - padding.bottom} y2={height - padding.bottom} stroke="#e2e8f0" strokeDasharray="4 6" />
          <text x={padding.left - 10} y={padding.top + 4} textAnchor="end" className="fill-slate-400 text-xs">+{maxAbs}</text>
          <text x={padding.left - 10} y={zeroY + 4} textAnchor="end" className="fill-slate-400 text-xs">0</text>
          <text x={padding.left - 10} y={height - padding.bottom + 4} textAnchor="end" className="fill-slate-400 text-xs">-{maxAbs}</text>

          {points.map((point, index) => {
            const x = padding.left + index * (chartWidth / points.length) + barGap / 2
            const scaledHeight = Math.abs(point.net) / maxAbs * (chartHeight / 2)
            const y = point.net >= 0 ? zeroY - scaledHeight : zeroY
            const color = point.net >= 0 ? '#10b981' : '#f43f5e'

            return (
              <g key={point.key}>
                <rect x={x} y={y} width={barWidth} height={Math.max(2, scaledHeight)} rx="8" fill={color} opacity="0.9" />
                <text x={x + barWidth / 2} y={point.net >= 0 ? y - 8 : y + scaledHeight + 18} textAnchor="middle" className="fill-slate-700 text-xs font-bold">
                  {point.net >= 0 ? '+' : ''}{point.net}
                </text>
                <text x={x + barWidth / 2} y={height - 18} textAnchor="middle" className="fill-slate-500 text-xs">
                  {point.label}
                </text>
              </g>
            )
          })}
        </svg>
      </div>
    </section>
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
      <h2 className="text-xl font-bold">Add Earned / Deducted Points</h2>
      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <label className="grid gap-2 text-sm font-semibold text-slate-600">
          Type
          <select value={form.kind} onChange={(event) => setForm({ ...form, kind: event.target.value as RecordKind })} className="rounded-2xl border border-slate-200 px-4 py-3">
            <option value="earn">Earn</option>
            <option value="deduct">Deduct</option>
          </select>
        </label>
        <label className="grid gap-2 text-sm font-semibold text-slate-600">
          Category
          <select value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value as Category })} className="rounded-2xl border border-slate-200 px-4 py-3">
            <option value="fitness">Fitness</option>
            <option value="gaming">Gaming</option>
            <option value="habit">Habits</option>
            <option value="other">Other</option>
          </select>
        </label>
        <label className="grid gap-2 text-sm font-semibold text-slate-600 sm:col-span-2">
          Item
          <input required value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="Example: jump rope for 10 minutes" className="rounded-2xl border border-slate-200 px-4 py-3" />
        </label>
        <label className="grid gap-2 text-sm font-semibold text-slate-600">
          Points
          <input required min="1" type="number" value={form.points} onChange={(event) => setForm({ ...form, points: event.target.value })} className="rounded-2xl border border-slate-200 px-4 py-3" />
        </label>
        <label className="grid gap-2 text-sm font-semibold text-slate-600">
          Note
          <input value={form.note} onChange={(event) => setForm({ ...form, note: event.target.value })} placeholder="Optional" className="rounded-2xl border border-slate-200 px-4 py-3" />
        </label>
      </div>
      <button className="mt-5 w-full rounded-2xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-700">
        Save to Local Database
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
      <h2 className="text-xl font-bold">Add Reward Redemption</h2>
      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <label className="grid gap-2 text-sm font-semibold text-slate-600 sm:col-span-2">
          Reward
          <input required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Example: redeem 20 minutes of game time" className="rounded-2xl border border-slate-200 px-4 py-3" />
        </label>
        <label className="grid gap-2 text-sm font-semibold text-slate-600">
          Points Cost
          <input required min="1" type="number" value={form.cost} onChange={(event) => setForm({ ...form, cost: event.target.value })} className="rounded-2xl border border-slate-200 px-4 py-3" />
        </label>
        <label className="grid gap-2 text-sm font-semibold text-slate-600">
          Note
          <input value={form.note} onChange={(event) => setForm({ ...form, note: event.target.value })} placeholder="Optional" className="rounded-2xl border border-slate-200 px-4 py-3" />
        </label>
      </div>
      <button className="mt-5 w-full rounded-2xl bg-amber-500 px-5 py-3 text-sm font-semibold text-white transition hover:bg-amber-600">
        Save Reward Redemption
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
          <p className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-500">No records yet.</p>
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
      <h2 className="text-xl font-bold">🎁 Rewards</h2>
      <div className="mt-4 grid gap-3">
        {rewards.length === 0 ? (
          <p className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-500">No reward redemptions yet.</p>
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
          <h2 className="text-xl font-bold">🗂️ Deleted Items</h2>
          <p className="mt-1 text-sm text-slate-500">These items remain in data/points.sqlite, but they are excluded from all point totals.</p>
        </div>
        {debugMode ? (
          <span className="w-fit rounded-full bg-rose-50 px-3 py-1 text-xs font-bold text-rose-700">Debug: Permanent delete enabled</span>
        ) : null}
      </div>
      <div className="mt-4 grid gap-3">
        {items.length === 0 ? (
          <p className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-500">No deleted items.</p>
        ) : (
          items.map((item) => (
            <div key={`${item.type}-${item.id}`} className="flex flex-col gap-3 rounded-2xl bg-slate-50 p-4 opacity-75 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-semibold line-through decoration-slate-400">{item.title}</p>
                <p className="text-sm text-slate-500">
                  {item.detail} · Deleted at {item.deletedAt ? formatDateTime(item.deletedAt) : 'unknown time'}
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
                    Permanently Delete
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
      <h2 className="text-xl font-bold">⚙️ Rules</h2>
      <p className="mt-1 text-sm text-slate-500">Rules are stored in data/points.sqlite. A rule editor can be added later.</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {rules.map((rule) => (
          <div key={rule.id} className="rounded-2xl bg-slate-50 p-4">
            <p className="font-semibold">{rule.title}</p>
            <p className="mt-1 text-sm text-slate-500">
              {categoryLabels[rule.category]} · {rule.kind === 'earn' ? 'Earn' : 'Deduct'} {rule.points} pts · {rule.enabled ? 'Enabled' : 'Disabled'}
            </p>
          </div>
        ))}
      </div>
    </section>
  )
}

export default App

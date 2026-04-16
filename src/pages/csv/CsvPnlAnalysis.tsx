import { useMemo, useState, useCallback, useRef } from 'react'
import Card from '../../components/Card'
import ChartWrapper, { DarkTooltipStyle } from '../../components/ChartWrapper'
import DataTable from '../../components/DataTable'
import { formatCurrency, formatCurrencyFull, formatPercent, pnlColor } from '../../lib/utils'
import type { CsvPnlAnalysis, MonthlyRow, DayOfWeekRow } from '../../types/csvReport'
import { BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Cell } from 'recharts'
import type { ColumnDef } from '@tanstack/react-table'

interface HeatmapTooltip {
  date: string
  pnl: number
  x: number
  y: number
}

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const

function formatDateLabel(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  const day = DAY_NAMES[d.getDay()]
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  return `${day}, ${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`
}

function HeatmapCard({ heatmapMonths, maxAbsPnl }: {
  heatmapMonths: [string, { date: string; pnl: number }[]][]
  maxAbsPnl: number
}) {
  const [tooltip, setTooltip] = useState<HeatmapTooltip | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const hideTimeout = useRef<ReturnType<typeof setTimeout>>()

  const handleMouseEnter = useCallback((e: React.MouseEvent, d: { date: string; pnl: number }) => {
    if (hideTimeout.current) clearTimeout(hideTimeout.current)
    const rect = containerRef.current?.getBoundingClientRect()
    const cellRect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    if (!rect) return
    setTooltip({
      date: d.date,
      pnl: d.pnl,
      x: cellRect.left - rect.left + cellRect.width / 2,
      y: cellRect.top - rect.top,
    })
  }, [])

  const handleMouseLeave = useCallback(() => {
    hideTimeout.current = setTimeout(() => setTooltip(null), 100)
  }, [])

  return (
    <Card title="Daily P&L Heatmap">
      <div ref={containerRef} className="relative space-y-3">
        {heatmapMonths.map(([month, days]) => (
          <div key={month}>
            <div className="text-xs font-semibold mb-1" style={{ color: 'var(--text-secondary)' }}>{month}</div>
            <div className="flex flex-wrap gap-1">
              {days.map(d => {
                const alpha = 0.2 + (Math.abs(d.pnl) / maxAbsPnl) * 0.8
                const color = d.pnl >= 0 ? `rgba(34, 197, 94, ${alpha})` : `rgba(235, 59, 59, ${alpha})`
                return (
                  <div
                    key={d.date}
                    className="rounded-sm cursor-default transition-transform hover:scale-150 hover:z-10"
                    style={{ width: 14, height: 14, background: color }}
                    onMouseEnter={(e) => handleMouseEnter(e, d)}
                    onMouseLeave={handleMouseLeave}
                  />
                )
              })}
            </div>
          </div>
        ))}

        {/* Styled tooltip */}
        {tooltip && (
          <div
            className="absolute z-50 pointer-events-none"
            style={{
              left: tooltip.x,
              top: tooltip.y,
              transform: 'translate(-50%, -100%)',
            }}
          >
            <div
              className="rounded-lg px-3 py-2 shadow-xl mb-2 whitespace-nowrap"
              style={{
                background: 'var(--bg-card, #1a1a2e)',
                border: '1px solid var(--border-medium, #333)',
                backdropFilter: 'blur(8px)',
              }}
            >
              <div className="text-[11px] font-medium mb-1" style={{ color: 'var(--text-secondary, #888)' }}>
                {formatDateLabel(tooltip.date)}
              </div>
              <div className="flex items-center gap-2">
                <div
                  className="w-2 h-2 rounded-full"
                  style={{ background: tooltip.pnl >= 0 ? '#22c55e' : '#eb3b3b' }}
                />
                <span
                  className="text-sm font-bold font-mono"
                  style={{ color: tooltip.pnl >= 0 ? '#22c55e' : '#eb3b3b' }}
                >
                  {tooltip.pnl >= 0 ? '+' : ''}{formatCurrencyFull(tooltip.pnl)}
                </span>
              </div>
            </div>
            {/* Arrow */}
            <div
              className="absolute left-1/2 -translate-x-1/2 -bottom-0.5 w-0 h-0"
              style={{
                borderLeft: '5px solid transparent',
                borderRight: '5px solid transparent',
                borderTop: '5px solid var(--border-medium, #333)',
              }}
            />
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-3 mt-4 pt-3" style={{ borderTop: '1px solid var(--border-subtle, #222)' }}>
        <span className="text-[10px]" style={{ color: 'var(--text-secondary, #888)' }}>Loss</span>
        {[0.9, 0.6, 0.3].map((a) => (
          <div key={`loss-${a}`} className="rounded-sm" style={{ width: 12, height: 12, background: `rgba(235, 59, 59, ${a})` }} />
        ))}
        <div className="w-3" />
        {[0.3, 0.6, 0.9].map((a) => (
          <div key={`win-${a}`} className="rounded-sm" style={{ width: 12, height: 12, background: `rgba(34, 197, 94, ${a})` }} />
        ))}
        <span className="text-[10px]" style={{ color: 'var(--text-secondary, #888)' }}>Profit</span>
      </div>
    </Card>
  )
}

export default function CsvPnlAnalysisPage({ data }: { data: CsvPnlAnalysis }) {
  const monthlyColumns = useMemo<ColumnDef<MonthlyRow, unknown>[]>(() => [
    { accessorKey: 'month', header: 'Month' },
    { accessorKey: 'trades', header: 'Trades' },
    { accessorKey: 'gross_pnl', header: 'Gross P&L', cell: i => <span style={{ color: pnlColor(i.getValue() as number) }}>{formatCurrencyFull(i.getValue() as number)}</span> },
    { accessorKey: 'win_rate', header: 'Win Rate', cell: i => formatPercent(i.getValue() as number) },
    { accessorKey: 'avg_pnl', header: 'Avg P&L', cell: i => <span style={{ color: pnlColor(i.getValue() as number) }}>{formatCurrency(i.getValue() as number)}</span> },
    { accessorKey: 'largest_win', header: 'Best', cell: i => <span style={{ color: 'var(--accent-green)' }}>{formatCurrency(i.getValue() as number)}</span> },
    { accessorKey: 'largest_loss', header: 'Worst', cell: i => <span style={{ color: 'var(--accent-red)' }}>{formatCurrency(i.getValue() as number)}</span> },
    { accessorKey: 'profit_factor', header: 'PF', cell: i => (i.getValue() as number).toFixed(2) },
  ], [])

  const dowColumns = useMemo<ColumnDef<DayOfWeekRow, unknown>[]>(() => [
    { accessorKey: 'day', header: 'Day' },
    { accessorKey: 'trade_count', header: 'Trades' },
    { accessorKey: 'total_pnl', header: 'Total P&L', cell: i => <span style={{ color: pnlColor(i.getValue() as number) }}>{formatCurrencyFull(i.getValue() as number)}</span> },
    { accessorKey: 'avg_pnl', header: 'Avg P&L', cell: i => <span style={{ color: pnlColor(i.getValue() as number) }}>{formatCurrency(i.getValue() as number)}</span> },
    { accessorKey: 'win_rate', header: 'Win Rate', cell: i => formatPercent(i.getValue() as number) },
  ], [])

  // Heatmap: group by month
  const heatmapMonths = useMemo(() => {
    const months: Record<string, { date: string; pnl: number }[]> = {}
    for (const d of data.daily_heatmap) {
      const m = d.date.slice(0, 7)
      if (!months[m]) months[m] = []
      months[m].push(d)
    }
    return Object.entries(months).sort(([a], [b]) => a.localeCompare(b))
  }, [data.daily_heatmap])

  const maxAbsPnl = useMemo(() => {
    const vals = data.daily_heatmap.map(d => Math.abs(d.pnl))
    return vals.length ? Math.max(...vals) : 1
  }, [data.daily_heatmap])

  return (
    <div className="space-y-6">
      {/* Monthly Performance Table */}
      <Card title="Monthly Performance">
        <DataTable data={data.monthly_table} columns={monthlyColumns} pageSize={24} />
      </Card>

      {/* Daily P&L Heatmap */}
      <HeatmapCard heatmapMonths={heatmapMonths} maxAbsPnl={maxAbsPnl} />

      {/* Day of Week */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card title="P&L by Day of Week">
          <ChartWrapper height={250}>
            <BarChart data={data.day_of_week}>
              <CartesianGrid strokeDasharray="3 3" stroke="#252525" />
              <XAxis dataKey="day" tick={{ fontSize: 11, fill: '#555' }} />
              <YAxis tick={{ fontSize: 11, fill: '#555' }} tickFormatter={(v: number) => formatCurrency(v)} />
              <Tooltip {...DarkTooltipStyle()} formatter={(v: number) => [formatCurrencyFull(v), 'Total P&L']} />
              <Bar dataKey="total_pnl" radius={[4, 4, 0, 0]}>
                {data.day_of_week.map((d, i) => (
                  <Cell key={i} fill={d.total_pnl >= 0 ? '#22c55e' : '#eb3b3b'} />
                ))}
              </Bar>
            </BarChart>
          </ChartWrapper>
          <DataTable data={data.day_of_week} columns={dowColumns} pageSize={7} />
        </Card>

        <Card title="Trades per Day">
          <ChartWrapper height={250}>
            <BarChart data={data.trades_per_day}>
              <CartesianGrid strokeDasharray="3 3" stroke="#252525" />
              <XAxis dataKey="day" tick={{ fontSize: 11, fill: '#555' }} />
              <YAxis tick={{ fontSize: 11, fill: '#555' }} />
              <Tooltip {...DarkTooltipStyle()} formatter={(v: number) => [v, 'Trades']} />
              <Bar dataKey="count" radius={[4, 4, 0, 0]} fill="#3b82f6" />
            </BarChart>
          </ChartWrapper>
        </Card>
      </div>
    </div>
  )
}

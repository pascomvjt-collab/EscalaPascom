import { ChevronLeft, ChevronRight } from 'lucide-react'
import type { EscalaEvent } from '#/types'

const PT_MONTHS = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
]
const DAYS_SHORT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

interface Props {
  year: number
  month: number
  events: EscalaEvent[]
  selectedDay: number | null
  onSelectDay: (day: number) => void
  onNavMonth: (delta: number) => void
}

export function Calendar({ year, month, events, selectedDay, onSelectDay, onNavMonth }: Props) {
  const today = new Date()
  const todayNum =
    today.getFullYear() === year && today.getMonth() === month ? today.getDate() : -1

  const firstDow = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()

  const eventsByDay: Record<number, number> = {}
  for (const ev of events) {
    if (ev.year === year && ev.month === month) {
      eventsByDay[ev.day] = (eventsByDay[ev.day] ?? 0) + 1
    }
  }

  const btnBase: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 32,
    height: 32,
    border: '1px solid var(--line-strong)',
    borderRadius: 6,
    background: 'var(--surface)',
    color: 'var(--ink-2)',
    cursor: 'pointer',
    transition: 'background 120ms ease, color 120ms ease, border-color 120ms ease',
    flexShrink: 0,
  }

  return (
    <div
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--line)',
        borderRadius: 12,
        padding: '18px 16px',
      }}
    >
      {/* Navigation */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
        <button
          style={btnBase}
          onClick={() => onNavMonth(-1)}
          aria-label="Mês anterior"
          onMouseEnter={e => { e.currentTarget.style.background = 'var(--surface-raised)'; e.currentTarget.style.color = 'var(--ink)' }}
          onMouseLeave={e => { e.currentTarget.style.background = 'var(--surface)'; e.currentTarget.style.color = 'var(--ink-2)' }}
        >
          <ChevronLeft size={16} />
        </button>

        <span
          style={{
            fontFamily: 'Fraunces, Georgia, serif',
            fontSize: '1rem',
            fontWeight: 500,
            color: 'var(--ink)',
            letterSpacing: '0.01em',
          }}
        >
          {PT_MONTHS[month]} {year}
        </span>

        <button
          style={btnBase}
          onClick={() => onNavMonth(1)}
          aria-label="Próximo mês"
          onMouseEnter={e => { e.currentTarget.style.background = 'var(--surface-raised)'; e.currentTarget.style.color = 'var(--ink)' }}
          onMouseLeave={e => { e.currentTarget.style.background = 'var(--surface)'; e.currentTarget.style.color = 'var(--ink-2)' }}
        >
          <ChevronRight size={16} />
        </button>
      </div>

      {/* Day labels */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2, marginBottom: 4 }}>
        {DAYS_SHORT.map(d => (
          <div
            key={d}
            style={{
              textAlign: 'center',
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: '0.08em',
              color: 'var(--ink-3)',
              padding: '0 0 8px',
              textTransform: 'uppercase',
            }}
          >
            {d}
          </div>
        ))}
      </div>

      {/* Day cells */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2 }}>
        {Array.from({ length: firstDow }, (_, i) => (
          <div key={`blank-${i}`} />
        ))}

        {Array.from({ length: daysInMonth }, (_, i) => {
          const d = i + 1
          const count = eventsByDay[d] ?? 0
          const isSelected = selectedDay === d
          const isToday = todayNum === d
          const hasEvent = count > 0

          return (
            <button
              key={d}
              type="button"
              disabled={!hasEvent}
              onClick={() => hasEvent && onSelectDay(d)}
              aria-pressed={isSelected}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                minHeight: 46,
                borderRadius: 6,
                border: isToday
                  ? '1px solid rgba(196,154,69,0.45)'
                  : isSelected
                    ? '1px solid rgba(196,154,69,0.35)'
                    : '1px solid transparent',
                background: isSelected
                  ? 'var(--gold-dim)'
                  : hasEvent
                    ? 'var(--surface-raised)'
                    : 'transparent',
                cursor: hasEvent ? 'pointer' : 'default',
                transition: 'background 100ms ease',
                outline: 'none',
                gap: 3,
              }}
              onMouseEnter={e => {
                if (hasEvent && !isSelected) e.currentTarget.style.background = 'var(--surface-high)'
              }}
              onMouseLeave={e => {
                if (hasEvent && !isSelected) e.currentTarget.style.background = 'var(--surface-raised)'
              }}
            >
              <span
                style={{
                  fontSize: 13,
                  fontWeight: isToday ? 700 : 400,
                  color: isSelected || isToday
                    ? 'var(--gold)'
                    : hasEvent
                      ? 'var(--ink)'
                      : 'var(--ink-3)',
                  lineHeight: 1,
                }}
              >
                {d}
              </span>
              {count > 0 && (
                <span
                  style={{
                    fontSize: 9,
                    fontWeight: 700,
                    color: isSelected ? 'var(--gold)' : 'var(--ink-3)',
                    lineHeight: 1,
                    letterSpacing: '0.02em',
                  }}
                >
                  {count > 1 ? `${count}×` : '·'}
                </span>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}

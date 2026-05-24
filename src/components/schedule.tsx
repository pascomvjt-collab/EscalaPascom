import { ChevronLeft, Download } from 'lucide-react'
import { EventCard } from '#/components/event-card'
import type { EscalaEvent, NameColorMap } from '#/types'

const PT_MONTHS = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
]
const PT_DAYS_FULL = [
  'Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira',
  'Quinta-feira', 'Sexta-feira', 'Sábado',
]

interface Props {
  events: EscalaEvent[]
  nameColors: NameColorMap
  year: number
  month: number
  selectedDay: number | null
  onClearDay: () => void
  onCopyName: (name: string) => void
  onGeneratePDF: () => void
}

export function Schedule({
  events, nameColors, year, month, selectedDay,
  onClearDay, onCopyName, onGeneratePDF,
}: Props) {
  const monthEvents = events.filter(e => e.month === month && e.year === year)
  const dayEvents = selectedDay
    ? monthEvents.filter(e => e.day === selectedDay)
    : null

  if (monthEvents.length === 0) {
    return (
      <div
        style={{
          textAlign: 'center',
          padding: '52px 0',
          color: 'var(--ink-3)',
          fontSize: 13,
        }}
      >
        Nenhum evento em {PT_MONTHS[month]} de {year}
      </div>
    )
  }

  if (selectedDay && dayEvents) {
    const dow = PT_DAYS_FULL[new Date(year, month, selectedDay).getDay()]

    return (
      <div className="fade-up" key={`day-${year}-${month}-${selectedDay}`}>
        {/* Day header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 24 }}>
          <button
            type="button"
            onClick={onClearDay}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              padding: '5px 10px 5px 7px',
              background: 'var(--surface)',
              border: '1px solid var(--line)',
              borderRadius: 6,
              fontSize: 12,
              fontWeight: 600,
              color: 'var(--ink-2)',
              cursor: 'pointer',
              transition: 'color 120ms ease, border-color 120ms ease',
              flexShrink: 0,
            }}
            onMouseEnter={e => {
              e.currentTarget.style.color = 'var(--ink)'
              e.currentTarget.style.borderColor = 'var(--line-strong)'
            }}
            onMouseLeave={e => {
              e.currentTarget.style.color = 'var(--ink-2)'
              e.currentTarget.style.borderColor = 'var(--line)'
            }}
          >
            <ChevronLeft size={13} strokeWidth={2.5} />
            Ver mês
          </button>

          <div>
            <div
              style={{
                fontFamily: 'Fraunces, Georgia, serif',
                fontSize: '1.25rem',
                fontWeight: 500,
                color: 'var(--ink)',
                lineHeight: 1.2,
              }}
            >
              {String(selectedDay).padStart(2, '0')} de {PT_MONTHS[month]}
            </div>
            <div style={{ fontSize: 12, color: 'var(--ink-2)', marginTop: 2 }}>
              {dow} · {dayEvents.length} evento{dayEvents.length !== 1 ? 's' : ''}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {dayEvents.map((ev, i) => (
            <EventCard key={i} event={ev} nameColors={nameColors} onCopyName={onCopyName} />
          ))}
        </div>

        <PDFButton onClick={onGeneratePDF} />
      </div>
    )
  }

  /* ── Full month view ─────────────────────────────────── */
  const byDay: Record<number, EscalaEvent[]> = {}
  for (const ev of monthEvents) {
    if (!byDay[ev.day]) byDay[ev.day] = []
    byDay[ev.day].push(ev)
  }
  const sortedDays = Object.keys(byDay).map(Number).sort((a, b) => a - b)
  const volunteerCount = new Set(monthEvents.flatMap(e => e.names)).size

  return (
    <div className="fade-up" key={`month-${year}-${month}`}>
      {/* Stats row */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 28, flexWrap: 'wrap' }}>
        <Chip value={monthEvents.length} label={monthEvents.length === 1 ? 'evento' : 'eventos'} />
        <Chip value={volunteerCount} label={volunteerCount === 1 ? 'voluntário' : 'voluntários'} />
        <Chip value={sortedDays.length} label={sortedDays.length === 1 ? 'dia com escala' : 'dias com escala'} />
      </div>

      {sortedDays.map(day => {
        const dow = PT_DAYS_FULL[new Date(year, month, day).getDay()]

        return (
          <div key={day} style={{ marginBottom: 28 }}>
            {/* Day group header */}
            <div
              style={{
                display: 'flex',
                alignItems: 'baseline',
                gap: 10,
                marginBottom: 12,
                paddingBottom: 10,
                borderBottom: '1px solid var(--line)',
              }}
            >
              <span
                style={{
                  fontFamily: 'Fraunces, Georgia, serif',
                  fontSize: '1rem',
                  fontWeight: 500,
                  color: 'var(--ink)',
                }}
              >
                {String(day).padStart(2, '0')} de {PT_MONTHS[month]}
              </span>
              <span style={{ fontSize: 12, color: 'var(--ink-2)' }}>{dow}</span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {byDay[day].map((ev, i) => (
                <EventCard key={i} event={ev} nameColors={nameColors} onCopyName={onCopyName} />
              ))}
            </div>
          </div>
        )
      })}

      <PDFButton onClick={onGeneratePDF} />
    </div>
  )
}

function Chip({ value, label }: { value: number; label: string }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 5,
        padding: '5px 12px',
        background: 'var(--surface)',
        border: '1px solid var(--line)',
        borderRadius: 20,
        fontSize: 12,
        color: 'var(--ink-2)',
      }}
    >
      <span style={{ fontWeight: 700, color: 'var(--ink)' }}>{value}</span>
      {label}
    </div>
  )
}

function PDFButton({ onClick }: { onClick: () => void }) {
  return (
    <div style={{ marginTop: 32, paddingTop: 24, borderTop: '1px solid var(--line)' }}>
      <button
        type="button"
        onClick={onClick}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 7,
          padding: '9px 20px',
          background: 'var(--surface)',
          border: '1px solid var(--line-strong)',
          borderRadius: 7,
          fontSize: 13,
          fontWeight: 600,
          color: 'var(--ink-2)',
          cursor: 'pointer',
          transition: 'color 130ms ease, border-color 130ms ease',
        }}
        onMouseEnter={e => {
          e.currentTarget.style.color = 'var(--ink)'
          e.currentTarget.style.borderColor = 'var(--gold)'
        }}
        onMouseLeave={e => {
          e.currentTarget.style.color = 'var(--ink-2)'
          e.currentTarget.style.borderColor = 'var(--line-strong)'
        }}
      >
        <Download size={14} strokeWidth={2} />
        Exportar como PDF
      </button>
    </div>
  )
}

import { Clock } from 'lucide-react'
import { useState } from 'react'
import type { EscalaEvent, NameColorMap } from '#/types'

const PT_MONTHS_SHORT = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']

interface Props {
  event: EscalaEvent
  nameColors: NameColorMap
  onCopyName: (name: string) => void
}

export function EventCard({ event, nameColors, onCopyName }: Props) {
  const [hovering, setHovering] = useState(false)

  return (
    <div
      style={{
        background: 'var(--surface)',
        border: `1px solid ${hovering ? 'var(--line-strong)' : 'var(--line)'}`,
        borderRadius: 10,
        padding: '15px 16px',
        transition: 'border-color 150ms ease',
      }}
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 11 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: 11,
              fontWeight: 600,
              color: 'var(--ink-2)',
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              marginBottom: 4,
            }}
          >
            {String(event.day).padStart(2, '0')} {PT_MONTHS_SHORT[event.month]} {event.year}
          </div>
          <div
            style={{
              fontSize: 14,
              fontWeight: 700,
              color: 'var(--ink)',
              lineHeight: 1.3,
            }}
          >
            {event.title}
          </div>
        </div>

        {event.time && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              fontSize: 12,
              fontWeight: 500,
              color: 'var(--ink-2)',
              flexShrink: 0,
              paddingTop: 18,
            }}
          >
            <Clock size={12} strokeWidth={2} />
            {event.time}
          </div>
        )}
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
        {event.names.map(name => (
          <span
            key={name}
            className={`name-tag nc-${nameColors[name] ?? 0}`}
            onClick={() => onCopyName(name)}
            title="Clique para copiar"
          >
            {name}
          </span>
        ))}
      </div>
    </div>
  )
}

export interface EscalaEvent {
  day: number
  month: number
  year: number
  title: string
  time: string | null
  names: string[]
  colHeader: string
  isCabeamento: boolean
}

export type NameColorMap = Record<string, number>

export interface SelectedDay {
  day: number
  month: number
  year: number
}

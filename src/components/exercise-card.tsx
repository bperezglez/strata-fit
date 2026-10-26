import { lazy, memo, Suspense, useState } from 'react'
import { ArrowDownRight, ArrowUpRight, ChartSpline, Check, ChevronDown, Plus, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { NumberField } from '@/components/number-field'
import type { HistoryPoint } from '@/lib/history'
import { exerciseStats, fmt, headlineValue, isFilled, percentDelta, sessionGuide, setVolume } from '@/lib/metrics'
import { weekNumber } from '@/lib/week'
import { cn } from '@/lib/utils'
import { actions } from '@/store/workout-store'
import type { DayId, ExerciseTemplate, SetEntry } from '@/types'

const ExerciseHistoryChart = lazy(() => import('./exercise-history-chart'))

type Field = 'reps' | 'weight' | 'duration' | 'distance'

interface Column {
  field: Field
  label: string
  integer?: boolean
}

function columnsFor(ex: ExerciseTemplate): Column[] {
  if (ex.kind === 'strength') {
    return [
      { field: 'reps', label: 'Reps', integer: true },
      { field: 'weight', label: 'Kg' },
    ]
  }
  if (ex.kind === 'cardio') {
    return [
      { field: 'duration', label: 'Min' },
      { field: 'distance', label: 'Km' },
    ]
  }
  const seconds = (ex.durationUnit ?? 's') === 's'
  return [
    { field: 'duration', label: seconds ? 'Seg' : 'Min', integer: seconds },
    { field: 'weight', label: 'Lastre kg' },
  ]
}

function derivedLabel(ex: ExerciseTemplate) {
  if (ex.kind === 'strength') return 'Volumen'
  if (ex.kind === 'cardio') return 'km/h'
  return ''
}

function derivedValue(ex: ExerciseTemplate, s: SetEntry): string {
  if (ex.kind === 'strength') {
    const v = setVolume(s)
    return v ? fmt(v) : '—'
  }
  if (ex.kind === 'cardio' && s.duration && s.distance) return fmt(s.distance / (s.duration / 60))
  return ''
}

function headlineUnit(ex: ExerciseTemplate) {
  if (ex.kind === 'strength') return 'kg'
  if (ex.kind === 'cardio') return 'min'
  return ex.durationUnit ?? 's'
}

interface Props {
  exercise: ExerciseTemplate
  index: number
  weekKey: string
  day: DayId
  accent: string
  sets: SetEntry[]
  done: boolean
  previous?: { weekKey: string; sets: SetEntry[] }
  history: HistoryPoint[]
}

export const ExerciseCard = memo(function ExerciseCard({
  exercise,
  index,
  weekKey,
  day,
  accent,
  sets,
  done,
  previous,
  history,
}: Props) {
  const [showChart, setShowChart] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const columns = columnsFor(exercise)
  const derived = derivedLabel(exercise)
  const guide = sessionGuide(sets, previous?.sets)
  const rows = guide ?? sets
  const stats = exerciseStats(sets, exercise.kind)
  const prevStats = previous ? exerciseStats(previous.sets, exercise.kind) : null
  const current = headlineValue(stats, exercise.kind)
  const prevValue = prevStats ? headlineValue(prevStats, exercise.kind) : 0
  const delta = guide ? null : percentDelta(current, prevValue)
  const unit = headlineUnit(exercise)
  const grid = 'grid grid-cols-[1.75rem_1fr_1fr_4.25rem_2rem] items-center gap-2'
  const collapsed = done && !expanded

  const markDone = () => {
    actions.setExerciseDone(weekKey, day, exercise.id, true)
    setShowChart(false)
    setExpanded(false)
  }

  const markInProgress = () => {
    actions.setExerciseDone(weekKey, day, exercise.id, false)
    setExpanded(true)
  }

  const commitGuide = (next: SetEntry[]) => {
    if (!next.length) return
    actions.replaceSets(weekKey, day, exercise.id, next)
  }

  return (
    <article
      className={cn(
        'overflow-hidden rounded-2xl border bg-card shadow-sm shadow-black/20 transition-colors',
        done ? 'border-primary/35 bg-primary/[0.03]' : 'border-border',
      )}
    >
      <div
        className={cn(
          'flex w-full items-start gap-3 p-4 text-left',
          collapsed && 'cursor-pointer hover:bg-white/[0.02]',
        )}
        onClick={collapsed ? () => setExpanded(true) : undefined}
        onKeyDown={
          collapsed
            ? (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  setExpanded(true)
                }
              }
            : undefined
        }
        role={collapsed ? 'button' : undefined}
        tabIndex={collapsed ? 0 : undefined}
        aria-expanded={!collapsed}
      >
        <span
          className={cn(
            'mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg text-xs font-bold',
            done ? 'bg-primary text-primary-foreground' : 'text-black',
          )}
          style={done ? undefined : { backgroundColor: accent }}
        >
          {done ? <Check className="size-4" strokeWidth={3} aria-hidden /> : index + 1}
        </span>
        <div className="min-w-0 flex-1">
          <h3 className={cn('font-semibold leading-tight', done && 'text-muted-foreground')}>{exercise.name}</h3>
          {collapsed ? (
            <p className="mt-0.5 text-xs font-medium text-primary">Terminado · toca para editar</p>
          ) : (
            <p className="mt-0.5 text-xs text-muted-foreground">
              <span className="font-medium text-foreground/80">{exercise.target}</span>
              {exercise.cue && <span> · {exercise.cue}</span>}
            </p>
          )}
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <span
              className={cn(
                'text-sm font-bold tabular-nums',
                guide ? 'font-semibold text-muted-foreground' : 'text-foreground',
              )}
            >
              {guide && prevValue ? `Guía ${fmt(prevValue)} ${unit}` : current ? `${fmt(current)} ${unit}` : '—'}
            </span>
            {!collapsed && (
              <button
                type="button"
                aria-label={showChart ? 'Ocultar gráfico' : 'Ver gráfico'}
                aria-expanded={showChart}
                className="rounded-md p-0.5 transition-colors hover:bg-white/5"
                onClick={(e) => {
                  e.stopPropagation()
                  setShowChart((v) => !v)
                }}
              >
                <ChartSpline className={cn('size-4 transition-colors', showChart && 'text-primary')} />
              </button>
            )}
            {collapsed && <ChevronDown className="size-4 text-muted-foreground" aria-hidden />}
          </div>
          {delta != null && (
            <span
              className={cn(
                'inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[11px] font-semibold tabular-nums',
                delta >= 0 ? 'bg-primary/15 text-primary' : 'bg-destructive/15 text-destructive',
              )}
            >
              {delta >= 0 ? <ArrowUpRight className="size-3" /> : <ArrowDownRight className="size-3" />}
              {delta >= 0 ? '+' : ''}
              {fmt(delta)}%
            </span>
          )}
        </div>
      </div>

      {!collapsed && showChart && (
        <div className="px-4 pb-3">
          <Suspense fallback={<div className="h-56 animate-pulse rounded-xl bg-muted/40" />}>
            <ExerciseHistoryChart exercise={exercise} history={history} currentWeek={weekKey} accent={accent} />
          </Suspense>
        </div>
      )}

      {!collapsed && (
        <div className="space-y-2 px-4 pb-4">
          {guide && previous && (
            <p className="text-xs text-muted-foreground">
              Guía de la semana {weekNumber(previous.weekKey)}. Cambia un valor para registrarla hoy.
            </p>
          )}
          {rows.length > 0 && (
            <div className={cn(grid, 'px-0.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground')}>
              <span className="text-center">#</span>
              {columns.map((c) => (
                <span key={c.field} className="text-center">
                  {c.label}
                </span>
              ))}
              <span className="text-right">{derived}</span>
              <span />
            </div>
          )}

          {rows.map((s, i) => {
            const prevSet = guide ? undefined : previous?.sets[i]
            const up = !guide && exercise.kind === 'strength' && prevSet && setVolume(s) > setVolume(prevSet)
            return (
              <div key={i} className={grid}>
                <span
                  className={cn(
                    'flex size-7 items-center justify-center rounded-md text-xs font-bold tabular-nums',
                    guide
                      ? 'border border-dashed border-border text-muted-foreground'
                      : isFilled(s, exercise.kind)
                        ? 'bg-muted text-foreground'
                        : 'bg-muted/40 text-muted-foreground',
                  )}
                >
                  {i + 1}
                </span>
                {columns.map((c) => (
                  <NumberField
                    key={c.field}
                    label={
                      guide
                        ? `${c.label} serie ${i + 1}, guía de la semana anterior`
                        : `${c.label} serie ${i + 1}`
                    }
                    integer={c.integer}
                    value={s[c.field]}
                    placeholder={prevSet?.[c.field] != null ? String(prevSet[c.field]).replace('.', ',') : '0'}
                    onFocus={() => {
                      if (guide) commitGuide(guide)
                    }}
                    onChange={(v) => {
                      if (guide) {
                        commitGuide(guide.map((row, index) => (index === i ? { ...row, [c.field]: v } : row)))
                        return
                      }
                      actions.updateSet(weekKey, day, exercise.id, s.id, { [c.field]: v })
                    }}
                    className={guide ? 'border-dashed font-medium text-muted-foreground' : undefined}
                  />
                ))}
                <span
                  className={cn(
                    'truncate text-right text-sm font-semibold tabular-nums',
                    up ? 'text-primary' : 'text-muted-foreground',
                  )}
                >
                  {derivedValue(exercise, s)}
                </span>
                {guide ? (
                  <span />
                ) : (
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Eliminar serie ${i + 1}`}
                    onClick={() => actions.removeSet(weekKey, day, exercise.id, s.id)}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <X />
                  </Button>
                )}
              </div>
            )
          })}

          {rows.length === 0 && (
            <p className="rounded-xl border border-dashed border-border px-3 py-3 text-center text-xs text-muted-foreground">
              Sin series esta semana. Añade la primera para empezar a registrar.
            </p>
          )}

          <div className="flex gap-2 pt-1">
            <Button
              variant="secondary"
              className="h-10 flex-1"
              onClick={() => {
                if (guide) {
                  commitGuide(guide)
                  actions.addSet(weekKey, day, exercise.id)
                  return
                }
                actions.addSet(weekKey, day, exercise.id, previous?.sets[sets.length])
              }}
            >
              <Plus />
              Añadir serie
            </Button>
          </div>

          {stats.sets > 0 && exercise.kind === 'strength' && (
            <div className="flex justify-between pt-1 text-xs text-muted-foreground">
              <span>
                {stats.sets} series · {stats.totalReps} reps · máx. {fmt(stats.maxWeight)} kg
              </span>
              {prevStats && prevStats.sets > 0 && previous && (
                <span>
                  S{weekNumber(previous.weekKey)}: {fmt(prevStats.volume)} kg
                </span>
              )}
            </div>
          )}

          <div className="flex gap-2 border-t border-border/60 pt-3">
            {done ? (
              <>
                <Button variant="outline" className="h-10 flex-1" onClick={() => setExpanded(false)}>
                  Colapsar
                </Button>
                <Button variant="ghost" className="h-10 shrink-0" onClick={markInProgress}>
                  En curso
                </Button>
              </>
            ) : (
              <Button variant="default" className="h-10 w-full" onClick={markDone}>
                <Check />
                Terminar ejercicio
              </Button>
            )}
          </div>
        </div>
      )}
    </article>
  )
})

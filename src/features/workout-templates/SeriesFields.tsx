import type {
  ExerciseWorkoutTemplateStep,
  WorkoutTemplateStep,
} from '../../domain/workout-template'
import { MAX_SET_COUNT } from '../../domain/resolve-workout-template'
import type { RestPreset } from '../../domain/workout-session'

export function RestSelect({
  value,
  presets,
  onChange,
}: {
  readonly value: string | undefined
  readonly presets: readonly RestPreset[]
  readonly onChange: (value: string | undefined) => void
}) {
  return (
    <label className="mt-3 block text-sm">
      Отдых между подходами / упражнениями
      <select
        className="mt-2 min-h-11 w-full rounded-xl bg-slate-800 px-3"
        value={value ?? ''}
        onChange={(event) => onChange(event.target.value || undefined)}
      >
        <option value="">Без отдыха</option>
        {value && !presets.some((preset) => preset.id === value) ? (
          <option value={value}>Удалённый вариант отдыха</option>
        ) : null}
        {presets.map((preset) => (
          <option key={preset.id} value={preset.id}>
            {preset.name} — {preset.durationSeconds} сек.
          </option>
        ))}
      </select>
    </label>
  )
}

export function SeriesFields({
  series,
  name,
  onChange,
}: {
  readonly series: ExerciseWorkoutTemplateStep
  readonly name: string
  readonly onChange: (series: ExerciseWorkoutTemplateStep) => void
}) {
  return (
    <label className="mt-3 block text-sm">
      Подходы — {name}
      <input
        type="number"
        inputMode="numeric"
        min={1}
        max={MAX_SET_COUNT}
        step={1}
        className="mt-2 min-h-11 w-full rounded-xl bg-slate-800 px-3"
        value={Number.isNaN(series.setCount) ? '' : (series.setCount ?? 1)}
        onChange={(event) =>
          onChange({ ...series, setCount: event.target.valueAsNumber })
        }
      />
    </label>
  )
}

export function BlockFields({
  step,
  presets,
  exerciseName,
  onChange,
  onAddExercise,
}: {
  readonly step: WorkoutTemplateStep
  readonly presets: readonly RestPreset[]
  readonly exerciseName: (series: ExerciseWorkoutTemplateStep) => string
  readonly onChange: (step: WorkoutTemplateStep) => void
  readonly onAddExercise: () => void
}) {
  if (step.type === 'rest') return null
  return (
    <>
      {step.type === 'exercise' ? (
        <SeriesFields
          series={step}
          name={exerciseName(step)}
          onChange={onChange}
        />
      ) : (
        <>
          {step.series.map((series) => (
            <div
              key={series.id}
              className="mt-3 rounded-xl border border-slate-700 p-3"
            >
              <SeriesFields
                series={series}
                name={exerciseName(series)}
                onChange={(updated) =>
                  onChange({
                    ...step,
                    series: step.series.map((entry) =>
                      entry.id === series.id ? updated : entry,
                    ),
                  })
                }
              />
              <button
                type="button"
                className="min-h-11 text-red-300"
                onClick={() =>
                  onChange({
                    ...step,
                    series: step.series.filter(
                      (entry) => entry.id !== series.id,
                    ),
                  })
                }
              >
                Удалить из суперсета
              </button>
            </div>
          ))}
        </>
      )}
      <RestSelect
        value={step.restPresetId}
        presets={presets}
        onChange={(restPresetId) => onChange({ ...step, restPresetId })}
      />
      {step.type === 'superset' ? (
        <button
          type="button"
          className="mt-3 min-h-11 text-lime-300"
          onClick={onAddExercise}
        >
          Добавить в суперсет
        </button>
      ) : null}
    </>
  )
}

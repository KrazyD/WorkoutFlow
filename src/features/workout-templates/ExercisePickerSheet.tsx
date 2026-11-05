import { useState } from 'react'
import { Link } from 'react-router-dom'
import type { Exercise } from '../../domain/workout-session'
import { BottomSheet } from '../../shared/BottomSheet'

export function ExercisePickerSheet({
  exercises,
  forSuperset,
  onChoose,
  onClose,
}: {
  readonly exercises: readonly Exercise[]
  readonly forSuperset: boolean
  readonly onChoose: (exercise: Exercise) => void
  readonly onClose: () => void
}) {
  const [query, setQuery] = useState('')
  const filtered = exercises.filter((exercise) =>
    exercise.name.toLowerCase().includes(query.trim().toLowerCase()),
  )
  return (
    <BottomSheet
      title={forSuperset ? 'Добавить в суперсет' : 'Выбор упражнения'}
      onClose={onClose}
    >
      <section aria-label="Выбор упражнения">
        <label className="block text-sm">
          Поиск упражнения
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="mt-2 min-h-12 w-full rounded-xl border border-slate-700 bg-slate-950 px-3"
          />
        </label>
        {exercises.length === 0 ? (
          <p className="mt-4 text-sm text-slate-300">
            Упражнения ещё не созданы.{' '}
            <Link to="/exercises" className="font-semibold text-lime-300">
              Перейти к упражнениям
            </Link>
          </p>
        ) : filtered.length ? (
          <ul className="mt-4 space-y-2">
            {filtered.map((exercise) => (
              <li key={exercise.id}>
                <button
                  type="button"
                  className="sheet-option"
                  onClick={() => onChoose(exercise)}
                >
                  {exercise.name}
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p role="status" className="mt-4 text-sm text-slate-400">
            Упражнения не найдены
          </p>
        )}
        <button type="button" className="mt-4 min-h-11 px-4" onClick={onClose}>
          Отмена
        </button>
      </section>
    </BottomSheet>
  )
}

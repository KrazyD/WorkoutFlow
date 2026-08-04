import { Link, Navigate, Route, Routes, useNavigate } from 'react-router-dom'
import {
  activeWorkoutSessionRepository as defaultActiveWorkoutSessionRepository,
  exerciseRepository as defaultExerciseRepository,
  restPresetRepository as defaultRestPresetRepository,
  workoutTemplateRepository as defaultWorkoutTemplateRepository,
  workoutDataBackupService as defaultWorkoutDataBackupService,
} from './db'
import { ExercisesScreen } from './features/exercises/ExercisesScreen'
import type { ExerciseRepository } from './features/exercises/exercise-repository'
import { RestPresetsScreen } from './features/rest-presets/RestPresetsScreen'
import type { RestPresetRepository } from './features/rest-presets/rest-preset-repository'
import { WorkoutTemplatesScreen } from './features/workout-templates/WorkoutTemplatesScreen'
import type { WorkoutTemplateRepository } from './features/workout-templates/workout-template-repository'
import { WorkoutSessionScreen } from './features/workout-session/WorkoutSessionScreen'
import type { ActiveWorkoutSessionRepository } from './features/workout-session/active-workout-session-repository'
import { DataBackupScreen } from './features/data-backup/DataBackupScreen'
import type { WorkoutDataBackupService } from './features/data-backup/workout-data-backup'

interface AppProps {
  readonly exerciseRepository?: ExerciseRepository
  readonly restPresetRepository?: RestPresetRepository
  readonly workoutTemplateRepository?: WorkoutTemplateRepository
  readonly activeWorkoutSessionRepository?: ActiveWorkoutSessionRepository
  readonly workoutDataBackupService?: WorkoutDataBackupService
}

export function App({
  exerciseRepository = defaultExerciseRepository,
  restPresetRepository = defaultRestPresetRepository,
  workoutTemplateRepository = defaultWorkoutTemplateRepository,
  activeWorkoutSessionRepository = defaultActiveWorkoutSessionRepository,
  workoutDataBackupService = defaultWorkoutDataBackupService,
}: AppProps) {
  const navigate = useNavigate()

  return (
    <Routes>
      <Route path="/" element={<Navigate to="/exercises" replace />} />
      <Route
        path="/exercises"
        element={<ExercisesScreen repository={exerciseRepository} />}
      />
      <Route
        path="/rest-presets"
        element={<RestPresetsScreen repository={restPresetRepository} />}
      />
      <Route
        path="/workouts"
        element={
          <WorkoutTemplatesScreen
            repository={workoutTemplateRepository}
            exerciseRepository={exerciseRepository}
            restPresetRepository={restPresetRepository}
            activeWorkoutSessionRepository={activeWorkoutSessionRepository}
            navigate={navigate}
          />
        }
      />
      <Route
        path="/settings/data"
        element={<DataBackupScreen service={workoutDataBackupService} />}
      />
      <Route
        path="/workout-session"
        element={
          <WorkoutSessionScreen
            repository={activeWorkoutSessionRepository}
            navigate={navigate}
          />
        }
      />
      <Route path="*" element={<NotFoundScreen />} />
    </Routes>
  )
}

function NotFoundScreen() {
  return (
    <main className="min-h-dvh bg-slate-950 px-4 py-12 text-slate-50">
      <div className="mx-auto max-w-xl text-center">
        <p className="text-xs font-semibold tracking-[0.2em] text-lime-300 uppercase">
          Workout Flow
        </p>
        <h1 className="mt-3 text-3xl font-bold">Страница не найдена</h1>
        <p className="mt-3 text-slate-400">
          Проверьте адрес или вернитесь к списку тренировок.
        </p>
        <Link
          to="/workouts"
          className="mt-6 inline-flex min-h-11 items-center rounded-xl bg-lime-300 px-5 py-2 font-semibold text-slate-950"
        >
          К тренировкам
        </Link>
      </div>
    </main>
  )
}

import { useEffect, useState } from 'react'
import {
  activeWorkoutSessionRepository as defaultActiveWorkoutSessionRepository,
  exerciseRepository as defaultExerciseRepository,
  restPresetRepository as defaultRestPresetRepository,
  workoutTemplateRepository as defaultWorkoutTemplateRepository,
} from './db'
import { ExercisesScreen } from './features/exercises/ExercisesScreen'
import type { ExerciseRepository } from './features/exercises/exercise-repository'
import { RestPresetsScreen } from './features/rest-presets/RestPresetsScreen'
import type { RestPresetRepository } from './features/rest-presets/rest-preset-repository'
import { WorkoutTemplatesScreen } from './features/workout-templates/WorkoutTemplatesScreen'
import type { WorkoutTemplateRepository } from './features/workout-templates/workout-template-repository'
import { WorkoutSessionScreen } from './features/workout-session/WorkoutSessionScreen'
import type { ActiveWorkoutSessionRepository } from './features/workout-session/active-workout-session-repository'

interface AppProps {
  readonly exerciseRepository?: ExerciseRepository
  readonly restPresetRepository?: RestPresetRepository
  readonly workoutTemplateRepository?: WorkoutTemplateRepository
  readonly activeWorkoutSessionRepository?: ActiveWorkoutSessionRepository
}

export function App({
  exerciseRepository = defaultExerciseRepository,
  restPresetRepository = defaultRestPresetRepository,
  workoutTemplateRepository = defaultWorkoutTemplateRepository,
  activeWorkoutSessionRepository = defaultActiveWorkoutSessionRepository,
}: AppProps) {
  const [path, setPath] = useState(window.location.pathname)

  useEffect(() => {
    const handleNavigation = () => setPath(window.location.pathname)
    window.addEventListener('popstate', handleNavigation)
    return () => window.removeEventListener('popstate', handleNavigation)
  }, [])

  const navigate = (nextPath: string) => {
    window.history.pushState({}, '', nextPath)
    setPath(nextPath)
  }

  if (path === '/workout-session') {
    return (
      <WorkoutSessionScreen
        repository={activeWorkoutSessionRepository}
        navigate={navigate}
      />
    )
  }

  if (path === '/workouts') {
    return (
      <WorkoutTemplatesScreen
        repository={workoutTemplateRepository}
        exerciseRepository={exerciseRepository}
        restPresetRepository={restPresetRepository}
        activeWorkoutSessionRepository={activeWorkoutSessionRepository}
        navigate={navigate}
      />
    )
  }

  if (path === '/rest-presets') {
    return <RestPresetsScreen repository={restPresetRepository} />
  }

  return <ExercisesScreen repository={exerciseRepository} />
}

import {
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

interface AppProps {
  readonly exerciseRepository?: ExerciseRepository
  readonly restPresetRepository?: RestPresetRepository
  readonly workoutTemplateRepository?: WorkoutTemplateRepository
}

export function App({
  exerciseRepository = defaultExerciseRepository,
  restPresetRepository = defaultRestPresetRepository,
  workoutTemplateRepository = defaultWorkoutTemplateRepository,
}: AppProps) {
  if (window.location.pathname === '/workouts') {
    return (
      <WorkoutTemplatesScreen
        repository={workoutTemplateRepository}
        exerciseRepository={exerciseRepository}
        restPresetRepository={restPresetRepository}
      />
    )
  }

  if (window.location.pathname === '/rest-presets') {
    return <RestPresetsScreen repository={restPresetRepository} />
  }

  return <ExercisesScreen repository={exerciseRepository} />
}

import {
  exerciseRepository as defaultExerciseRepository,
  restPresetRepository as defaultRestPresetRepository,
} from './db'
import { ExercisesScreen } from './features/exercises/ExercisesScreen'
import type { ExerciseRepository } from './features/exercises/exercise-repository'
import { RestPresetsScreen } from './features/rest-presets/RestPresetsScreen'
import type { RestPresetRepository } from './features/rest-presets/rest-preset-repository'

interface AppProps {
  readonly exerciseRepository?: ExerciseRepository
  readonly restPresetRepository?: RestPresetRepository
}

export function App({
  exerciseRepository = defaultExerciseRepository,
  restPresetRepository = defaultRestPresetRepository,
}: AppProps) {
  if (window.location.pathname === '/rest-presets') {
    return <RestPresetsScreen repository={restPresetRepository} />
  }

  return <ExercisesScreen repository={exerciseRepository} />
}

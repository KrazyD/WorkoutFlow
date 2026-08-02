import { exerciseRepository as defaultExerciseRepository } from './db'
import { ExercisesScreen } from './features/exercises/ExercisesScreen'
import type { ExerciseRepository } from './features/exercises/exercise-repository'

interface AppProps {
  readonly exerciseRepository?: ExerciseRepository
}

export function App({
  exerciseRepository = defaultExerciseRepository,
}: AppProps) {
  return <ExercisesScreen repository={exerciseRepository} />
}

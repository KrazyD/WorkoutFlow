import type { Exercise } from '../domain/workout-session'
import type {
  CreateExerciseInput,
  ExerciseRepository,
  UpdateExerciseInput,
} from '../features/exercises/exercise-repository'
import { createId } from '../shared/id/createId'
import type { WorkoutFlowDatabase } from './database'

export class ExerciseNotFoundError extends Error {
  constructor(id: string) {
    super(`Exercise with id "${id}" was not found.`)
    this.name = 'ExerciseNotFoundError'
  }
}

export class DexieExerciseRepository implements ExerciseRepository {
  constructor(
    private readonly database: WorkoutFlowDatabase,
    private readonly idFactory: () => string = createId,
  ) {}

  async getAll(): Promise<Exercise[]> {
    return this.database.exercises.orderBy('name').toArray()
  }

  async create(input: CreateExerciseInput): Promise<Exercise> {
    const exercise: Exercise = {
      id: this.idFactory(),
      name: input.name,
      ...(input.description ? { description: input.description } : {}),
    }

    await this.database.exercises.add(exercise)
    return exercise
  }

  async update(id: string, input: UpdateExerciseInput): Promise<Exercise> {
    const existing = await this.database.exercises.get(id)

    if (!existing) {
      throw new ExerciseNotFoundError(id)
    }

    const exercise: Exercise = {
      id,
      name: input.name,
      ...(input.description ? { description: input.description } : {}),
    }

    await this.database.exercises.put(exercise)
    return exercise
  }

  async remove(id: string): Promise<void> {
    await this.database.exercises.delete(id)
  }
}

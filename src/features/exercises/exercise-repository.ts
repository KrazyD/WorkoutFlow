import type { Exercise } from '../../domain/workout-session'

export interface CreateExerciseInput {
  readonly name: string
  readonly description?: string
}

export type UpdateExerciseInput = CreateExerciseInput

export interface ExerciseRepository {
  getAll(): Promise<Exercise[]>
  create(input: CreateExerciseInput): Promise<Exercise>
  update(id: string, input: UpdateExerciseInput): Promise<Exercise>
  remove(id: string): Promise<void>
}

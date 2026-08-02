import type {
  WorkoutTemplateRecord,
  WorkoutTemplateStep,
} from '../../domain/workout-template'

export interface CreateWorkoutTemplateInput {
  readonly name: string
  readonly steps: readonly WorkoutTemplateStep[]
}

export type UpdateWorkoutTemplateInput = CreateWorkoutTemplateInput

export interface WorkoutTemplateRepository {
  getAll(): Promise<WorkoutTemplateRecord[]>
  getById(id: string): Promise<WorkoutTemplateRecord | undefined>
  create(input: CreateWorkoutTemplateInput): Promise<WorkoutTemplateRecord>
  update(
    id: string,
    input: UpdateWorkoutTemplateInput,
  ): Promise<WorkoutTemplateRecord>
  remove(id: string): Promise<void>
}

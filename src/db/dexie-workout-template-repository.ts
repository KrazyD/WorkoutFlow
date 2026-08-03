import type { WorkoutTemplateRecord } from '../domain/workout-template'
import type {
  CreateWorkoutTemplateInput,
  UpdateWorkoutTemplateInput,
  WorkoutTemplateRepository,
} from '../features/workout-templates/workout-template-repository'
import { createId } from '../shared/id/createId'
import type { WorkoutFlowDatabase } from './database'

export class WorkoutTemplateNotFoundError extends Error {
  constructor(id: string) {
    super(`Workout template with id "${id}" was not found.`)
    this.name = 'WorkoutTemplateNotFoundError'
  }
}

export class DexieWorkoutTemplateRepository implements WorkoutTemplateRepository {
  constructor(
    private readonly database: WorkoutFlowDatabase,
    private readonly idFactory: () => string = createId,
  ) {}

  async getAll(): Promise<WorkoutTemplateRecord[]> {
    return this.database.workoutTemplates.orderBy('name').toArray()
  }

  async getById(id: string): Promise<WorkoutTemplateRecord | undefined> {
    return this.database.workoutTemplates.get(id)
  }

  async create(
    input: CreateWorkoutTemplateInput,
  ): Promise<WorkoutTemplateRecord> {
    const workoutTemplate = { id: this.idFactory(), ...input }
    await this.database.workoutTemplates.add(workoutTemplate)
    return workoutTemplate
  }

  async update(
    id: string,
    input: UpdateWorkoutTemplateInput,
  ): Promise<WorkoutTemplateRecord> {
    if (!(await this.database.workoutTemplates.get(id))) {
      throw new WorkoutTemplateNotFoundError(id)
    }

    const workoutTemplate = { id, ...input }
    await this.database.workoutTemplates.put(workoutTemplate)
    return workoutTemplate
  }

  async remove(id: string): Promise<void> {
    await this.database.workoutTemplates.delete(id)
  }
}

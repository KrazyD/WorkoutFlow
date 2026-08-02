import type { RestPreset } from '../domain/workout-session'
import type {
  CreateRestPresetInput,
  RestPresetRepository,
  UpdateRestPresetInput,
} from '../features/rest-presets/rest-preset-repository'
import type { WorkoutFlowDatabase } from './database'

export class RestPresetNotFoundError extends Error {
  constructor(id: string) {
    super(`Rest preset with id "${id}" was not found.`)
    this.name = 'RestPresetNotFoundError'
  }
}

export class DexieRestPresetRepository implements RestPresetRepository {
  constructor(
    private readonly database: WorkoutFlowDatabase,
    private readonly createId: () => string = () => crypto.randomUUID(),
  ) {}

  async getAll(): Promise<RestPreset[]> {
    return this.database.restPresets.orderBy('name').toArray()
  }

  async create(input: CreateRestPresetInput): Promise<RestPreset> {
    const restPreset: RestPreset = {
      id: this.createId(),
      name: input.name,
      durationSeconds: input.durationSeconds,
    }

    await this.database.restPresets.add(restPreset)
    return restPreset
  }

  async update(id: string, input: UpdateRestPresetInput): Promise<RestPreset> {
    const existing = await this.database.restPresets.get(id)

    if (!existing) {
      throw new RestPresetNotFoundError(id)
    }

    const restPreset: RestPreset = {
      id,
      name: input.name,
      durationSeconds: input.durationSeconds,
    }

    await this.database.restPresets.put(restPreset)
    return restPreset
  }

  async remove(id: string): Promise<void> {
    await this.database.restPresets.delete(id)
  }
}

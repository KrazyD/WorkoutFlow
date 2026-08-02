import type { RestPreset } from '../../domain/workout-session'

export interface CreateRestPresetInput {
  readonly name: string
  readonly durationSeconds: number
}

export type UpdateRestPresetInput = CreateRestPresetInput

export interface RestPresetRepository {
  getAll(): Promise<RestPreset[]>
  create(input: CreateRestPresetInput): Promise<RestPreset>
  update(id: string, input: UpdateRestPresetInput): Promise<RestPreset>
  remove(id: string): Promise<void>
}

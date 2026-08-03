import { useState } from 'react'

import type { WorkoutAudioService } from '../../shared/audio/workout-audio-service'
import type { WorkoutVibrationService } from '../../shared/vibration/workout-vibration-service'
import type {
  WorkoutFeedbackSettings,
  WorkoutFeedbackSettingsStore,
} from './workout-feedback-settings'

interface WorkoutFeedbackSettingsPanelProps {
  readonly settings: WorkoutFeedbackSettings
  readonly onChange: (settings: WorkoutFeedbackSettings) => void
  readonly store: WorkoutFeedbackSettingsStore
  readonly audioService: WorkoutAudioService
  readonly vibrationService: WorkoutVibrationService
}

export function WorkoutFeedbackSettingsPanel({
  settings,
  onChange,
  store,
  audioService,
  vibrationService,
}: WorkoutFeedbackSettingsPanelProps) {
  const [previewMessage, setPreviewMessage] = useState<string>()
  const vibrationSupported = vibrationService.isSupported()

  const update = (next: WorkoutFeedbackSettings) => {
    try {
      store.save(next)
      onChange(next)
    } catch (error) {
      console.warn('Could not save workout feedback settings.', error)
      setPreviewMessage('Не удалось сохранить настройки оповещений.')
    }
  }

  const previewSound = async () => {
    setPreviewMessage(undefined)
    const prepared = await audioService.prepare()
    const result = prepared.success
      ? await audioService.playRestFinishedSignal()
      : prepared
    if (!result.success) setPreviewMessage('Браузер не разрешил воспроизвести сигнал.')
  }

  const previewVibration = () => {
    setPreviewMessage(undefined)
    if (!vibrationService.vibrateRestFinished())
      setPreviewMessage('Не удалось включить вибрацию на этом устройстве.')
  }

  return (
    <section aria-labelledby="feedback-settings-title" className="mt-6 rounded-2xl border border-slate-800 bg-slate-900/80 p-5">
      <h2 id="feedback-settings-title" className="text-lg font-semibold">Оповещения</h2>
      <p className="mt-1 text-sm text-slate-400">Срабатывают при естественном окончании отдыха. В фоне браузер их не гарантирует.</p>
      <div className="mt-4 space-y-4">
        <div>
          <label className="flex min-h-11 items-center gap-3">
            <input type="checkbox" checked={settings.soundEnabled} onChange={(event) => update({ ...settings, soundEnabled: event.target.checked })} />
            <span>Звук после отдыха</span>
          </label>
          <button type="button" className="min-h-11 text-sm font-semibold text-lime-300" onClick={() => void previewSound()}>Проверить звук</button>
        </div>
        <div>
          <label className="flex min-h-11 items-center gap-3">
            <input type="checkbox" checked={settings.vibrationEnabled} disabled={!vibrationSupported} onChange={(event) => update({ ...settings, vibrationEnabled: event.target.checked })} />
            <span>Вибрация после отдыха</span>
          </label>
          {vibrationSupported ? (
            <button type="button" className="min-h-11 text-sm font-semibold text-lime-300" onClick={previewVibration}>Проверить вибрацию</button>
          ) : (
            <p className="text-sm text-slate-400">Вибрация не поддерживается на этом устройстве</p>
          )}
        </div>
      </div>
      {previewMessage ? <p role="status" className="mt-3 text-sm text-amber-300">{previewMessage}</p> : null}
    </section>
  )
}


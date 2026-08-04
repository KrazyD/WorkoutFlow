import { useRef, useState, type ChangeEvent } from 'react'

import { CatalogPageLayout, RepositoryErrorAlert } from '../../shared/catalog-ui'
import {
  ActiveWorkoutImportError,
  FeedbackSettingsImportError,
  MAX_IMPORT_FILE_SIZE_BYTES,
  downloadWorkoutFlowExport,
  type WorkoutDataBackupService,
  type WorkoutFlowExportV1,
} from './workout-data-backup'

interface DataBackupScreenProps {
  readonly service: WorkoutDataBackupService
  readonly download?: typeof downloadWorkoutFlowExport
}

const formatExportDate = (value: string): string =>
  new Intl.DateTimeFormat('ru-RU', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))

export function DataBackupScreen({
  service,
  download = downloadWorkoutFlowExport,
}: DataBackupScreenProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [preview, setPreview] = useState<WorkoutFlowExportV1>()
  const [error, setError] = useState<string>()
  const [success, setSuccess] = useState<string>()
  const [isBusy, setIsBusy] = useState(false)

  const exportData = async () => {
    setIsBusy(true)
    setError(undefined)
    setSuccess(undefined)
    try {
      download(await service.exportData())
      setSuccess('Резервная копия скачана')
    } catch (caught) {
      console.error('Workout data export failed.', caught)
      setError('Не удалось экспортировать данные. Попробуйте ещё раз.')
    } finally {
      setIsBusy(false)
    }
  }

  const selectFile = () => inputRef.current?.click()

  const handleFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    setPreview(undefined)
    setError(undefined)
    setSuccess(undefined)

    if (file.size > MAX_IMPORT_FILE_SIZE_BYTES) {
      setError('Файл слишком большой')
      return
    }

    let text: string
    try {
      text = await file.text()
    } catch (caught) {
      console.error('Workout data import file could not be read.', caught)
      setError('Не удалось прочитать файл')
      return
    }

    let input: unknown
    try {
      input = JSON.parse(text)
    } catch {
      setError('Файл не содержит корректный JSON')
      return
    }

    const validation = service.validateImport(input)
    if (!validation.success) {
      setError(validation.message)
      return
    }
    setPreview(validation.data)
  }

  const cancelImport = () => {
    setPreview(undefined)
    setError(undefined)
  }

  const confirmImport = async () => {
    if (!preview) return
    setIsBusy(true)
    setError(undefined)
    try {
      await service.importData(preview)
      setPreview(undefined)
      setSuccess('Данные успешно импортированы')
    } catch (caught) {
      console.error('Workout data import failed.', caught)
      if (caught instanceof ActiveWorkoutImportError)
        setError('Сначала завершите текущую тренировку')
      else if (caught instanceof FeedbackSettingsImportError)
        setError('Данные импортированы, но настройки оповещений сохранить не удалось')
      else setError('Не удалось импортировать данные. Текущие данные сохранены')
    } finally {
      setIsBusy(false)
    }
  }

  return (
    <CatalogPageLayout title="Резервная копия" actionLabel="Экспортировать" onAction={() => void exportData()}>
      {error ? <RepositoryErrorAlert message={error} /> : null}
      {success ? <p role="status" className="mt-5 rounded-xl border border-lime-800 bg-lime-950/50 px-4 py-3 text-sm text-lime-200">{success}</p> : null}

      <section className="mt-6 rounded-2xl border border-slate-800 bg-slate-900/80 p-5" aria-labelledby="backup-title">
        <h2 id="backup-title" className="text-lg font-semibold">Данные Workout Flow</h2>
        <p className="mt-2 text-sm leading-6 text-slate-400">Сохраните упражнения, варианты отдыха, тренировки и настройки оповещений в одном JSON-файле.</p>
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <button type="button" disabled={isBusy} onClick={() => void exportData()} className="min-h-11 rounded-xl bg-lime-300 px-4 py-2 font-semibold text-slate-950 disabled:opacity-50">Экспортировать данные</button>
          <button type="button" disabled={isBusy} onClick={selectFile} className="min-h-11 rounded-xl border border-slate-700 px-4 py-2 font-semibold disabled:opacity-50">Импортировать данные</button>
        </div>
        <input ref={inputRef} className="sr-only" type="file" accept="application/json,.json" onChange={(event) => void handleFile(event)} aria-label="Выбрать файл резервной копии" />
        <p className="mt-3 text-xs text-slate-500">Максимальный размер файла — 5 МБ.</p>
      </section>

      {preview ? (
        <section role="dialog" aria-modal="true" aria-labelledby="import-preview-title" className="mt-5 rounded-2xl border border-amber-800 bg-amber-950/30 p-5">
          <h2 id="import-preview-title" className="text-lg font-semibold">Проверка резервной копии</h2>
          <p className="mt-2 text-sm text-slate-300">Экспортировано: {formatExportDate(preview.exportedAt)}</p>
          <dl className="mt-4 space-y-2 text-sm">
            <div className="flex justify-between gap-4"><dt>Упражнений</dt><dd>{preview.data.exercises.length}</dd></div>
            <div className="flex justify-between gap-4"><dt>Вариантов отдыха</dt><dd>{preview.data.restPresets.length}</dd></div>
            <div className="flex justify-between gap-4"><dt>Тренировок</dt><dd>{preview.data.workoutTemplates.length}</dd></div>
            <div><dt>Настройки оповещений</dt><dd className="text-slate-400">Звук — {preview.data.feedbackSettings.soundEnabled ? 'включён' : 'выключен'}, вибрация — {preview.data.feedbackSettings.vibrationEnabled ? 'включена' : 'выключена'}</dd></div>
          </dl>
          <p className="mt-5 rounded-xl bg-amber-950/70 p-3 text-sm text-amber-100">Текущие упражнения, варианты отдыха и шаблоны тренировок будут заменены данными из файла.</p>
          <div className="mt-4 flex flex-col-reverse gap-3 sm:flex-row">
            <button type="button" disabled={isBusy} onClick={cancelImport} className="min-h-11 rounded-xl border border-slate-700 px-4 py-2 font-semibold">Отмена</button>
            <button type="button" disabled={isBusy} onClick={() => void confirmImport()} className="min-h-11 rounded-xl bg-amber-400 px-4 py-2 font-semibold text-slate-950 disabled:opacity-50">Импортировать и заменить</button>
          </div>
        </section>
      ) : null}
    </CatalogPageLayout>
  )
}

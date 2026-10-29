import { useId, useState } from 'react'
import type { WeightInputResult } from '../domain/working-weight'

interface NumericValueCardProps {
  readonly label: string
  readonly value: number | null | undefined
  readonly formattedValue: string
  readonly editLabel: string
  readonly inputLabel: string
  readonly saveLabel: string
  readonly inputMode: 'decimal' | 'numeric'
  readonly editing: boolean
  readonly disabled: boolean
  readonly parse: (input: string) => WeightInputResult
  readonly onEditingChange: (editing: boolean) => void
  readonly onSave: (value: number | null) => Promise<void>
  readonly saveError: string
}

export function NumericValueCard(props: NumericValueCardProps) {
  const [input, setInput] = useState('')
  const [error, setError] = useState<string>()
  const errorId = useId()
  return (
    <section
      aria-label={props.label}
      className={`value-card ${props.editing ? 'is-editing' : ''}`}
    >
      <h3 className="text-sm text-slate-400">{props.label}</h3>
      <p className="value-number">{props.formattedValue}</p>
      {props.editing ? (
        <form
          className="mt-3 space-y-3"
          onSubmit={(event) => {
            event.preventDefault()
            if (props.disabled) return
            const result = props.parse(input)
            if (!result.success) {
              setError(result.message)
              return
            }
            setError(undefined)
            void props
              .onSave(result.value)
              .then(() => props.onEditingChange(false))
              .catch(() => setError(props.saveError))
          }}
        >
          <label className="block text-sm">
            {props.inputLabel}
            <input
              autoFocus
              type="text"
              inputMode={props.inputMode}
              value={input}
              aria-invalid={Boolean(error)}
              aria-describedby={error ? errorId : undefined}
              className="mt-2 min-h-12 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 text-base"
              onChange={(event) => setInput(event.target.value)}
            />
          </label>
          {error ? (
            <p id={errorId} role="alert" className="text-sm text-red-300">
              {error}
            </p>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <button
              type="submit"
              disabled={props.disabled}
              className="value-save"
            >
              {props.saveLabel}
            </button>
            <button
              type="button"
              disabled={props.disabled}
              onClick={() => setInput('')}
            >
              Очистить
            </button>
            <button
              type="button"
              disabled={props.disabled}
              onClick={() => props.onEditingChange(false)}
            >
              Отмена
            </button>
          </div>
        </form>
      ) : (
        <button
          type="button"
          disabled={props.disabled}
          className="value-edit"
          aria-label={props.editLabel}
          onClick={() => {
            setInput(props.value?.toString().replace('.', ',') ?? '')
            setError(undefined)
            props.onEditingChange(true)
          }}
        >
          <span aria-hidden="true">✎ </span>
          Изменить
        </button>
      )}
    </section>
  )
}

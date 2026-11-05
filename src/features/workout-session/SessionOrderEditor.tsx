import { useId, useState } from 'react'
import { BottomSheet } from '../../shared/BottomSheet'
import {
  getSessionOrder,
  getSessionReorderBlocks,
  type ActiveWorkoutSession,
  type SessionOrder,
} from '../../domain/workout-session'
import { useOrderDrag } from './use-order-drag'

function moved<T>(items: readonly T[], from: number, to: number): T[] {
  const result = [...items]
  result.splice(to, 0, ...result.splice(from, 1))
  return result
}

export function SessionOrderEditor({
  session,
  busy,
  error,
  onClose,
  onApply,
}: {
  readonly session: ActiveWorkoutSession
  readonly busy: boolean
  readonly error?: string
  readonly onClose: () => void
  readonly onApply: (order: SessionOrder) => void
}) {
  // Keep a local plan: cancel never writes, and Apply revalidates against the
  // latest live session if a rest expired while this editor was open.
  const [source] = useState(session)
  const [order, setOrder] = useState(() => getSessionOrder(source))
  const [announcement, setAnnouncement] = useState('')
  const keyboardHelpId = useId()
  const blocks = getSessionReorderBlocks(source)
  const move = (group: string, id: string, target: string) => {
    if (busy) return
    setOrder((previous) => {
      if (group === 'blocks') {
        const from = previous.blocks.findIndex((block) => block.id === id)
        const to = previous.blocks.findIndex((block) => block.id === target)
        if (
          from < 0 ||
          to < 0 ||
          blocks.find((b) => b.id === id)?.pinned ||
          blocks.find((b) => b.id === target)?.pinned
        )
          return previous
        return { blocks: moved(previous.blocks, from, to) }
      }
      return {
        blocks: previous.blocks.map((block) => {
          if (`series:${block.id}` !== group) return block
          const from = block.seriesIds.indexOf(id)
          const to = block.seriesIds.indexOf(target)
          if (from < 0 || to < 0) return block
          return { ...block, seriesIds: moved(block.seriesIds, from, to) }
        }),
      }
    })
    setAnnouncement('Порядок изменён. Нажмите «Применить», чтобы сохранить.')
  }
  const { dragging, start, moveWithKeyboard } = useOrderDrag(move)
  const controls = (
    group: string,
    id: string,
    label: string,
    ids: readonly string[],
    locked = false,
  ) => (
    <button
      type="button"
      className="order-grip"
      disabled={busy || locked}
      aria-label={`Перетащить: ${label}`}
      aria-describedby={keyboardHelpId}
      aria-keyshortcuts="ArrowUp ArrowDown"
      title="Потяните, чтобы изменить порядок"
      onContextMenu={(event) => event.preventDefault()}
      onDragStart={(event) => event.preventDefault()}
      onPointerDown={(event) => start(event, group, id)}
      onKeyDown={(event) => moveWithKeyboard(event, group, id, ids)}
    >
      {group === 'blocks' ? (
        <svg
          aria-hidden="true"
          data-icon="move-vertical"
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="m8 7 4-4 4 4M12 3v18m-4-4 4 4 4-4" />
        </svg>
      ) : (
        <svg
          aria-hidden="true"
          data-icon="grip-vertical"
          width="22"
          height="22"
          viewBox="0 0 20 24"
          fill="currentColor"
        >
          {[6, 12, 18].flatMap((y) =>
            [7, 13].map((x) => (
              <circle key={`${x}-${y}`} cx={x} cy={y} r="1.6" />
            )),
          )}
        </svg>
      )}
    </button>
  )
  const futureIds = order.blocks
    .filter((b) => !blocks.find((item) => item.id === b.id)?.pinned)
    .map((b) => b.id)
  return (
    <BottomSheet
      title="Поменять порядок"
      busy={busy}
      fullScreen
      onClose={onClose}
      footer={
        <footer className="order-footer">
          {error ? <p role="alert">{error}</p> : null}
          <div>
            <button type="button" disabled={busy} onClick={onClose}>
              Отмена
            </button>
            <button
              type="button"
              className="order-apply"
              disabled={busy || !blocks.length || dragging !== null}
              onClick={() => onApply(order)}
            >
              {busy ? 'Сохранение…' : 'Применить'}
            </button>
          </div>
        </footer>
      }
    >
      <p className="order-help">Потяните за значок, чтобы изменить порядок.</p>
      <p id={keyboardHelpId} className="sr-only">
        С клавиатуры: выберите ручку клавишей Tab и меняйте порядок клавишами
        «Стрелка вверх» и «Стрелка вниз».
      </p>
      <p className="order-help">
        Текущий подход закреплён. Внутри суперсета меняется порядок всех
        оставшихся кругов; уже начатый подход остаётся на месте.
      </p>
      {session.currentStepIndex !== source.currentStepIndex ? (
        <p role="status" className="order-help">
          Тренировка перешла к следующему шагу. При применении порядок будет
          проверен повторно.
        </p>
      ) : null}
      {!blocks.length ? (
        <p role="status">
          В этой старой тренировке нет метаданных блоков для безопасной
          перестановки. Новая тренировка поддерживает редактор порядка.
        </p>
      ) : null}
      <ol className="order-blocks" aria-label="Оставшиеся блоки">
        {order.blocks.map((item) => {
          const block = blocks.find((b) => b.id === item.id)!
          const label = block.series
            .map((s) => s.step.exercise.name)
            .join(' + ')
          return (
            <li
              key={block.id}
              className={`order-block${dragging?.group === 'blocks' && dragging.id === block.id ? ' is-dragging' : ''}`}
              data-order-group="blocks"
              data-order-id={block.pinned ? undefined : block.id}
            >
              <div className="order-block-heading">
                <div>
                  <p className="order-kind">
                    {block.type === 'superset' ? 'Суперсет' : 'Одиночная серия'}
                  </p>
                  <h3>{label}</h3>
                </div>
                {controls('blocks', block.id, label, futureIds, block.pinned)}
              </div>
              {block.pinned ? (
                <p className="order-lock">
                  Закреплён: блок уже начат. Его нельзя переносить целиком.
                </p>
              ) : null}
              <ol className="order-series" aria-label={`Упражнения: ${label}`}>
                {item.seriesIds.map((id) => {
                  const series = block.series.find((s) => s.id === id)!
                  return (
                    <li
                      key={id}
                      data-order-group={`series:${block.id}`}
                      data-order-id={id}
                      className={
                        dragging?.group === `series:${block.id}` &&
                        dragging.id === id
                          ? 'is-dragging'
                          : ''
                      }
                    >
                      <div>
                        <p>{series.step.exercise.name}</p>
                        <small>
                          Осталось: {series.remainingSets} из{' '}
                          {series.step.set?.total} подходов
                        </small>
                      </div>
                      {block.type === 'superset'
                        ? controls(
                            `series:${block.id}`,
                            id,
                            series.step.exercise.name,
                            item.seriesIds,
                            series.remainingSets === 0,
                          )
                        : null}
                    </li>
                  )
                })}
              </ol>
            </li>
          )
        })}
      </ol>
      <p className="sr-only" role="status" aria-live="polite">
        {announcement ||
          (dragging
            ? 'Перетаскивание. Переместите ручку к нужной позиции.'
            : '')}
      </p>
    </BottomSheet>
  )
}

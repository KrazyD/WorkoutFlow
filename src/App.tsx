const plannedCapabilities = [
  'Справочник упражнений',
  'Настраиваемые интервалы отдыха',
  'Последовательности тренировок',
]

export function App() {
  return (
    <main className="min-h-dvh bg-slate-950 px-5 py-10 text-slate-50">
      <div className="mx-auto flex min-h-[calc(100dvh-5rem)] max-w-md flex-col justify-between">
        <section className="pt-14" aria-labelledby="page-title">
          <p className="mb-4 text-sm font-semibold tracking-[0.22em] text-lime-300 uppercase">
            Workout Flow
          </p>
          <h1
            id="page-title"
            className="text-4xl leading-tight font-bold tracking-tight"
          >
            Тренировка в своём ритме
          </h1>
          <p className="mt-5 text-lg leading-8 text-slate-300">
            Собирайте последовательность упражнений и отдыха, а приложение
            проведёт вас по каждому шагу.
          </p>

          <ul className="mt-10 space-y-3" aria-label="Возможности приложения">
            {plannedCapabilities.map((capability) => (
              <li
                key={capability}
                className="rounded-2xl border border-slate-800 bg-slate-900/70 px-5 py-4 text-slate-200"
              >
                {capability}
              </li>
            ))}
          </ul>
        </section>

        <p className="mt-12 text-sm text-slate-500">
          Основа готова. Продуктовые функции появятся в следующих версиях.
        </p>
      </div>
    </main>
  )
}

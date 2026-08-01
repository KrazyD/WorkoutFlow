import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { App } from './App'

describe('App', () => {
  it('renders the start page', () => {
    render(<App />)

    expect(
      screen.getByRole('heading', { name: 'Тренировка в своём ритме' }),
    ).toBeInTheDocument()
  })
})

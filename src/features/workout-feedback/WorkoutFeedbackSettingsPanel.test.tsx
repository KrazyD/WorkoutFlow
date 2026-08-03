import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import type { WorkoutAudioService } from '../../shared/audio/workout-audio-service'
import { WorkoutFeedbackSettingsPanel } from './WorkoutFeedbackSettingsPanel'

const audioService = (success = true): WorkoutAudioService => ({
  isSupported: () => true,
  prepare: vi.fn(async () => ({ success })),
  playRestFinishedSignal: vi.fn(async () => ({ success })),
})

describe('workout feedback settings panel', () => {
  it('shows accessible switches and explains unsupported vibration', () => {
    render(<WorkoutFeedbackSettingsPanel
      settings={{ soundEnabled: true, vibrationEnabled: true }}
      onChange={vi.fn()}
      store={{ load: vi.fn(), save: vi.fn() }}
      audioService={audioService()}
      vibrationService={{ isSupported: () => false, vibrateRestFinished: vi.fn() }}
    />)
    expect(screen.getByLabelText('Звук после отдыха')).toBeChecked()
    expect(screen.getByLabelText('Вибрация после отдыха')).toBeDisabled()
    expect(screen.getByText('Вибрация не поддерживается на этом устройстве')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Проверить вибрацию' })).not.toBeInTheDocument()
  })

  it('prepares and plays the same sound from a user click', async () => {
    const audio = audioService()
    render(<WorkoutFeedbackSettingsPanel
      settings={{ soundEnabled: true, vibrationEnabled: true }}
      onChange={vi.fn()}
      store={{ load: vi.fn(), save: vi.fn() }}
      audioService={audio}
      vibrationService={{ isSupported: () => true, vibrateRestFinished: vi.fn(() => true) }}
    />)
    fireEvent.click(screen.getByRole('button', { name: 'Проверить звук' }))
    await waitFor(() => expect(audio.prepare).toHaveBeenCalledOnce())
    expect(audio.playRestFinishedSignal).toHaveBeenCalledOnce()
  })

  it('shows understandable preview errors and triggers vibration preview', async () => {
    const vibrateRestFinished = vi.fn(() => true)
    render(<WorkoutFeedbackSettingsPanel
      settings={{ soundEnabled: true, vibrationEnabled: true }}
      onChange={vi.fn()}
      store={{ load: vi.fn(), save: vi.fn() }}
      audioService={audioService(false)}
      vibrationService={{ isSupported: () => true, vibrateRestFinished }}
    />)
    fireEvent.click(screen.getByRole('button', { name: 'Проверить звук' }))
    expect(await screen.findByRole('status')).toHaveTextContent('Браузер не разрешил')
    fireEvent.click(screen.getByRole('button', { name: 'Проверить вибрацию' }))
    expect(vibrateRestFinished).toHaveBeenCalledOnce()
  })
})


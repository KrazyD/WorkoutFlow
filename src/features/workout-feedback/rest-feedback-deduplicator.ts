export const REST_FEEDBACK_DEDUPLICATION_KEY = 'workout-flow.last-rest-feedback.v1'

export interface RestFeedbackDeduplicator {
  markOnce(key: string): boolean
}

export const createRestFeedbackDeduplicator = (
  storage: Pick<Storage, 'getItem' | 'setItem'>,
): RestFeedbackDeduplicator => ({
  markOnce: (key) => {
    try {
      if (storage.getItem(REST_FEEDBACK_DEDUPLICATION_KEY) === key) return false
      storage.setItem(REST_FEEDBACK_DEDUPLICATION_KEY, key)
      return true
    } catch {
      return true
    }
  },
})

export const restFeedbackDeduplicator = createRestFeedbackDeduplicator(localStorage)


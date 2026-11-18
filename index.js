const { eventChannel, buffers } = require('redux-saga')

// Buffers items. Flushes when `limit` is reached, or on a later turn
// (`turn` milliseconds, default 0) while the count is still below the limit.
function createBatch (opts = {}) {
  const limit = opts.limit == null ? null : opts.limit
  const turn = opts.turn == null ? 0 : opts.turn
  const emit = opts.emit
  let items = []
  let timer = null

  const flush = () => {
    if (timer != null) {
      clearTimeout(timer)
      timer = null
    }
    if (items.length === 0) return null
    const batch = items
    items = []
    if (emit) emit(batch)
    return batch
  }

  return {
    push (item) {
      items.push(item)
      if (limit != null && items.length >= limit) return flush()
      if (timer == null) timer = setTimeout(flush, turn)
      return null
    },
    flush,
    cancel () {
      if (timer != null) clearTimeout(timer)
      timer = null
      items = []
    }
  }
}

// Batches push events from a bare-rpc client emitter so a burst becomes
// one Redux update. `channel.close()` unsubscribes, which `fork` / `cancel` uses.
function createRpcEventChannel (emitter, opts = {}) {
  const batchMs = opts.batchMs == null ? 50 : opts.batchMs

  return eventChannel((emit) => {
    const batch = createBatch({ turn: batchMs, emit })

    const onEvent = (event) => {
      batch.push(event)
    }

    emitter.on('event', onEvent)

    return () => {
      emitter.removeListener('event', onEvent)
      batch.cancel()
    }
  }, buffers.expanding(64))
}

module.exports = { createRpcEventChannel, createBatch }

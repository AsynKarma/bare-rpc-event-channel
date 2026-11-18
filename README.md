# bare-rpc-event-channel

CommonJS (`require`) adapter that turns a bare-rpc push stream into a Redux-Saga `eventChannel`.

bare-rpc itself is request/reply. The client in keet-lite listens for pushed replies and emits them on an emitter (`emitter.emit('event', payload)`). This package subscribes to that emitter. It does not open a socket and it does not import `bare-rpc`. The only runtime dependency is `redux-saga`.

`channel.close()` removes the listener. A saga `fork` / `cancel` reaches that unsubscribe path through `finally`.

## API

```js
const { call, put, take } = require('redux-saga/effects')
const { createRpcEventChannel } = require('bare-rpc-event-channel')

function * eventsSaga (emitter) {
  const channel = yield call(createRpcEventChannel, emitter, { batchMs: 50 })
  try {
    while (true) {
      const batch = yield take(channel)
      yield put({ type: 'chat/eventsReceived', payload: batch })
    }
  } finally {
    channel.close()
  }
}
```

`createRpcEventChannel(emitter, opts)` returns a saga `eventChannel`. The emitter must implement `on('event', fn)` and `removeListener('event', fn)`. `opts.batchMs` defaults to `50`. Events that arrive inside that window are one batch. `channel.close()` drops a batch that has not flushed.

`createBatch({ limit, turn, emit })` buffers items. It flushes when `limit` items are queued, or on a later turn (`turn` milliseconds, default `0`) when the count is still below the limit. `cancel()` drops a pending batch.

## Tests

```sh
npm test
```

`npm test` runs `standard`, then `brittle` on Node.

## License

Apache-2.0

const test = require('brittle')
const { END } = require('redux-saga')
const { createBatch, createRpcEventChannel } = require('./index.js')

test('a fake emitter yields one batch', async (t) => {
  const emitter = fakeEmitter()
  const channel = createRpcEventChannel(emitter, { batchMs: 20 })
  const received = []

  t.teardown(() => channel.close())
  takeAll(channel, received)

  emitter.emit('event', { type: 'message', message: { text: 'a' } })
  emitter.emit('event', { type: 'message', message: { text: 'b' } })
  await delay(40)

  t.alike(received, [[
    { type: 'message', message: { text: 'a' } },
    { type: 'message', message: { text: 'b' } }
  ]])
})

test('close unsubscribes and stops delivery', async (t) => {
  const emitter = fakeEmitter()
  const channel = createRpcEventChannel(emitter, { batchMs: 20 })
  const received = []

  takeAll(channel, received)
  emitter.emit('event', { type: 'message', message: { text: 'a' } })
  t.is(emitter.count(), 1)

  channel.close()
  t.is(emitter.count(), 0)

  emitter.emit('event', { type: 'message', message: { text: 'b' } })
  await delay(40)
  t.is(received.length, 0)
})

test('events after close are not delivered', async (t) => {
  const emitter = fakeEmitter()
  const channel = createRpcEventChannel(emitter, { batchMs: 20 })
  const received = []

  t.teardown(() => channel.close())
  takeAll(channel, received)

  emitter.emit('event', { type: 'peer', peer: { remotePublicKey: 'p1' } })
  await delay(40)
  t.is(received.length, 1)

  channel.close()
  emitter.emit('event', { type: 'peer', peer: { remotePublicKey: 'p2' } })
  await delay(40)
  t.is(received.length, 1)
  t.alike(received[0], [{ type: 'peer', peer: { remotePublicKey: 'p1' } }])
})

test('batch helper flushes on a count or a turn', async (t) => {
  const counted = []
  const byCount = createBatch({
    limit: 2,
    turn: 20,
    emit: (batch) => counted.push(batch)
  })
  const turned = []
  const byTurn = createBatch({
    limit: 10,
    turn: 20,
    emit: (batch) => turned.push(batch)
  })

  t.teardown(() => {
    byCount.cancel()
    byTurn.cancel()
  })

  byCount.push({ n: 1 })
  t.is(counted.length, 0)
  byCount.push({ n: 2 })
  t.alike(counted, [[{ n: 1 }, { n: 2 }]])

  byTurn.push({ n: 1 })
  byTurn.push({ n: 2 })
  t.is(turned.length, 0)
  await delay(40)
  t.alike(turned, [[{ n: 1 }, { n: 2 }]])

  await delay(40)
  t.is(counted.length, 1)
})

function takeAll (channel, received) {
  const next = () => {
    channel.take((batch) => {
      if (batch === END) return
      received.push(batch)
      next()
    })
  }
  next()
}

function fakeEmitter () {
  const listeners = new Set()
  return {
    on (name, fn) {
      if (name === 'event') listeners.add(fn)
    },
    removeListener (name, fn) {
      listeners.delete(fn)
    },
    emit (name, event) {
      if (name !== 'event') return
      for (const fn of [...listeners]) fn(event)
    },
    count () {
      return listeners.size
    }
  }
}

function delay (ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

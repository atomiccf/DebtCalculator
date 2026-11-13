import test, { after, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'
import { createElement } from 'react'
import { create, act } from 'react-test-renderer'
import { createServer } from 'vite'

const vite = await createServer({
  root: fileURLToPath(new URL('..', import.meta.url)),
  configFile: fileURLToPath(new URL('../vite.config.ts', import.meta.url)),
  server: { middlewareMode: true, hmr: false, watch: null },
  optimizeDeps: { noDiscovery: true, include: [] },
})
const { apiRequest, DEFAULT_API_TIMEOUT_MS } = await vite.ssrLoadModule('/src/api/client.ts')
const { ApiError } = await vite.ssrLoadModule('/src/api/errors.ts')
const { useApi } = await vite.ssrLoadModule('/src/hooks/useApi.ts')
const { ContractValidationError } = await vite.ssrLoadModule('/@fs/' + fileURLToPath(new URL('../../shared/src/index.ts', import.meta.url)).replaceAll('\\', '/'))
const originalFetch = globalThis.fetch
const issues = [{ path: 'documents.1.debt', message: 'Введите положительную сумму' }]
let renderer
let hook

afterEach(async () => {
  if (renderer) await act(async () => renderer.unmount())
  renderer = undefined
  globalThis.fetch = originalFetch
})
after(() => vite.close())

const json = (data, status = 200) => new Response(JSON.stringify(data), { status })
function deferredFetch({ ignoreAbort = false } = {}) {
  const requests = []
  globalThis.fetch = (url, options) => new Promise((resolve, reject) => {
    requests.push({ url, ...options, resolve, reject })
    if (!ignoreAbort) options.signal.addEventListener('abort', () => reject(options.signal.reason), { once: true })
  })
  return requests
}
async function mount(options = {}) {
  function Harness(props) {
    hook = useApi('/api/test', 'POST', props)
    return null
  }
  await act(async () => { renderer = create(createElement(Harness, options)) })
  return options => act(async () => renderer.update(createElement(Harness, options)))
}
async function start(body) {
  let pending
  await act(async () => { pending = hook.execute(body) })
  return { pending }
}

test('transport validates and serializes the parsed body; GET has no body', async () => {
  const calls = []
  globalThis.fetch = async (url, options) => {
    calls.push({ url, ...options })
    return json({ result: 10 })
  }
  assert.deepEqual(await apiRequest('/api/test', { body: { value: '10' }, schema: { parse: body => ({ value: Number(body.value) }) } }), { result: 10 })
  assert.ok(calls[0].url.endsWith('/api/test'))
  assert.equal(calls[0].method, 'POST')
  assert.equal(calls[0].body, '{"value":10}')
  assert.equal(calls[0].headers['Content-Type'], 'application/json')
  await apiRequest('/api/test', { method: 'GET' })
  assert.equal(calls[1].body, undefined)
  assert.equal(calls[1].method, 'GET')
})

test('local validation preserves issues and never sends a request', async () => {
  let calls = 0
  globalThis.fetch = async () => { calls++; return json({}) }
  await assert.rejects(apiRequest('/api/test', { schema: { parse() { throw new ContractValidationError(issues) } } }), error => {
    assert.ok(error instanceof ApiError)
    assert.equal(error.kind, 'validation')
    assert.deepEqual(error.issues, issues)
    return true
  })
  assert.equal(calls, 0)
})

test('HTTP errors preserve status and structured server issues', async () => {
  globalThis.fetch = async () => json({ error: 'Некорректный запрос', issues }, 400)
  await assert.rejects(apiRequest('/api/test'), error => {
    assert.ok(error instanceof ApiError)
    assert.equal(error.kind, 'http')
    assert.equal(error.status, 400)
    assert.equal(error.message, 'Некорректный запрос')
    assert.deepEqual(error.issues, issues)
    return true
  })
})

test('malformed HTTP error bodies fall back safely and filter invalid issues', async () => {
  for (const body of ['<html>Bad Gateway</html>', 'null', '{"error":42,"issues":[null,1,{}, {"path":"x","message":3}]}']) {
    globalThis.fetch = async () => new Response(body, { status: 502 })
    await assert.rejects(apiRequest('/api/test'), error => error.kind === 'http' && error.status === 502 && error.message === 'Ошибка расчёта' && error.issues.length === 0)
  }
  globalThis.fetch = async () => json({ error: 'Ошибка', issues: [null, ...issues] }, 400)
  await assert.rejects(apiRequest('/api/test'), error => {
    assert.deepEqual(error.issues, issues)
    return true
  })
})

test('invalid success JSON and connection failures have distinct errors', async () => {
  globalThis.fetch = async () => new Response('invalid JSON')
  await assert.rejects(apiRequest('/api/test'), error => error.kind === 'invalid-response')
  globalThis.fetch = async () => { throw new TypeError('Failed to fetch') }
  await assert.rejects(apiRequest('/api/test'), error => error.kind === 'network' && error.message.includes('Ошибка соединения'))
})

test('transport supports already aborted and active caller signals', async () => {
  const requests = deferredFetch()
  const controller = new AbortController()
  controller.abort()
  await assert.rejects(apiRequest('/api/test', { signal: controller.signal }), error => error.kind === 'aborted')
  assert.equal(requests.length, 0)

  const active = new AbortController()
  const pending = apiRequest('/api/test', { signal: active.signal })
  const rejected = assert.rejects(pending, error => error.kind === 'aborted')
  active.abort()
  await rejected
  assert.equal(requests[0].signal.aborted, true)
})

test('default timeout aborts a stalled fetch', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] })
  const requests = deferredFetch()
  const pending = apiRequest('/api/test')
  const rejected = assert.rejects(pending, error => error.kind === 'timeout')
  t.mock.timers.tick(DEFAULT_API_TIMEOUT_MS)
  await rejected
  assert.equal(requests[0].signal.aborted, true)
})

test('timeout includes reading the response body', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] })
  globalThis.fetch = async (_url, { signal }) => ({
    ok: true,
    json: () => new Promise((_resolve, reject) => signal.addEventListener('abort', () => reject(signal.reason), { once: true })),
  })
  const pending = apiRequest('/api/test', { timeoutMs: 100 })
  const rejected = assert.rejects(pending, error => error.kind === 'timeout')
  await Promise.resolve()
  t.mock.timers.tick(100)
  await rejected
})

test('completed requests clear the timeout and caller abort listener', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] })
  const controller = new AbortController()
  const removed = t.mock.method(controller.signal, 'removeEventListener')
  let requestSignal
  globalThis.fetch = async (_url, { signal }) => { requestSignal = signal; return json({}) }
  await apiRequest('/api/test', { signal: controller.signal })
  assert.equal(removed.mock.calls.length, 1)
  controller.abort()
  t.mock.timers.tick(DEFAULT_API_TIMEOUT_MS)
  assert.equal(requestSignal.aborted, false)
})

test('hook exposes issues and error details, then clears them on success', async () => {
  const errors = []
  const successes = []
  await mount({ onError: (...args) => errors.push(args), onSuccess: data => successes.push(data) })
  globalThis.fetch = async () => json({ error: 'Ошибка ввода', issues }, 400)
  await act(async () => { assert.equal(await hook.execute(), null) })
  assert.equal(hook.error, 'Ошибка ввода')
  assert.deepEqual(hook.issues, issues)
  assert.equal(hook.loading, false)
  assert.deepEqual(errors[0][1].issues, issues)
  assert.equal(errors[0][0], hook.error)
  globalThis.fetch = async () => json({ total: 10 })
  await act(async () => { assert.deepEqual(await hook.execute(), { total: 10 }) })
  assert.deepEqual(hook.issues, [])
  assert.equal(hook.error, '')
  assert.deepEqual(successes, [{ total: 10 }])
})

test('timeout releases hook loading and allows retry', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] })
  const errors = []
  await mount({ timeoutMs: 100, onError: (_message, details) => errors.push(details.kind) })
  deferredFetch()
  const { pending } = await start()
  assert.equal(hook.loading, true)
  await act(async () => { t.mock.timers.tick(100); assert.equal(await pending, null) })
  assert.equal(hook.loading, false)
  assert.match(hook.error, /Время ожидания/)
  assert.deepEqual(errors, ['timeout'])
  globalThis.fetch = async () => json({ total: 20 })
  await act(async () => { await hook.execute() })
  assert.deepEqual(hook.data, { total: 20 })
  assert.equal(hook.error, '')
})

test('superseded responses and failures cannot change state or invoke callbacks', async () => {
  const successes = []
  const errors = []
  await mount({ onSuccess: data => successes.push(data), onError: error => errors.push(error) })
  const requests = deferredFetch({ ignoreAbort: true })
  const first = await start()
  const second = await start()
  assert.equal(requests[0].signal.aborted, true)
  await act(async () => { requests[0].resolve(json({ total: 1 })); assert.equal(await first.pending, null) })
  assert.equal(hook.loading, true)
  assert.equal(hook.data, null)
  await act(async () => { requests[1].resolve(json({ total: 2 })); await second.pending })
  const third = await start()
  const fourth = await start()
  await act(async () => { requests[3].resolve(json({ total: 4 })); await fourth.pending })
  await act(async () => { requests[2].reject(new Error('Late failure')); assert.equal(await third.pending, null) })
  assert.deepEqual(hook.data, { total: 4 })
  assert.equal(hook.loading, false)
  assert.deepEqual(successes, [{ total: 2 }, { total: 4 }])
  assert.deepEqual(errors, [])
})

test('cancel, reset and unmount abort pending work without callbacks', async () => {
  for (const action of ['cancel', 'reset', 'unmount']) {
    const callbacks = []
    await mount({ onSuccess: () => callbacks.push('success'), onError: () => callbacks.push('error') })
    const requests = deferredFetch({ ignoreAbort: true })
    const { pending } = await start()
    await act(async () => action === 'unmount' ? renderer.unmount() : hook[action]())
    assert.equal(requests[0].signal.aborted, true)
    if (action !== 'unmount') {
      assert.equal(hook.loading, false)
      assert.equal(hook.error, '')
    }
    await act(async () => { requests[0].resolve(json({ total: 10 })); assert.equal(await pending, null) })
    assert.deepEqual(callbacks, [])
    assert.equal(hook.data, null)
    await act(async () => renderer.unmount())
    renderer = undefined
  }
})

test('result keeps the submitted input key when inputs change during a request', async () => {
  const update = await mount({ inputKey: 'before' })
  const requests = deferredFetch()
  const { pending } = await start()
  await update({ inputKey: 'after' })
  await act(async () => { requests[0].resolve(json({ total: 10 })); await pending })
  assert.equal(hook.resultKey, 'before')
  assert.equal(hook.stale, true)
})

test('a callback exception is not reported as an API error', async () => {
  const errors = []
  const failure = new Error('Callback failed')
  await mount({ onSuccess() { throw failure }, onError: message => errors.push(message) })
  globalThis.fetch = async () => json({ total: 10 })
  await act(async () => { await assert.rejects(hook.execute(), error => error === failure) })
  assert.deepEqual(hook.data, { total: 10 })
  assert.equal(hook.loading, false)
  assert.deepEqual(errors, [])
})

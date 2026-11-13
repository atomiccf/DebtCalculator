import test, { after, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'
import { createElement } from 'react'
import { create, act } from 'react-test-renderer'
import { createServer } from 'vite'

const root = fileURLToPath(new URL('..', import.meta.url))
const previousApiUrl = process.env.VITE_API_URL
const previousProxyTarget = process.env.API_PROXY_TARGET
process.env.VITE_API_URL = 'https://api.example.test///'
process.env.API_PROXY_TARGET = 'http://api-internal:3000'
const vite = await createServer({
  root,
  configFile: fileURLToPath(new URL('../vite.config.ts', import.meta.url)),
  server: { middlewareMode: true, hmr: false, watch: null },
  optimizeDeps: { noDiscovery: true, include: [] },
})
const load = path => vite.ssrLoadModule(path)
const { default: DutyCalculator } = await load('/src/components/DutyCalculator.tsx')
const { default: PenaltyCalculator } = await load('/src/components/PenaltyCalculator.tsx')
const { default: Interest366Calculator } = await load('/src/components/Interest366Calculator.tsx')
const { parseNumericInput } = await load('/src/utils/numericInput.ts')
const api = await load('/@fs/' + fileURLToPath(new URL('../../shared/src/index.ts', import.meta.url)).replaceAll('\\', '/'))
const originalFetch = globalThis.fetch
const calls = []
let renderer
let deferResponse

beforeEach(() => {
  calls.length = 0
  deferResponse = undefined
  globalThis.fetch = async (url, options) => {
    assert.ok(url.startsWith('https://api.example.test/api/'), url)
    if (options.method === 'GET') return { ok: true, json: async () => ({ common: api.getCaseTypesList(), economic: api.getEconomicCaseTypesList() }) }
    const request = JSON.parse(options.body)
    const call = { url, request }
    calls.push(call)
    try {
      call.response = url.endsWith('/duty/calculate') ? api.calculateDutyRequest(request)
        : url.endsWith('/penalty/calculate-multiple') ? api.calculatePenaltyMultipleRequest(request)
          : api.calculateInterest366MultipleRequest(request)
    } catch (error) {
      call.error = error.message
    }
    if (deferResponse) await deferResponse
    return { ok: !call.error, json: async () => call.error ? { error: call.error } : call.response }
  }
})

after(async () => {
  if (renderer) await act(async () => renderer.unmount())
  globalThis.fetch = originalFetch
  if (previousApiUrl === undefined) delete process.env.VITE_API_URL
  else process.env.VITE_API_URL = previousApiUrl
  if (previousProxyTarget === undefined) delete process.env.API_PROXY_TARGET
  else process.env.API_PROXY_TARGET = previousProxyTarget
  await vite.close()
})

async function mount(Component) {
  await act(async () => {
    renderer?.unmount()
    renderer = create(createElement(Component))
  })
}
function field(label) {
  const wrapper = renderer.root.findAllByType('label').find(node => node.children.includes(label))
  assert.ok(wrapper, `Field: ${label}`)
  return wrapper.find(node => node.type === 'input' || node.type === 'select')
}
async function change(node, value) {
  await act(async () => node.props.onChange({ target: { value, checked: value } }))
}
const set = (label, value) => change(field(label), value)
const options = label => field(label).findAllByType('option').map(node => node.props.value).filter(Boolean)
const text = () => JSON.stringify(renderer.toJSON())
async function submit() {
  const count = calls.length
  await act(async () => renderer.root.findByType('form').props.onSubmit({ preventDefault() {} }))
  assert.equal(calls.length, count + 1, text())
  assert.equal(calls.at(-1).error, undefined)
  return calls.at(-1)
}
async function fillDocument(index = 1, debt = '1000,50') {
  for (const [name, value] of [['название', `Договор ${index}`], ['сумма (BYN)', debt], ['первый день просрочки', '2026-05-01'], ['последний день просрочки', '2026-05-31']]) {
    await change(renderer.root.findByProps({ 'aria-label': `Документ ${index}: ${name}` }), value)
  }
}

test('API origin and development proxy target are configurable', async () => {
  const { API_URL } = await load('/src/config/api.ts')
  assert.equal(API_URL, 'https://api.example.test')
  assert.equal(vite.config.server.proxy['/api'].target, 'http://api-internal:3000')
})

test('decimal input accepts a complete comma or dot value and rejects partial numbers', () => {
  for (const value of ['123.45', '123,45', ' 123,45 ']) assert.equal(parseNumericInput(value, true), 123.45)
  assert.equal(parseNumericInput(',50', true), 0.5)
  assert.equal(parseNumericInput('0'), 0)
  assert.equal(parseNumericInput('0,0001'), 0.0001)
  for (const value of ['', ' ', '12abc', '1,2.3', '1 000', '1e3', '0x10', 'Infinity', '-1', '1,', '1.234', '99999999999999.999', '90071992547409.91', '9007199254740992']) {
    assert.ok(Number.isNaN(parseNumericInput(value, true)), value)
  }
})

test('every offered duty case and original-claim combination can be submitted', async t => {
  await mount(DutyCalculator)
  for (const court of options('Тип суда')) {
    await set('Тип суда', court)
    for (const plaintiff of options('Тип заявителя')) {
      await set('Тип заявителя', plaintiff)
      await set('Дата обращения в суд', '2026-11-13')
      for (const caseType of options('Тип заявления')) {
        await set('Тип заявления', caseType)
        if (['property', 'property_quality', 'court_order'].includes(caseType)) await set('Сумма требования (BYN)', '1000,50')
        if (caseType === 'administrative') await set('Размер штрафа (BYN)', '100,25')
        if (['appeal', 'cassation', 'supervision'].includes(caseType)) {
          await set('Характер жалобы', 'property')
          await set('Оспариваемая сумма (BYN)', '1000.50')
          await submit()
          await set('Характер жалобы', 'original')
          for (const original of options('Исходное требование')) {
            await set('Исходное требование', original)
            if (original === 'administrative') await set('Размер штрафа (BYN)', '100,25')
            if (court !== 'common') {
              for (const level of options('Суд исходного требования')) {
                await set('Суд исходного требования', level)
                const call = await submit()
                assert.equal(call.request.originalCourtLevel, level)
                assert.equal(call.request.amount, undefined)
              }
            } else await submit()
          }
        } else await submit()
      }
    }
  }
  t.diagnostic(`Submitted ${calls.length} duty scenarios through the form`)
})

test('duty preserves administrative and repeated-divorce options in direct and original claims', async () => {
  await mount(DutyCalculator)
  await set('Дата обращения в суд', '2026-11-13')
  for (const original of [false, true]) {
    await set('Тип заявления', original ? 'cassation' : 'administrative')
    if (original) {
      await set('Характер жалобы', 'original')
      await set('Исходное требование', 'administrative')
    }
    await set('Административное взыскание', 'fine')
    await set('Размер штрафа (BYN)', '100,25')
    assert.equal((await submit()).request.fineAmount, 100.25)
    await set('Административное взыскание', 'other')
    assert.equal((await submit()).request.fineAmount, undefined)
    assert.match(text(), /Предупреждения/)
    await set('Тип заявления', original ? 'cassation' : 'divorce')
    if (original) await set('Исходное требование', 'divorce')
    await change(renderer.root.findByProps({ type: 'checkbox' }), true)
    assert.equal((await submit()).request.isRepeated, true)
  }
})

test('money remains text and invalid amounts never reach the API', async () => {
  for (const Component of [DutyCalculator, PenaltyCalculator, Interest366Calculator]) {
    await mount(Component)
    if (Component !== DutyCalculator) {
      await fillDocument()
      if (Component === PenaltyCalculator) await set('Размер пени, % в день', '0,01')
    }
    for (const value of ['12,', '12abc', '1.234', '0', '1e3']) {
      const input = Component === DutyCalculator ? field('Сумма требования (BYN)')
        : renderer.root.findByProps({ 'aria-label': 'Документ 1: сумма (BYN)' })
      await change(input, value)
      assert.equal((Component === DutyCalculator ? field('Сумма требования (BYN)')
        : renderer.root.findByProps({ 'aria-label': 'Документ 1: сумма (BYN)' })).props.value, value)
      const count = calls.length
      await act(async () => renderer.root.findByType('form').props.onSubmit({ preventDefault() {} }))
      assert.equal(calls.length, count)
      assert.match(text(), /положительную сумму/)
    }
  }
})

test('penalty requires a positive daily amount, reports zero and adds/removes documents', async () => {
  await mount(PenaltyCalculator)
  await fillDocument()
  assert.equal(field('Размер пени, % в день').props.required, true)
  await act(async () => renderer.root.findByType('form').props.onSubmit({ preventDefault() {} }))
  assert.equal(calls.length, 0)
  for (const value of ['0', '0,0', '0.0000', '-0.1', 'abc']) {
    await set('Размер пени, % в день', value)
    await act(async () => renderer.root.findByType('form').props.onSubmit({ preventDefault() {} }))
    assert.equal(calls.length, 0)
    assert.equal(renderer.root.findAllByType('div').find(node => node.children.includes('введите корректный размер пени')).children[0], 'введите корректный размер пени')
  }
  await set('Размер пени, % в день', '0,0001')
  assert.doesNotMatch(text(), /введите корректный размер пени/)
  assert.equal((await submit()).request.rate, 0.0001)
  assert.match(text(), /Размер пени:/)
  await act(async () => renderer.root.findAllByType('button').find(node => node.children.includes('+ Добавить документ')).props.onClick())
  assert.match(text(), /Результат устарел/)
  await fillDocument(2, '200.75')
  assert.equal((await submit()).response.results.length, 2)
  await act(async () => renderer.root.findAllByProps({ title: 'Удалить документ' })[0].props.onClick())
  assert.match(text(), /Результат устарел/)
  assert.equal((await submit()).request.documents[0].debt, 200.75)
})

test('Article 366 selects the rate on each document end date without extra fields', async () => {
  await mount(Interest366Calculator)
  assert.doesNotMatch(text(), /Дата ставки рефинансирования|Основание расчёта|Другая ставка по договору или законодательству|Годовая ставка \(%\)|Установлена неустойка|Установлено законодательное исключение/)
  await fillDocument(1, '100000')
  await change(renderer.root.findByProps({ 'aria-label': 'Документ 1: первый день просрочки' }), '2026-05-31')
  await act(async () => renderer.root.findAllByType('button').find(node => node.children.includes('+ Добавить документ')).props.onClick())
  await fillDocument(2, '100000')
  await change(renderer.root.findByProps({ 'aria-label': 'Документ 2: первый день просрочки' }), '2026-05-31')
  await change(renderer.root.findByProps({ 'aria-label': 'Документ 2: последний день просрочки' }), '2026-06-01')
  const call = await submit()
  assert.equal(call.request.rateDate, undefined)
  assert.equal(call.request.calculationBasis, 'estimate')
  assert.equal(call.request.dayCount, 'actual/actual')
  assert.equal(call.request.hasPenalty, false)
  assert.equal(call.request.statutoryException, undefined)
  assert.equal(call.request.refinancingRate, undefined)
  assert.deepEqual(call.response.results.map(row => [row.rateDate, row.refinancingRate, row.interest]), [
    ['2026-05-31', 9.75, 26.71], ['2026-06-01', 9.25, 50.68],
  ])
  for (const row of call.response.results) {
    assert.equal(row.referenceData.refinancingRate.origin, 'reference')
    assert.equal(row.referenceData.refinancingRate.selectedOn, row.endDate)
  }
  assert.equal(call.response.total, 77.39)
})

test('Article 366 automatically accounts for leap years without a divisor field', async () => {
  await mount(Interest366Calculator)
  await fillDocument(1, '100000')
  await submit()
  assert.match(text(), /Предупреждения/)
  assert.doesNotMatch(text(), /Методика годового делителя/)
  assert.match(text(), /Дней в году/)
  assert.match(text(), /2026 — 365/)
  await change(renderer.root.findByProps({ 'aria-label': 'Документ 1: первый день просрочки' }), '2023-12-31')
  await change(renderer.root.findByProps({ 'aria-label': 'Документ 1: последний день просрочки' }), '2024-01-02')
  const call = await submit()
  assert.equal(call.request.refinancingRate, undefined)
  assert.equal(call.response.results[0].refinancingRate, 9.5)
  assert.equal(call.response.results[0].days, 3)
  // One day / 365 + two days / 366, at the same 9.5% rate.
  assert.equal(call.response.total, 77.94)
  assert.match(text(), /2023 — 365; 2024 — 366/)
})

test('Article 366 applies the end-date rate to the entire period and updates after edits', async () => {
  await mount(Interest366Calculator)
  await fillDocument(1, '100000')
  await change(renderer.root.findByProps({ 'aria-label': 'Документ 1: первый день просрочки' }), '2026-05-31')
  for (const [date, rate, total] of [['2026-05-31', 9.75, 26.71], ['2026-06-01', 9.25, 50.68]]) {
    await change(renderer.root.findByProps({ 'aria-label': 'Документ 1: последний день просрочки' }), date)
    if (calls.length) assert.match(text(), /Результат устарел/)
    const call = await submit()
    assert.equal(call.request.rateDate, undefined)
    assert.equal(call.request.refinancingRate, undefined)
    assert.equal(call.response.results[0].rateDate, date)
    assert.equal(call.response.results[0].refinancingRate, rate)
    assert.equal(call.response.results[0].referenceData.refinancingRate.origin, 'reference')
    assert.equal(call.response.total, total)
  }
})

test('results become stale after edits, including edits while a response is pending', async () => {
  for (const Component of [DutyCalculator, PenaltyCalculator, Interest366Calculator]) {
    await mount(Component)
    if (Component === DutyCalculator) await set('Сумма требования (BYN)', '1000')
    else {
      await fillDocument()
      if (Component === PenaltyCalculator) await set('Размер пени, % в день', '0.01')
    }
    await submit()
    assert.doesNotMatch(text(), /Результат устарел/)
    let release
    deferResponse = new Promise(resolve => { release = resolve })
    let pending
    await act(async () => { pending = renderer.root.findByType('form').props.onSubmit({ preventDefault() {} }) })
    if (Component === DutyCalculator) await set('Дата обращения в суд', '2026-11-12')
    else await change(renderer.root.findByProps({ 'aria-label': 'Документ 1: название' }), 'Изменённый документ')
    await act(async () => { release(); await pending })
    assert.match(text(), /Результат устарел/)
    deferResponse = undefined
    await submit()
    assert.doesNotMatch(text(), /Результат устарел/)
  }
})

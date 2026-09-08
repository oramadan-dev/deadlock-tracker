import assert from 'node:assert/strict'
import { test } from 'node:test'
import { changePlayerFilters, defaultPlayerView, parseNavigation, serializeNavigation, visiblePage } from '../src/navigation.ts'

test('omitted and explicit default parameters describe the same compact view', () => {
  const defaults = parseNavigation('')
  assert.equal(defaults.player, null)
  assert.equal(defaults.matchId, null)
  assert.equal(defaults.statistics.minRank, 9)
  assert.equal(defaults.statistics.matchMode, 'ranked')
  assert.equal(serializeNavigation(defaults), '')
  assert.deepEqual(parseNavigation('?date=all&mode=ranked&minRank=9&maxRank=11&sort=winRate&dir=desc'), defaults)
  assert.equal(serializeNavigation(parseNavigation('?player=12345&tab=matches&page=1&heroPage=1&playerDate=all&playerMode=all&heroSort=games&heroDir=desc')), '?player=12345')
})

test('player, match, hidden panel state, filters, and sorts survive a URL round trip', () => {
  const query = '?player=12345&match=987654&date=30d&mode=all&minRank=3&maxRank=7&sort=kda&dir=asc&tab=heroes&playerDate=7d&playerMode=ranked&page=3&heroPage=2&heroSort=last&heroDir=asc'
  const state = parseNavigation(query)
  assert.equal(state.player.accountId, 12345)
  assert.equal(state.matchId, 987654)
  assert.equal(state.player.matchPage, 2)
  assert.equal(state.player.heroPage, 1)
  assert.equal(state.player.sorting.key, 'last')
  assert.equal(state.player.filters.date.days, 7)
  assert.equal(state.statistics.date.days, 30)
  assert.deepEqual(parseNavigation(serializeNavigation(state)), state)
  assert.equal(serializeNavigation(state), query)
})

test('season URLs retain the selected API boundary, independently for home and player', () => {
  const state = parseNavigation('?player=12345&date=season-1700000000&playerDate=season-1750000000')
  assert.deepEqual(state.statistics.date, { kind: 'season', start: 1700000000 })
  assert.deepEqual(state.player.filters.date, { kind: 'season', start: 1750000000 })
  assert.deepEqual(parseNavigation(serializeNavigation(state)), state)
})

test('malformed, unsafe, stale, unknown, and orphan parameters fall back safely', () => {
  for (const player of ['0', '-1', '1.5', '1e3', 'Infinity', '4294967296', '76561197960278073', '<script>']) {
    assert.equal(parseNavigation('?player=' + encodeURIComponent(player)).player, null)
  }
  const state = parseNavigation('?player=12345&match=9007199254740992&tab=unknown&page=-1&heroPage=999999999&heroSort=unknown&heroDir=up&playerDate=season-NaN&playerMode=bad&date=season-999999999999&minRank=11&maxRank=3&sort=not-a-column&dir=up&unknown=data')
  assert.deepEqual(state.player, defaultPlayerView(12345))
  assert.deepEqual(state.statistics, parseNavigation('').statistics)
  assert.equal(state.matchId, null)
  assert.equal(serializeNavigation(state), '?player=12345')
  assert.equal(serializeNavigation(parseNavigation('?tab=heroes&heroPage=3&page=7&unknown=%E0%A4%A')), '')
  assert.equal(parseNavigation('?player=4294967295').player.accountId, 4294967295)
  assert.equal(parseNavigation('?match=987654').matchId, 987654)
  assert.equal(parseNavigation('?player=12345&player=67890').player.accountId, 12345)
})

test('committing filters resets both pages and hero sorting, while retaining tab and identity', () => {
  const previous = parseNavigation('?player=12345&tab=heroes&page=5&heroPage=3&heroSort=kda&heroDir=asc').player
  const next = changePlayerFilters(previous, { matchMode: 'ranked' })
  assert.equal(next.accountId, previous.accountId)
  assert.equal(next.tab, 'heroes')
  assert.equal(next.filters.matchMode, 'ranked')
  assert.equal(next.matchPage, 0)
  assert.equal(next.heroPage, 0)
  assert.deepEqual(next.sorting, { key: 'games', direction: 'desc' })
  assert.equal(previous.matchPage, 4)
  assert.equal(defaultPlayerView(previous.accountId).tab, 'matches')
})

test('out-of-range pages show the last available page and handle empty results', () => {
  assert.equal(visiblePage(99, 41, 20), 2)
  assert.equal(visiblePage(1, 41, 20), 1)
  assert.equal(visiblePage(99, 0, 20), 0)
  assert.equal(visiblePage(99, 20, 20), 0)
})

test('History API navigation is atomic, avoids equivalent entries, and restores committed views', async () => {
  const { navigate, readNavigation } = await import('../src/hooks/useNavigation.ts')
  const events = new EventTarget()
  const entries = ['https://tracker.test/?unknown=ignored']
  let index = 0
  const previousWindow = globalThis.window
  globalThis.window = {
    get location() { return new URL(entries[index]) },
    history: {
      pushState(_state, _unused, href) {
        entries.splice(index + 1)
        entries.push(new URL(href, entries[index]).href)
        index++
      },
    },
    dispatchEvent: events.dispatchEvent.bind(events),
  }
  try {
    let notifications = 0
    events.addEventListener('tracker:navigate', () => notifications++)
    const home = readNavigation()
    navigate(home)
    assert.equal(entries.length, 1)
    navigate({ ...home, player: defaultPlayerView(12345) })
    const player = readNavigation()
    navigate({ ...player, player: { ...player.player, tab: 'heroes' } })
    const heroes = readNavigation()
    assert.equal(heroes.player.filters, player.player.filters)
    assert.equal(heroes.statistics, player.statistics)
    navigate({ ...heroes, matchId: 987654 })
    assert.equal(readNavigation().matchId, 987654)
    index-- // A browser traversal changes location before emitting popstate.
    events.dispatchEvent(new Event('popstate'))
    assert.deepEqual(readNavigation(), heroes)
    index++
    events.dispatchEvent(new Event('popstate'))
    assert.equal(readNavigation().matchId, 987654)
    navigate({ ...readNavigation(), matchId: null })
    assert.equal(readNavigation().player.tab, 'heroes')
    const beforeFilter = readNavigation()
    navigate({ ...beforeFilter, player: changePlayerFilters(beforeFilter.player, { date: { kind: 'rolling', days: 7 } }) })
    const filtered = readNavigation()
    assert.equal(filtered.player.filters.date.days, 7)
    index--
    assert.deepEqual(readNavigation(), beforeFilter)
    index++
    assert.deepEqual(readNavigation(), filtered)
    navigate({ ...filtered, player: defaultPlayerView(67890) })
    assert.equal(readNavigation().player.accountId, 67890)
    index--
    assert.deepEqual(readNavigation(), filtered)
    navigate(filtered)
    assert.equal(notifications, 6)
  } finally {
    if (previousWindow === undefined) delete globalThis.window
    else globalThis.window = previousWindow
  }
})

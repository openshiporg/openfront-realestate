import { test } from 'node:test'
import assert from 'node:assert/strict'
import { clusterLabel, groupPins } from './map-clusters'
import { formatMapArea, parseMapArea } from './map-area'
import { releaseSnap, rubberBand, snapOffsets, stepSnap } from './sheet-snaps'

test('pins close on screen merge, distant ones stay apart', () => {
  const groups = groupPins([
    { id: 'a', x: 100, y: 100 },
    { id: 'b', x: 120, y: 110 },
    { id: 'c', x: 400, y: 100 },
  ], 46)
  assert.deepEqual(groups, [['a', 'b'], ['c']])
})

test('a cluster is labelled by its count and cheapest sale price', () => {
  assert.deepEqual(clusterLabel([
    { label: '$3K/mo', price: 3000, rent: true },
    { label: '$689K', price: 689000 },
    { label: '$449K', price: 449000 },
  ]), { count: '3 homes', from: '$449K+' })
  assert.deepEqual(clusterLabel([{ label: '', price: 0 }, { label: '', price: 0 }]), { count: '2 homes', from: '' })
})

test('map areas round-trip and bad ones are dropped', () => {
  const area = parseMapArea('-97.9,30.1,-97.6,30.4')
  assert.deepEqual(area, { west: -97.9, south: 30.1, east: -97.6, north: 30.4 })
  assert.equal(formatMapArea({ west: -97.912345678, south: 30.1, east: -97.6, north: 30.4 }), '-97.91235,30.1,-97.6,30.4')
  for (const bad of ['', '1,2,3', '-97.6,30.1,-97.9,30.4', '0,95,1,96', 'a,b,c,d', '-200,0,0,1']) assert.equal(parseMapArea(bad), null, bad)
})

test('a slow release settles on the nearest snap', () => {
  const offsets = snapOffsets(700, 136)
  assert.deepEqual(offsets, { full: 0, half: 350, peek: 564 })
  assert.equal(releaseSnap(offsets, 300, 0.1), 'half')
  assert.equal(releaseSnap(offsets, 80, -0.1), 'full')
  assert.equal(releaseSnap(offsets, 520, 0), 'peek')
})

test('a flick carries on to the next snap in its direction', () => {
  const offsets = snapOffsets(700, 136)
  assert.equal(releaseSnap(offsets, 520, -0.8, 564), 'half')
  assert.equal(releaseSnap(offsets, 330, -0.8, 350), 'full')
  assert.equal(releaseSnap(offsets, 30, 0.9, 0), 'half')
  assert.equal(releaseSnap(offsets, 380, 0.9, 350), 'peek')
  assert.equal(releaseSnap(offsets, -10, -2, 0), 'full')
  // A flick from peek that lands just past half stops at half rather than shooting to full.
  assert.equal(releaseSnap(offsets, 340, -1.2, 564), 'half')
  // A flick down from full past half stops at half.
  assert.equal(releaseSnap(offsets, 360, 1.2, 0), 'half')
})

test('keyboard steps stop at the ends and drags resist past them', () => {
  assert.equal(stepSnap('peek', 1), 'half')
  assert.equal(stepSnap('full', 1), 'full')
  assert.equal(stepSnap('peek', -1), 'peek')
  assert.equal(rubberBand(200, 0, 500), 200)
  assert.ok(rubberBand(-100, 0, 500) > -100 && rubberBand(-100, 0, 500) < 0)
  assert.ok(rubberBand(600, 0, 500) < 600)
})

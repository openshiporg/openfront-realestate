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

test('fitting keeps pins and pills off the edges and clear of the sheet', async () => {
  const { fitPadding } = await import('./map-view')
  const map = { top: 0, bottom: 700, left: 0, right: 402, width: 402, height: 700 }
  const plain = fitPadding(map, {}, 132)
  assert.ok(plain.left >= 66 && plain.right >= 66, 'half the widest pill on each side')
  assert.ok(plain.top >= 56, 'a pin hangs above its point')
  const sheet = fitPadding(map, { below: 350 }, 132)
  assert.ok(sheet.bottom >= 378, 'the half sheet is kept clear')
  // A sheet that leaves no usable band falls back to the plain frame instead of a sliver.
  assert.deepEqual(fitPadding(map, { below: 640 }, 132), plain)
  // Side room never eats more than about a fifth of a narrow map.
  assert.ok(fitPadding({ ...map, width: 200, right: 200 }, {}, 300).left <= 44)
})

test('new results keep the shopper\'s view only while some homes are still in it', async () => {
  const { keepView } = await import('./map-view')
  assert.equal(keepView(true, 3), true)
  assert.equal(keepView(true, 0), false)
  assert.equal(keepView(false, 5), false)
})

test('a chosen home only moves the map when it is outside the clear part', async () => {
  const { inClearArea } = await import('./map-view')
  const size = { width: 402, height: 700 }
  assert.equal(inClearArea({ x: 200, y: 200 }, size, 300), true)
  assert.equal(inClearArea({ x: 200, y: 600 }, size, 300), false, 'under the preview and sheet')
  assert.equal(inClearArea({ x: 10, y: 200 }, size, 300), false, 'at the edge')
})

test('map pins carry what the preview card shows', async () => {
  const { listingPins, pinFacts } = await import('./map-pins')
  const [pin] = listingPins([{ id: '1', slug: 'a', title: 'Hill Estate', latitude: 30, longitude: -97, price: '1450000', listingType: 'sale', addressLine1: '8801 Mesa Ridge Dr', city: 'Austin', state: 'TX', bedrooms: 5, bathrooms: '4.5', squareFeet: 4210, imagePath: '/a.jpg' }], () => '$1.45M', { fullPrice: () => '$1,450,000', savedIds: { 1: 's1' } })
  assert.equal(pin.address, '8801 Mesa Ridge Dr')
  assert.equal(pin.facts, '5 bd · 4.5 ba · 4,210 sqft')
  assert.equal(pin.priceText, '$1,450,000')
  assert.equal(pin.savedId, 's1')
  assert.equal(pinFacts({ id: '2', slug: 'b', title: 'Lot', propertyType: 'land', bedrooms: 3, lotSizeSquareFeet: 9000 }), '9,000 sqft lot')
  assert.equal(listingPins([{ id: '3', slug: 'c', title: 'No spot', latitude: null, longitude: null }], () => '').length, 0)
})

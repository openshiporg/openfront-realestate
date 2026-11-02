import { test } from 'node:test'
import assert from 'node:assert/strict'
import { pinLifts } from './pin-layout'

test('pins that are apart stay on their homes', () => {
  assert.deepEqual(pinLifts([
    { id: 'a', x: 100, y: 100, width: 60, height: 30 },
    { id: 'b', x: 300, y: 100, width: 60, height: 30 },
  ]), { a: 0, b: 0 })
})

test('a pin landing on another is raised clear of it', () => {
  const lifts = pinLifts([
    { id: 'low', x: 500, y: 300, width: 70, height: 30 },
    { id: 'high', x: 530, y: 290, width: 70, height: 30 },
  ])
  assert.equal(lifts.low, 0)
  // The lower point keeps its place; the other sits fully above it with a gap.
  assert.ok(290 + lifts.high <= 300 - 30 - 4)
})

test('three pins on one corner stack without any overlap', () => {
  const boxes = [
    { id: 'a', x: 200, y: 200, width: 70, height: 30 },
    { id: 'b', x: 210, y: 198, width: 70, height: 30 },
    { id: 'c', x: 190, y: 196, width: 70, height: 30 },
  ]
  const lifts = pinLifts(boxes)
  const rects = boxes.map(box => ({ top: box.y - box.height + lifts[box.id], bottom: box.y + lifts[box.id] }))
  for (let i = 0; i < rects.length; i++) for (let j = i + 1; j < rects.length; j++) {
    assert.ok(rects[i].bottom <= rects[j].top || rects[j].bottom <= rects[i].top)
  }
})

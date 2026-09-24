import assert from 'node:assert/strict'
import test from 'node:test'
import { existsSync } from 'node:fs'
import { renderToStaticMarkup } from 'react-dom/server'
import * as React from 'react'
import { Button } from '../../src/components/ui/Button'
import { Input } from '../../src/components/ui/Input'
import { Select } from '../../src/components/ui/Select'
import { Textarea } from '../../src/components/ui/Textarea'
import { EmptyState } from '../../src/components/ui/EmptyState'
import { EmptyState as BarrelEmptyState } from '../../src/components/ui'
import { SectionHeader } from '../../src/components/ui/SectionHeader'

// Next supplies the JSX runtime in production. tsx uses the repository's
// preserve setting for imported components, so supply React in this test VM.
Object.assign(globalThis, { React })

test('pending actions stay disabled and retain their specific action label', () => {
  const html = renderToStaticMarkup(<Button loading>Send booking request</Button>)
  assert.match(html, /disabled=""/)
  assert.match(html, /aria-busy="true"/)
  assert.match(html, /Send booking request/)
})

test('secondary and destructive actions have distinct shared styles', () => {
  assert.match(renderToStaticMarkup(<Button variant="secondary">Cancel</Button>), /btn-secondary/)
  assert.match(renderToStaticMarkup(<Button variant="destructive">Cancel booking</Button>), /btn-destructive/)
})

test('repeated field labels do not create duplicate input IDs', () => {
  const html = renderToStaticMarkup(<><Input label="Name" /><Input label="Name" /></>)
  const ids = [...html.matchAll(/<input\b[^>]*?\sid="([^"]+)"/g)].map(match => match[1])
  assert.equal(ids.length, 2)
  assert.notEqual(ids[0], ids[1])
  for (const id of ids) assert.ok(html.includes(`for="${id}"`))
})

test('form validation text is linked to its control and exposed as an alert', () => {
  for (const element of [<Input id="sample" label="Amount" error="Enter an amount" />, <Textarea id="sample" label="Scope" error="Add the work details" />, <Select id="sample" label="Category" options={[]} error="Choose a category" />]) {
    const html = renderToStaticMarkup(element)
    assert.match(html, /aria-invalid="true"/)
    assert.match(html, /aria-describedby="sample-error"/)
    assert.match(html, /id="sample-error" role="alert"/)
  }
})

test('field hints are linked without announcing an error', () => {
  const html = renderToStaticMarkup(<Input id="budget" hint="You will not be charged yet." />)
  assert.match(html, /aria-describedby="budget-hint"/)
  assert.doesNotMatch(html, /role="alert"/)
})

test('both empty-state entry points use the same implementation', () => {
  assert.equal(EmptyState, BarrelEmptyState)
  const html = renderToStaticMarkup(<EmptyState icon="messages" title="No messages yet" />)
  assert.match(html, /inbox.webp/)
  assert.match(html, /alt=""/)
  assert.match(html, /No messages yet/)
})

test('page and section headers use the appropriate heading level', () => {
  assert.match(renderToStaticMarkup(<SectionHeader page title="Bookings" />), /<h1/)
  assert.match(renderToStaticMarkup(<SectionHeader title="Recent activity" />), /<h2/)
})

test('all referenced illustration assets ship in the public directory', () => {
  for (const name of ['people', 'work', 'inbox', 'ready']) assert.ok(existsSync(`public/images/story/${name}.webp`), `${name} is missing`)
})

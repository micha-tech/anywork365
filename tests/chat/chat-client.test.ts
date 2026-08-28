import assert from 'node:assert/strict'
import test from 'node:test'
import {
  ChatClientError,
  getChatConversations,
  getChatMessages,
} from '../../src/lib/chat-client'

const originalFetch = globalThis.fetch

test.afterEach(() => {
  globalThis.fetch = originalFetch
})

test('returns enriched conversations from a successful response', async () => {
  globalThis.fetch = async () => new Response(JSON.stringify({
    success: true,
    data: {
      conversations: [{
        id: 'conversation-1',
        participants: ['client-1', 'artisan-1'],
        participantsInfo: {
          'artisan-1': {
            id: 'artisan-1',
            firstName: 'Ada',
            lastName: 'Okafor',
            role: 'artisan',
          },
        },
        unreadCount: { 'client-1': 0, 'artisan-1': 1 },
        createdAt: '2026-08-28T08:00:00.000Z',
        updatedAt: '2026-08-28T08:00:00.000Z',
      }],
    },
  }), { status: 200, headers: { 'Content-Type': 'application/json' } })

  const conversations = await getChatConversations()
  assert.equal(conversations[0]?.participantsInfo['artisan-1']?.firstName, 'Ada')
})

test('maps an empty server response to a user-friendly error', async () => {
  globalThis.fetch = async () => new Response(null, { status: 500 })

  await assert.rejects(
    getChatConversations(),
    (error: unknown) => error instanceof ChatClientError
      && error.message === 'Messages are temporarily unavailable. Please try again shortly.'
  )
})

test('maps a non-JSON gateway response without exposing parser details', async () => {
  globalThis.fetch = async () => new Response('<html>Bad gateway</html>', { status: 502 })

  await assert.rejects(
    getChatConversations(),
    (error: unknown) => error instanceof ChatClientError
      && !error.message.includes('JSON')
      && !error.message.includes('<html>')
  )
})

test('maps an expired session response', async () => {
  globalThis.fetch = async () => new Response(JSON.stringify({
    success: false,
    error: 'Authentication required',
  }), { status: 401, headers: { 'Content-Type': 'application/json' } })

  await assert.rejects(
    getChatConversations(),
    (error: unknown) => error instanceof ChatClientError
      && error.message === 'Your session has expired. Please sign in again.'
  )
})

test('maps network failures and safely encodes conversation IDs', async () => {
  let requestedUrl = ''
  globalThis.fetch = async (input) => {
    requestedUrl = String(input)
    throw new TypeError('network failed')
  }

  await assert.rejects(
    getChatMessages('conversation/with spaces'),
    (error: unknown) => error instanceof ChatClientError
      && error.message === 'We couldn’t connect to chat. Check your connection and try again.'
  )
  assert.equal(
    requestedUrl,
    '/api/chat/messages?conversationId=conversation%2Fwith%20spaces'
  )
})

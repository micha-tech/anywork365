'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { getInitialsFromUser } from '@/hooks/useCurrentUser'
import { markMessagesAsRead } from '@/lib/chat'
import type { ChatConversation, ChatMessage, User } from '@/types'

const chatApi = {
  async getConversations() {
    const res = await fetch('/api/chat/conversations')
    return res.json()
  },
  async getMessages(conversationId: string) {
    const res = await fetch(`/api/chat/messages?conversationId=${conversationId}`)
    return res.json()
  },
  async send(conversationId: string, content: string) {
    const res = await fetch('/api/chat/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ conversationId, content }),
    })
    return res.json()
  },
}

interface ChatListProps {
  conversations: ChatConversation[]
  currentUserId: string
  onSelect: (conv: ChatConversation) => void
  selectedId?: string
}

export function ChatList({ conversations, currentUserId, onSelect, selectedId }: ChatListProps) {
  return (
    <div className="flex flex-col gap-2">
      {conversations.length === 0 ? (
        <p className="text-sm text-slate-500 text-center py-8">No conversations yet</p>
      ) : (
        conversations.map((conv) => (
          <button
            key={conv.id}
            onClick={() => onSelect(conv)}
            className={`w-full text-left p-3 rounded-xl transition-colors ${
              selectedId === conv.id
                ? 'bg-brand-50 border border-brand-500'
                : 'hover:bg-gray-50 border border-transparent'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-brand-500 flex items-center justify-center text-white text-sm font-medium flex-shrink-0 overflow-hidden">
                <span className="leading-none">{getInitialsFromUser({ firstName: 'U', lastName: '' } as User)}</span>
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between">
                  <p className="font-medium text-sm text-slate-900 truncate">
                    Chat
                  </p>
                  {conv.lastMessageAt && (
                    <p className="text-xs text-slate-500 flex-shrink-0">
                      {new Date(conv.lastMessageAt).toLocaleDateString()}
                    </p>
                  )}
                </div>
                <p className="text-xs text-slate-500 truncate">
                  {conv.lastMessage || 'Start a conversation'}
                </p>
              </div>
              {(conv.unreadCount[currentUserId] ?? 0) > 0 && (
                <span className="w-5 h-5 rounded-full bg-brand-500 text-white text-xs flex items-center justify-center flex-shrink-0">
                  {conv.unreadCount[currentUserId]}
                </span>
              )}
            </div>
          </button>
        ))
      )}
    </div>
  )
}

interface ChatWindowProps {
  conversation: ChatConversation
  currentUserId: string
  onSend: (content: string) => void
}

export function ChatWindow({ conversation, currentUserId, onSend }: ChatWindowProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const loadMessages = useCallback(async () => {
    setLoading(true)
    const res = await chatApi.getMessages(conversation.id)
    if (res.success) {
      setMessages(res.data.messages)
      markMessagesAsRead(conversation.id, currentUserId)
    }
    setLoading(false)
  }, [conversation.id, currentUserId])

  useEffect(() => {
    loadMessages()
    const interval = setInterval(loadMessages, 5000)
    return () => clearInterval(interval)
  }, [loadMessages])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function handleSend(e: React.FormEvent) {
    e.preventDefault()
    if (!newMessage.trim() || sending) return

    setSending(true)
    const res = await chatApi.send(conversation.id, newMessage.trim())
    if (res.success) {
      setMessages(res.data.messages)
      setNewMessage('')
    }
    setSending(false)
  }

  return (
    <div className="flex flex-col h-[calc(100dvh-200px)]">
      <div className="flex-1 overflow-y-auto p-4 space-y-4 overscroll-behavior-contain">
        {loading ? (
          <div className="text-center py-8 text-slate-500">Loading...</div>
        ) : messages.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-slate-500 text-sm">No messages yet</p>
            <p className="text-slate-500 text-xs mt-1">Send a message to start the conversation</p>
          </div>
        ) : (
          messages.map((msg) => {
            const isMe = msg.senderId === currentUserId
            return (
              <div
                key={msg.id}
                className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[75%] rounded-2xl px-4 py-2.5 ${
                    isMe
                      ? 'bg-brand-500 text-white rounded-br-md'
                      : 'bg-gray-100 text-slate-900 rounded-bl-md'
                  }`}
                >
                  <p className="text-sm whitespace-pre-wrap break-words">
                    {msg.contentDecrypted || msg.content}
                  </p>
                  <p className={`text-xs mt-1 ${isMe ? 'text-white/70' : 'text-slate-500'}`}>
                    {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    {msg.status === 'read' && isMe && ' · Read'}
                  </p>
                </div>
              </div>
            )
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      <form onSubmit={handleSend} className="border-t border-slate-200 p-3">
        <div className="flex gap-2">
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Type a message..."
            className="flex-1 input-field min-h-[44px]"
            disabled={sending}
          />
          <button
            type="submit"
            disabled={sending || !newMessage.trim()}
            className="btn-primary px-4 min-h-[44px] min-w-[44px] flex items-center justify-center"
          >
            {sending ? '...' : '→'}
          </button>
        </div>
      </form>
    </div>
  )
}

interface ChatNotificationBellProps {
  unreadCount: number
  onClick: () => void
}

export function ChatNotificationBell({ unreadCount, onClick }: ChatNotificationBellProps) {
  return (
    <button
      onClick={onClick}
      className="relative p-2 rounded-xl hover:bg-brand-50 transition-colors"
    >
      <svg className="w-5 h-5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
      </svg>
      {unreadCount > 0 && (
        <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-red-500 text-white text-xs flex items-center justify-center">
          {unreadCount > 9 ? '9+' : unreadCount}
        </span>
      )}
    </button>
  )
}
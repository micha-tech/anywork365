'use client'

import { useState, useEffect, useCallback, useRef, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { toast } from 'sonner'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { VerifiedBusinessBadge } from '@/components/ui'
import { getInitials } from '@/lib/utils'
import {
  getChatConversations,
  getChatErrorMessage,
  getChatMessages,
  sendChatMessage,
} from '@/lib/chat-client'
import type { ChatMessage, EnrichedChatConversation } from '@/types'

const CONVERSATION_POLL_MS = 10_000
const MESSAGE_POLL_MS = 5_000

function getOtherParticipant(conv: EnrichedChatConversation, currentUserId: string) {
  for (const pid of conv.participants) {
    if (pid !== currentUserId) {
      return conv.participantsInfo?.[pid] ?? null
    }
  }
  return null
}

function ChatPageContent() {
  const searchParams = useSearchParams()
  const { user, loading: userLoading } = useCurrentUser()
  
  const [conversations, setConversations] = useState<EnrichedChatConversation[]>([])
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [newMessage, setNewMessage] = useState('')
  const [conversationIssue, setConversationIssue] = useState<string | null>(null)
  const [messageIssue, setMessageIssue] = useState<string | null>(null)
  const conversationsLoadingRef = useRef(false)
  const messagesLoadingRef = useRef<string | null>(null)
  const messagesRequestIdRef = useRef(0)

  const conversationId = searchParams.get('id')
  const selectedConv = conversationId
    ? conversations.find((conversation) => conversation.id === conversationId) ?? null
    : null
  const selectedConversationId = selectedConv?.id ?? null
  const connectionIssue = messageIssue || conversationIssue

  const loadConversations = useCallback(async () => {
    if (conversationsLoadingRef.current) return
    conversationsLoadingRef.current = true
    try {
      const nextConversations = await getChatConversations()
      setConversations(nextConversations)
      setConversationIssue(null)
    } catch (error) {
      setConversationIssue(getChatErrorMessage(error))
    } finally {
      conversationsLoadingRef.current = false
    }
  }, [])

  const loadMessages = useCallback(async (convId: string, initial = false) => {
    if (messagesLoadingRef.current === convId) return
    const requestId = ++messagesRequestIdRef.current
    messagesLoadingRef.current = convId
    if (initial) setLoading(true)
    try {
      const nextMessages = await getChatMessages(convId)
      if (requestId !== messagesRequestIdRef.current) return
      setMessages(nextMessages)
      setMessageIssue(null)
    } catch (error) {
      if (requestId !== messagesRequestIdRef.current) return
      setMessageIssue(getChatErrorMessage(error))
    } finally {
      if (requestId === messagesRequestIdRef.current) {
        messagesLoadingRef.current = null
        if (initial) setLoading(false)
      }
    }
  }, [])

  useEffect(() => {
    if (!userLoading && user) {
      loadConversations()
    }
  }, [userLoading, user, loadConversations])

  useEffect(() => {
    if (!user) return
    const poll = () => {
      if (document.visibilityState === 'visible') void loadConversations()
    }
    const intervalId = window.setInterval(poll, CONVERSATION_POLL_MS)
    document.addEventListener('visibilitychange', poll)
    return () => {
      window.clearInterval(intervalId)
      document.removeEventListener('visibilitychange', poll)
    }
  }, [user, loadConversations])

  useEffect(() => {
    if (!selectedConversationId) {
      setMessages([])
      setMessageIssue(null)
      setLoading(false)
      return
    }

    void loadMessages(selectedConversationId, true)
    const poll = () => {
      if (document.visibilityState === 'visible') void loadMessages(selectedConversationId)
    }
    const intervalId = window.setInterval(poll, MESSAGE_POLL_MS)
    document.addEventListener('visibilitychange', poll)
    return () => {
      window.clearInterval(intervalId)
      document.removeEventListener('visibilitychange', poll)
    }
  }, [selectedConversationId, loadMessages])

  async function handleSend(e: React.FormEvent) {
    e.preventDefault()
    if (!newMessage.trim() || !selectedConv || sending) return

    setSending(true)
    try {
      const nextMessages = await sendChatMessage(selectedConv.id, newMessage.trim())
      setMessages(nextMessages)
      setNewMessage('')
      setMessageIssue(null)
      void loadConversations()
    } catch (error) {
      const message = getChatErrorMessage(error)
      setMessageIssue(message)
      toast.error(message)
    } finally {
      setSending(false)
    }
  }

  if (userLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="flex h-[calc(100dvh-144px)] md:h-[calc(100dvh-64px)] bg-[#ECE5DD] overflow-hidden">
      {/* Conversations List - hide on mobile when a conversation is selected */}
      <div className={`${selectedConv ? 'hidden md:flex' : 'flex'} w-full md:w-[400px] bg-white flex-col`}>
        <div className="p-4 bg-[#F0F2F5] border-b border-gray-200">
          <h1 className="font-semibold text-lg text-[#111]">Messages</h1>
        </div>

        {connectionIssue && !selectedConv && (
          <div className="m-4 rounded-2xl bg-amber-50 p-4 text-sm text-amber-900">
            <p>{connectionIssue}</p>
            <button
              type="button"
              onClick={() => void loadConversations()}
              className="mt-2 font-semibold text-brand-700 hover:text-brand-800"
            >
              Try again
            </button>
          </div>
        )}
        
        {conversations.length === 0 ? (
          <div className="flex-1 flex items-center justify-center p-4 text-center">
            <div>
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[#E0E0E0] flex items-center justify-center">
                <svg className="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
              </div>
              <p className="text-sm text-gray-500">No messages yet</p>
              <p className="text-xs text-gray-400 mt-1">Start a conversation with an artisan</p>
              <Link href="/artisans" className="mt-4 inline-block text-sm text-[#00A884] hover:underline">
                Browse Artisans
              </Link>
            </div>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto overscroll-contain">
            {conversations.map((conv) => {
              const other = getOtherParticipant(conv, user?.id ?? '')
              const initials = other ? getInitials(other.firstName, other.lastName) : '?'
              return (
                <Link
                  key={conv.id}
                  href={`/messages?id=${conv.id}`}
                  className={`flex items-center gap-3 p-4 border-b border-gray-100 hover:bg-gray-50 transition-colors ${
                    selectedConv?.id === conv.id ? 'bg-[#E5F3EF]' : ''
                  }`}
                >
                  <div className="w-12 h-12 rounded-full bg-[#00A884] flex items-center justify-center text-white font-medium flex-shrink-0 overflow-hidden">
                    <span className="leading-none">{initials}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <p className="font-medium text-sm text-[#111]">
                          {other ? `${other.firstName} ${other.lastName}`.trim() : 'User'}
                        </p>
                        {other?.isVerified && <VerifiedBusinessBadge label={false} size="sm" />}
                      </div>
                      {conv.lastMessageAt && (
                        <p className="text-xs text-gray-400">
                          {new Date(conv.lastMessageAt).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                    <p className="text-sm text-gray-500 truncate">
                      {conv.lastMessage || 'Start chatting'}
                    </p>
                  </div>
                  {(conv.unreadCount[user?.id ?? ''] ?? 0) > 0 && (
                    <span className="w-5 h-5 rounded-full bg-[#00A884] text-white text-xs flex items-center justify-center flex-shrink-0">
                      {conv.unreadCount[user?.id ?? '']}
                    </span>
                  )}
                </Link>
              )
            })}
          </div>
        )}
      </div>

      {/* Chat Window - show on mobile when a conversation is selected */}
      <div className={`${selectedConv ? 'flex' : 'hidden md:flex'} flex-1 flex-col`}>
        {!selectedConv ? (
          <div className="flex-1 flex items-center justify-center bg-[#ECE5DD]">
            <div className="text-center">
              <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-[#DFDCD7] flex items-center justify-center">
                <svg className="w-12 h-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
              </div>
              <p className="text-gray-500 font-medium">Anywork365 Chat</p>
              <p className="text-sm text-gray-400 mt-2">Select a conversation to start chatting</p>
            </div>
          </div>
        ) : (
          <>
            {/* Chat Header */}
            <div className="p-4 bg-[#F0F2F5] border-b border-gray-200 flex items-center gap-3">
              <Link href="/messages" className="md:hidden p-2 hover:bg-gray-100 rounded-full">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </Link>
              {(() => {
                const other = selectedConv ? getOtherParticipant(selectedConv, user?.id ?? '') : null
                const initials = other ? getInitials(other.firstName, other.lastName) : '?'
                return (
                  <>
                    <div className="w-10 h-10 rounded-full bg-[#00A884] flex items-center justify-center text-white font-medium flex-shrink-0 overflow-hidden">
                      <span className="leading-none">{initials}</span>
                    </div>
                    <div>
                      <p className="font-medium text-[#111] flex items-center gap-1.5">
                        {other ? `${other.firstName} ${other.lastName}`.trim() : 'User'}
                        {other?.isVerified && <VerifiedBusinessBadge label={false} size="sm" />}
                      </p>
                      <p className="text-xs text-gray-500">{other?.city || 'Online'}</p>
                    </div>
                  </>
                )
              })()}
            </div>

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2 bg-[#ECE5DD] overscroll-contain">
              {connectionIssue && (
                <div className="mx-auto flex max-w-xl items-center justify-between gap-3 rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-900 shadow-sm">
                  <span>{connectionIssue}</span>
                  <button
                    type="button"
                    onClick={() => {
                      void loadConversations()
                      void loadMessages(selectedConv.id)
                    }}
                    className="shrink-0 font-semibold text-brand-700 hover:text-brand-800"
                  >
                    Try again
                  </button>
                </div>
              )}
              <div className="flex justify-center my-4">
                <span className="text-xs text-gray-400 bg-[#DFDCD7] px-4 py-1 rounded-full">
                  Messages are end-to-end encrypted
                </span>
              </div>
              
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="w-6 h-6 border-2 border-[#00A884] border-t-transparent rounded-full animate-spin" />
                </div>
              ) : messages.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-sm text-gray-500">No messages yet</p>
                  <p className="text-xs text-gray-400 mt-1">Send a message to start the conversation</p>
                </div>
              ) : (
                messages.map((msg, idx) => {
                  const isMe = msg.senderId === user?.id
                  const showTime = idx === 0 || new Date(msg.createdAt).getTime() - new Date(messages[idx - 1].createdAt).getTime() > 300000
                  
                  return (
                    <div key={msg.id}>
                      {showTime && (
                        <div className="flex justify-center my-4">
                          <span className="text-xs text-gray-400 bg-[#DFDCD7] px-3 py-1 rounded-full">
                            {new Date(msg.createdAt).toLocaleString()}
                          </span>
                        </div>
                      )}
                      <div className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                        <div
                          className={`max-w-[70%] rounded-2xl px-4 py-2.5 shadow-sm ${
                            isMe
                              ? 'bg-[#DCF8C6] rounded-br-md'
                              : 'bg-white rounded-bl-md'
                          }`}
                        >
                          <p className="text-sm text-[#111] whitespace-pre-wrap break-words">
                            {msg.contentDecrypted || msg.content}
                          </p>
                          <div className={`flex items-center justify-end gap-1 mt-1 ${isMe ? 'text-[#667]' : 'text-gray-400'}`}>
                            <span className="text-[10px]">
                              {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                            {isMe && (
                              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                                {msg.status === 'read' ? (
                                  <path d="M9 11.7l-1.3-1.3c-.2-.2-.5-.2-.7 0l-.7.7c-.2.2-.2.5 0 .7l.7.7c.2.2.5.2.7 0l7.3-7.3c.2-.2.2-.5 0-.7l-.7-.7c-.2-.2-.5-.2-.7 0L9 11.7z" />
                                ) : (
                                  <path d="M9 11.7c-.2 0-.5-.2-.5-.5v-.7c0-.3.2-.5.5-.5s.5.2.5.5v.7c0 .3-.2.5-.5.5zm6 0c-.2 0-.5-.2-.5-.5v-.7c0-.3.2-.5.5-.5s.5.2.5.5v.7c0 .3-.2.5-.5.5z" />
                                )}
                              </svg>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })
              )}
            </div>

            {/* Input Area */}
            <div className="p-3 bg-[#F0F2F5] flex items-end gap-2">
              <button className="p-2 text-gray-500 hover:bg-gray-200 rounded-full transition-colors">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </button>
              <form onSubmit={handleSend} className="flex-1 flex gap-2">
                <input
                  type="text"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="Type a message..."
                  className="flex-1 px-4 py-2.5 rounded-full bg-white border border-gray-200 focus:outline-none focus:border-[#00A884]"
                  disabled={sending}
                />
                <button
                  type="submit"
                  disabled={sending || !newMessage.trim()}
                  className="p-2.5 bg-[#00A884] text-white rounded-full hover:bg-[#009078] transition-colors disabled:opacity-50"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9 2zm0 0v-8" />
                  </svg>
                </button>
              </form>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export default function ChatPage() {
  return (
    <Suspense fallback={
      <div className="flex h-[calc(100dvh-144px)] md:h-[calc(100dvh-64px)] items-center justify-center bg-[#ECE5DD]">
        <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <ChatPageContent />
    </Suspense>
  )
}

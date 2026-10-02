'use client'

import { ChangeEvent, FormEvent, useEffect, useState } from 'react'
import { toast } from 'sonner'

type Campaign = { id: number; title: string; body: string; imageUrl: string | null; actionUrl: string | null; status: string; deliveredCount: number; failedCount: number; createdAt: string; completedAt: string | null }
type Recipient = { uid: string; fullName: string | null; email: string; role: string | null }

export default function AdminNotificationsPage() {
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [actionUrl, setActionUrl] = useState('')
  const [imageUrl, setImageUrl] = useState('')
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [audience, setAudience] = useState({ users: 0, devices: 0 })
  const [loading, setLoading] = useState(true)
  const [publishing, setPublishing] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [recipientSearch, setRecipientSearch] = useState('')
  const [recipientResults, setRecipientResults] = useState<Recipient[]>([])
  const [recipients, setRecipients] = useState<Recipient[]>([])

  async function load() {
    try {
      const response = await fetch('/api/admin/notifications/broadcast')
      const result = await response.json()
      if (!response.ok || !result.success) throw new Error(result.error)
      setCampaigns(result.data.campaigns)
      setAudience(result.data.audience)
    } catch {
      toast.error('Could not load notification history')
    } finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  useEffect(() => {
    if (recipientSearch.trim().length < 2) { setRecipientResults([]); return }
    const timer = window.setTimeout(async () => {
      const response = await fetch(`/api/admin/notifications/recipients?search=${encodeURIComponent(recipientSearch)}`)
      const result = await response.json()
      if (response.ok && result.success) setRecipientResults(result.data.filter((item: Recipient) => !recipients.some(r => r.uid === item.uid)))
    }, 250)
    return () => window.clearTimeout(timer)
  }, [recipientSearch, recipients])

  async function uploadImage(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const form = new FormData(); form.append('image', file)
      const response = await fetch('/api/admin/notifications/image', { method: 'POST', body: form })
      const result = await response.json()
      if (!response.ok || !result.success) throw new Error(result.error)
      setImageUrl(result.data.url)
      toast.success('Image attached')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Image upload failed')
    } finally { setUploading(false); event.target.value = '' }
  }

  async function publish(event: FormEvent) {
    event.preventDefault()
    const recipientCount = recipients.length || audience.users
    if (!window.confirm(`Publish this notification to ${recipientCount.toLocaleString()} ${recipients.length ? 'selected account(s)' : 'active Anywork365 users'}?`)) return
    setPublishing(true)
    try {
      const response = await fetch('/api/admin/notifications/broadcast', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, body, imageUrl, actionUrl, recipientUids: recipients.map(recipient => recipient.uid) }),
      })
      const result = await response.json()
      if (!response.ok || !result.success) throw new Error(result.error)
      toast.success(`Notification queued for ${recipients.length ? 'selected accounts' : 'all users'}`)
      setTitle(''); setBody(''); setImageUrl(''); setActionUrl(''); setRecipients([]); setRecipientSearch('')
      await load()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not publish notification')
    } finally { setPublishing(false) }
  }

  return <div className="mx-auto max-w-5xl space-y-6">
    <header><h1 className="page-heading">Push notifications</h1><p className="mt-1 text-sm text-slate-500">Publish an announcement to every active Anywork365 user. Delivery is sent safely in batches to registered devices.</p></header>
    <div className="grid gap-4 sm:grid-cols-2"><div className="rounded-xl border border-slate-200 bg-white p-4"><p className="text-2xl font-semibold text-slate-900">{audience.users.toLocaleString()}</p><p className="text-sm text-slate-500">active users receive an in-app notification</p></div><div className="rounded-xl border border-slate-200 bg-white p-4"><p className="text-2xl font-semibold text-slate-900">{audience.devices.toLocaleString()}</p><p className="text-sm text-slate-500">active devices can receive a push alert</p></div></div>
    <form onSubmit={publish} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-5">
      <div><label className="text-sm font-medium text-slate-800">Notification title</label><input required maxLength={120} value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. New services are available" className="mt-1.5 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-brand-500" /></div>
      <div><label className="text-sm font-medium text-slate-800">Message</label><textarea required maxLength={1000} rows={5} value={body} onChange={e => setBody(e.target.value)} placeholder="Write the announcement your users will receive…" className="mt-1.5 w-full resize-y rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-brand-500" /><p className="mt-1 text-right text-xs text-slate-400">{body.length}/1000</p></div>
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4"><div className="flex items-baseline justify-between gap-3"><div><label className="text-sm font-medium text-slate-800">Audience</label><p className="mt-1 text-xs text-slate-500">Leave this empty to notify every active user, or add specific accounts for a targeted push.</p></div><span className="text-xs font-medium text-brand-700">{recipients.length ? `${recipients.length} selected` : 'All active users'}</span></div><input value={recipientSearch} onChange={e => setRecipientSearch(e.target.value)} placeholder="Search a name or email to add specific accounts" className="mt-3 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-brand-500" />{recipientResults.length > 0 && <div className="mt-2 overflow-hidden rounded-lg border border-slate-200 bg-white">{recipientResults.map(recipient => <button key={recipient.uid} type="button" onClick={() => { setRecipients(items => [...items, recipient]); setRecipientSearch(''); setRecipientResults([]) }} className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-brand-50"><span className="min-w-0"><span className="block truncate font-medium text-slate-800">{recipient.fullName || recipient.email}</span><span className="block truncate text-xs text-slate-500">{recipient.email}</span></span><span className="ml-3 text-xs capitalize text-slate-500">{recipient.role || 'user'}</span></button>)}</div>}{recipients.length > 0 && <div className="mt-3 flex flex-wrap gap-2">{recipients.map(recipient => <span key={recipient.uid} className="inline-flex items-center gap-1 rounded-full bg-brand-100 px-2.5 py-1 text-xs text-brand-800">{recipient.fullName || recipient.email}<button type="button" onClick={() => setRecipients(items => items.filter(item => item.uid !== recipient.uid))} aria-label={`Remove ${recipient.fullName || recipient.email}`} className="ml-1 font-bold">×</button></span>)}</div>}</div>
      <div className="grid gap-4 sm:grid-cols-2"><div><label className="text-sm font-medium text-slate-800">Image (optional)</label><input type="file" accept="image/jpeg,image/png,image/webp" onChange={uploadImage} disabled={uploading} className="mt-1.5 block w-full text-sm text-slate-500 file:mr-3 file:rounded-lg file:border-0 file:bg-brand-50 file:px-3 file:py-2 file:text-brand-700" />{imageUrl && <div className="mt-3 flex items-center gap-3"><img src={imageUrl} alt="Notification preview" className="h-16 w-16 rounded-lg object-cover" /><button type="button" onClick={() => setImageUrl('')} className="text-sm text-red-600">Remove</button></div>}</div><div><label className="text-sm font-medium text-slate-800">Open this page (optional)</label><input value={actionUrl} onChange={e => setActionUrl(e.target.value)} placeholder="/jobs" className="mt-1.5 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-brand-500" /><p className="mt-1 text-xs text-slate-400">Use an Anywork365 path, such as /jobs or /dashboard.</p></div></div>
      <div className="flex items-center justify-between border-t border-slate-100 pt-4"><p className="max-w-xl text-xs leading-relaxed text-slate-500">Publishing cannot be undone. Users without a device notification permission will still see the announcement in their in-app notification list.</p><button disabled={publishing || uploading} className="rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50">{uploading ? 'Uploading image…' : publishing ? 'Publishing…' : recipients.length ? `Publish to ${recipients.length} account${recipients.length === 1 ? '' : 's'}` : 'Publish to all users'}</button></div>
    </form>
    <section className="rounded-2xl border border-slate-200 bg-white"><div className="border-b border-slate-200 px-5 py-4"><h2 className="font-semibold text-slate-900">Recent campaigns</h2></div>{loading ? <p className="p-5 text-sm text-slate-500">Loading…</p> : campaigns.length === 0 ? <p className="p-5 text-sm text-slate-500">No announcements have been published yet.</p> : <div className="divide-y divide-slate-100">{campaigns.map(c => <article key={c.id} className="flex gap-4 p-5"><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h3 className="font-medium text-slate-900">{c.title}</h3><span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs capitalize text-slate-600">{c.status}</span></div><p className="mt-1 text-sm text-slate-600">{c.body}</p><p className="mt-2 text-xs text-slate-400">{new Date(c.createdAt).toLocaleString()} · {c.deliveredCount} delivered · {c.failedCount} unavailable</p></div>{c.imageUrl && <img src={c.imageUrl} alt="" className="h-16 w-16 rounded-lg object-cover" />}</article>)}</div>}</section>
  </div>
}

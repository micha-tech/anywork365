import { NextRequest, NextResponse } from 'next/server'
import { getProfessionalProfileByUid } from '@/lib/queries'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const professional = await getProfessionalProfileByUid(id)
  if (!professional) return NextResponse.json({ success: false, error: 'Professional not found' }, { status: 404 })
  return NextResponse.json({ success: true, data: professional }, { headers: { 'Cache-Control': 'public, max-age=60, s-maxage=120' } })
}

import { randomBytes, createHash } from 'crypto'
import { join, normalize, sep } from 'path'

export const VERIFICATION_DOC_FIELDS = [
  'photo',
  'nin_card',
  'utility_bill',
  'business_registration',
  'trade_certificate',
] as const

export type VerificationDocField = typeof VERIFICATION_DOC_FIELDS[number]

const EXT_BY_MIME: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/jpg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'application/pdf': '.pdf',
}

const MIME_BY_EXT: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.pdf': 'application/pdf',
}

export function getVerificationUploadRoot(): string {
  return process.env.VERIFICATION_UPLOAD_DIR || join(process.cwd(), 'storage', 'uploads', 'verify')
}

export function getVerificationDocOwnerSegment(uid: string): string {
  return createHash('sha256').update(uid).digest('hex').slice(0, 32)
}

export function getVerificationDocExtension(mimeType: string): string | null {
  return EXT_BY_MIME[mimeType] ?? null
}

export function createVerificationDocFilename(field: VerificationDocField, mimeType: string): string {
  const ext = getVerificationDocExtension(mimeType)
  if (!ext) throw new Error('Unsupported verification document type')
  return `${field}-${Date.now()}-${randomBytes(8).toString('hex')}${ext}`
}

export function getVerificationDocUrl(ownerSegment: string, filename: string): string {
  return `/api/upload/verify-doc/${ownerSegment}/${filename}`
}

export function getVerificationDocMimeType(filename: string): string {
  const ext = filename.slice(filename.lastIndexOf('.')).toLowerCase()
  return MIME_BY_EXT[ext] ?? 'application/octet-stream'
}

export function resolveVerificationDocPath(ownerSegment: string, filename: string): {
  directory: string
  filepath: string
} | null {
  if (!/^[a-f0-9]{32}$/.test(ownerSegment)) return null
  if (!/^(photo|nin_card|utility_bill|business_registration|trade_certificate)-\d{10,}-[a-f0-9]{16}\.(jpg|png|webp|pdf)$/.test(filename)) {
    return null
  }

  const root = getVerificationUploadRoot()
  const directory = join(root, ownerSegment)
  const filepath = join(directory, filename)
  const normalizedRoot = normalize(root + sep)
  const normalizedFile = normalize(filepath)

  if (!normalizedFile.startsWith(normalizedRoot)) return null

  return { directory, filepath }
}

export function isAllowedVerificationDocUrl(url: string, ownerUid?: string): boolean {
  const protectedMatch = url.match(
    /^\/api\/upload\/verify-doc\/([a-f0-9]{32})\/(photo|nin_card|utility_bill|business_registration|trade_certificate)-\d{10,}-[a-f0-9]{16}\.(jpg|png|webp|pdf)$/
  )

  if (protectedMatch) {
    return !ownerUid || protectedMatch[1] === getVerificationDocOwnerSegment(ownerUid)
  }

  return /^\/uploads\/verify\/[^/]+\.(jpg|jpeg|png|webp|pdf)$/i.test(url)
}

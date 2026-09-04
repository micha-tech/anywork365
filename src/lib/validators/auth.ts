import { z } from 'zod'
import { JOB_CATEGORIES } from '@/types'
import {
  COMPANY_SIZES,
  INDUSTRY_CATEGORIES,
  INTERN_TYPES,
  PROFESSIONAL_QUALIFICATIONS,
  PROFESSIONAL_SERVICE_CATEGORIES,
  RECRUITMENT_FUNCTIONS,
} from '@/lib/registration-options'

const artisanServiceCategorySchema = z
  .union([
    z.literal(''),
    z.enum(JOB_CATEGORIES as [string, ...string[]], {
      invalid_type_error: 'Please select a valid business category',
    }),
  ])
  .optional()
  .transform((value) => value || undefined)

export const COUNTRY_CODES = [
  { code: '+234', country: 'Nigeria' },
  { code: '+233', country: 'Ghana' },
  { code: '+229', country: 'Benin' },
  { code: '+237', country: 'Cameroon' },
  { code: '+1', country: 'USA' },
  { code: '+44', country: 'UK' },
]

export const loginSchema = z.object({
  email: z
    .string()
    .min(1, 'Email is required')
    .email('Please enter a valid email address'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters'),
})

export const optionalNinSchema = z
  .union([
    z.string().trim().length(0),
    z
      .string()
      .trim()
      .length(11, 'NIN must be 11 digits')
      .regex(/^\d+$/, 'NIN must be only numbers'),
  ])
  .optional()
  .transform((value) => {
    if (!value) return undefined
    return value.trim()
  })

export const signupSchema = z
  .object({
    firstName: z
      .string()
      .min(2, 'First name must be at least 2 characters')
      .max(50, 'First name is too long'),
    lastName: z
      .string()
      .min(2, 'Last name must be at least 2 characters')
      .max(50, 'Last name is too long'),
    email: z
      .string()
      .min(1, 'Email is required')
      .email('Please enter a valid email address'),
    countryCode: z.string().min(1, 'Please select country code'),
    phone: z
      .string()
      .min(10, 'Please enter a valid phone number')
      .max(15, 'Phone number is too long'),
    nin: optionalNinSchema,
    password: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
      .regex(/[0-9]/, 'Password must contain at least one number'),
    confirmPassword: z.string(),
    role: z.enum(['client', 'artisan', 'professional', 'recruiter', 'intern'], {
      required_error: 'Please select your account type',
    }),
    state: z.string().min(1, 'Please select your state'),
    artisanServiceCategory: artisanServiceCategorySchema,
    industryCategory: z.enum(INDUSTRY_CATEGORIES).optional(),
    professionalServiceCategory: z.enum(PROFESSIONAL_SERVICE_CATEGORIES).optional(),
    jobTitle: z.string().trim().max(160).optional(),
    qualification: z.enum(PROFESSIONAL_QUALIFICATIONS).optional(),
    yearsExperience: z.coerce.number().int().min(0).max(70).optional(),
    linkedinOrPortfolioUrl: z.union([z.literal(''), z.string().url('Please enter a valid LinkedIn or portfolio URL')]).optional(),
    companyName: z.string().trim().max(180).optional(),
    companySize: z.enum(COMPANY_SIZES).optional(),
    recruitmentFunction: z.enum(RECRUITMENT_FUNCTIONS).optional(),
    position: z.string().trim().max(160).optional(),
    companyWebsite: z.union([z.literal(''), z.string().url('Please enter a valid company website URL')]).optional(),
    internType: z.enum(INTERN_TYPES).optional(),
    schoolName: z.string().trim().max(220).optional(),
    fieldOfStudy: z.string().trim().max(180).optional(),
    graduationYear: z.coerce.number().int().min(1950).max(2100).optional(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  })
  .refine((data) => data.role !== 'artisan' || !!data.artisanServiceCategory, {
    message: 'Please select the primary service you provide',
    path: ['artisanServiceCategory'],
  })
  .refine((data) => data.role !== 'professional' || !!data.industryCategory, {
    message: 'Please select your industry',
    path: ['industryCategory'],
  })
  .refine((data) => data.role !== 'professional' || !!data.professionalServiceCategory, {
    message: 'Please select your professional service',
    path: ['professionalServiceCategory'],
  })
  .refine((data) => data.role !== 'professional' || !!data.jobTitle, {
    message: 'Please enter your current or preferred job title',
    path: ['jobTitle'],
  })
  .refine((data) => data.role !== 'professional' || !!data.qualification, {
    message: 'Please select your highest qualification',
    path: ['qualification'],
  })
  .refine((data) => data.role !== 'professional' || data.yearsExperience !== undefined, {
    message: 'Please enter your years of experience',
    path: ['yearsExperience'],
  })
  .refine((data) => data.role !== 'recruiter' || !!data.companyName, {
    message: 'Please enter your company name',
    path: ['companyName'],
  })
  .refine((data) => data.role !== 'recruiter' || !!data.companySize, {
    message: 'Please select your company size',
    path: ['companySize'],
  })
  .refine((data) => data.role !== 'recruiter' || !!data.industryCategory, {
    message: 'Please select the primary industry you recruit for',
    path: ['industryCategory'],
  })
  .refine((data) => data.role !== 'recruiter' || !!data.recruitmentFunction, {
    message: 'Please select your recruitment function',
    path: ['recruitmentFunction'],
  })
  .refine((data) => data.role !== 'recruiter' || !!data.position, {
    message: 'Please enter your position',
    path: ['position'],
  })
  .refine((data) => data.role !== 'intern' || !!data.internType, {
    message: 'Please select your internship track',
    path: ['internType'],
  })

export type LoginInput = z.infer<typeof loginSchema>
export type SignupInput = z.infer<typeof signupSchema>

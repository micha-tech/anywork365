import { z } from 'zod'

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
    role: z.enum(['client', 'vendor'], {
      required_error: 'Please select your account type',
    }),
    city: z.string().min(1, 'Please select your city'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  })

export type LoginInput = z.infer<typeof loginSchema>
export type SignupInput = z.infer<typeof signupSchema>

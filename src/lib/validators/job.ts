import { z } from 'zod'
import { INDUSTRY_CATEGORIES } from '@/lib/registration-options'

export const jobPostSchema = z.object({
  title: z
    .string()
    .min(5, 'Title must be at least 5 characters')
    .max(120, 'Title is too long'),
  shortDescription: z
    .string()
    .trim()
    .min(60, 'Card summary must be at least 60 characters')
    .max(320, 'Card summary cannot exceed 320 characters'),
  description: z
    .string()
    .trim()
    .min(200, 'Detailed job description must be at least 200 characters')
    .max(10_000, 'Detailed job description cannot exceed 10,000 characters'),
  category: z.enum(INDUSTRY_CATEGORIES, { required_error: 'Please select an industry' }),
  budget: z
    .number({ invalid_type_error: 'Budget must be a number' })
    .min(1000, 'Minimum budget is ₦1,000')
    .max(100_000_000, 'Budget seems too high'),
  city: z.string().min(1, 'Please select a city'),
  timeline: z.enum(['urgent', 'this_week', 'this_month', 'flexible']),
  businessName: z.string().min(2, 'Company name is required'),
  businessAddress: z.string().min(5, 'Company address is required'),
  jobType: z.enum(['full-time', 'part-time', 'contract', 'temporary', 'internship']),
  workArrangement: z.enum(['on-site', 'remote', 'hybrid']),
  closingDate: z.string().min(1, 'Closing date is required'),
}).refine((data) => new Date(`${data.closingDate}T23:59:59`).getTime() > Date.now(), {
  message: 'Closing date must be in the future',
  path: ['closingDate'],
})

export const jobApplicationSchema = z.object({
  firstName: z.string().trim().min(2, 'First name is required').max(80),
  lastName: z.string().trim().min(2, 'Last name is required').max(80),
  coverLetter: z.string().trim().optional(),
  education: z.string().trim().min(10, 'Please provide your education').max(3000),
  workExperience: z.array(z.object({
    jobTitle: z.string().trim().min(2, 'Job title is required').max(160),
    employer: z.string().trim().min(2, 'Employer is required').max(180),
    startDate: z.string().min(1, 'Start date is required'),
    endDate: z.string().optional(),
    current: z.boolean(),
    description: z.string().trim().max(1500).optional(),
  })).min(1, 'Add at least one work experience').max(10),
})

export type JobPostInput = z.infer<typeof jobPostSchema>
export type JobApplicationInput = z.infer<typeof jobApplicationSchema>

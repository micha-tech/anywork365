import BookingsPage, { dynamic } from '@/app/dashboard/bookings/page'

export { dynamic }

export default function ClientBookingsPage() {
  return (
    <div className="mx-auto w-full max-w-6xl px-4 pb-6 pt-4 sm:px-6 sm:py-6 lg:px-8">
      <BookingsPage />
    </div>
  )
}

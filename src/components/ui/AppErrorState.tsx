'use client'

import Image from 'next/image'
import Link from 'next/link'

type AppErrorStateProps = {
  onRetry: () => void
  fullScreen?: boolean
}

export function AppErrorState({ onRetry, fullScreen = false }: AppErrorStateProps) {
  return (
    <main
      className={`flex items-center justify-center px-5 py-10 sm:px-8 ${
        fullScreen ? 'min-h-dvh' : 'min-h-[70dvh]'
      }`}
    >
      <section
        className="relative w-full max-w-3xl overflow-hidden rounded-[2rem] border border-[#dce2dc] bg-white px-6 py-8 text-center shadow-[var(--elevation-3)] sm:px-12 sm:py-10"
        aria-labelledby="server-error-title"
      >
        <div className="pointer-events-none absolute -left-16 -top-20 h-52 w-52 rounded-full bg-[#edf7e7]" />
        <div className="pointer-events-none absolute -bottom-24 -right-16 h-56 w-56 rounded-full bg-[#fbf3df]" />

        <div className="relative mx-auto h-52 w-52 sm:h-64 sm:w-64">
          <Image
            src="/images/states/server-error.webp"
            alt="A friendly technician holding a loose cable"
            fill
            priority
            sizes="(max-width: 640px) 208px, 256px"
            className="object-contain"
          />
        </div>

        <div className="relative mx-auto max-w-xl">
          <p className="mb-2 text-sm font-extrabold uppercase tracking-[0.18em] text-[#865c16]">
            Tiny technical wobble
          </p>
          <h1 id="server-error-title" className="text-3xl font-extrabold tracking-tight text-[#202724] sm:text-4xl">
            Oops, we hit a loose wire.
          </h1>
          <p className="mx-auto mt-4 max-w-lg text-base leading-7 text-[#5b6661] sm:text-lg">
            Nothing you did caused this. Give us a moment, then try again.
          </p>

          <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
            <button type="button" onClick={onRetry} className="btn-primary min-w-40">
              Try again
            </button>
            <Link href="/" className="btn-outline min-w-40">
              Go to home
            </Link>
          </div>
        </div>
      </section>
    </main>
  )
}

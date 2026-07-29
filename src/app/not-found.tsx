import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] p-4 text-center">
      <h2 className="text-2xl font-bold mb-2">Page Not Found</h2>
      <p className="mb-6">We couldn&apos;t find the page you&apos;re looking for.</p>
      <Link href="/" className="text-primary hover:underline">
        Return to Homepage
      </Link>
    </div>
  )
}
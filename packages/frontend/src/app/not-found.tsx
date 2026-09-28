import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-4">
      <h1 className="text-4xl font-extrabold text-white">404</h1>
      <h2 className="text-xl text-zinc-300">Page Not Found</h2>
      <p className="text-zinc-500 max-w-sm text-sm">
        The page you are looking for does not exist or has been moved.
      </p>
      <Link
        href="/"
        className="mt-4 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-medium transition"
      >
        Return Home
      </Link>
    </div>
  );
}

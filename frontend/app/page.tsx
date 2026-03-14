import Link from 'next/link';

export default function Home() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="max-w-2xl w-full p-8">
        <div className="bg-white border border-gray-100 rounded-lg shadow-sm p-8 text-center">
          <h1 className="text-2xl font-semibold mb-2">Welcome to HRMS</h1>
          <p className="text-gray-600 mb-6">Quick access to common tasks.</p>

          <div className="flex items-center justify-center gap-4">
            <Link href="/apply-leave" className="inline-block bg-orange-500 text-white px-6 py-3 rounded-lg hover:bg-orange-600 transition">
              Request Leave
            </Link>

            <Link href="/leave-history" className="inline-block border border-gray-200 px-6 py-3 rounded-lg text-gray-700 hover:bg-gray-100 transition">
              Leave History
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

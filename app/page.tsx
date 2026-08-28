import Link from "next/link";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 bg-gray-50 p-4 text-gray-900">
      <h1 className="text-5xl font-black tracking-tight">
        Code<span className="text-blue-600">Arena</span>
      </h1>
      <p className="max-w-md text-center text-gray-600">
        Live coding competition. Join with your session code, solve problems in Python, climb the leaderboard.
      </p>
      <div className="flex gap-4">
        <Link
          href="/join"
          className="rounded-full bg-blue-600 px-8 py-3 font-semibold text-white hover:bg-blue-700"
        >
          Join Competition
        </Link>
        <Link
          href="/admin/login"
          className="rounded-full border border-gray-300 bg-white px-8 py-3 font-semibold hover:bg-gray-100"
        >
          Admin
        </Link>
      </div>
    </main>
  );
}

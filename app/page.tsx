export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-6">
      <h1 className="text-3xl font-semibold mb-4">
        Know before you eat.
      </h1>

      <p className="text-gray-500 mb-6 text-center max-w-md">
        Food safety signals from real diners, across platforms.
      </p>

      <input
        type="text"
        placeholder="Search a restaurant..."
        className="w-full max-w-md border rounded-lg p-3"
      />
    </main>
  );
}

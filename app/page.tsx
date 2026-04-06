import { cardInputClassName } from "@/lib/cardStyles";
import { mutedBodyClassName, pageTitleClassName } from "@/lib/typography";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-6">
      <h1 className={`${pageTitleClassName} mb-4 text-center`}>
        Know before you eat.
      </h1>

      <p className={`mb-6 text-center max-w-md ${mutedBodyClassName}`}>
        Food safety signals from real diners, across platforms.
      </p>

      <input
        type="text"
        placeholder="Search a restaurant..."
        className={`w-full max-w-md ${cardInputClassName} text-[15px] text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-300/50`}
      />
    </main>
  );
}

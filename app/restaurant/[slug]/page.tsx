export default async function RestaurantPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const readableName = slug
    .replace(/-/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());

  return (
    <main className="p-6 max-w-2xl mx-auto">
      <h1 className="text-2xl font-semibold mb-4">
        {readableName}
      </h1>

      <h2 className="text-lg font-medium mb-2">
        WatchEat Safety Signals
      </h2>

      <div className="border rounded-lg p-4">
        <p>Dirty utensils: 5</p>
        <p>Stale smell: 3</p>
        <p>Insects: 1</p>
        <p>Food poisoning: 0</p>
      </div>
    </main>
  );
}

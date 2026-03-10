export default function Header() {
  return (
    <header className="bg-primary text-white shadow-lg">
      <div className="max-w-4xl mx-auto px-4 py-4">
        <div className="flex items-center gap-4">
          {/* Logo placeholder */}
          <div className="w-12 h-12 bg-accent rounded-lg flex items-center justify-center">
            <span className="text-2xl">🏫</span>
          </div>

          <div>
            <h1 className="text-2xl font-bold">Collège Saint-Louis</h1>
            <p className="text-sm text-gray-300">
              Une fenêtre ouverte sur le monde
            </p>
          </div>
        </div>
      </div>
    </header>
  );
}

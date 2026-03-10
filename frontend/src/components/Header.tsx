export default function Header() {
  return (
    <header className="bg-gradient-to-r from-blue-600 to-blue-800 text-white shadow-lg">
      <div className="max-w-6xl mx-auto px-4 py-6">
        <div className="flex items-center gap-4">
          {/* Logo placeholder */}
          <div className="w-14 h-14 bg-blue-400 rounded-lg flex items-center justify-center shadow-md">
            <span className="text-3xl">🏫</span>
          </div>

          <div>
            <h1 className="text-3xl font-bold">Collège Saint-Louis</h1>
            <p className="text-blue-100 text-sm mt-1">
              Une fenêtre ouverte sur le monde
            </p>
          </div>
        </div>
      </div>
    </header>
  );
}

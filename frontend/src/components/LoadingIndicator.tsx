export default function LoadingIndicator() {
  return (
    <div className="flex justify-start mb-4">
      <div className="bg-white rounded-lg px-4 py-3 shadow">
        <div className="flex items-center gap-2">
          <span className="text-lg">🤖</span>
          <div className="flex gap-1">
            <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" />
            <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-100" />
            <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-200" />
          </div>
        </div>
      </div>
    </div>
  );
}

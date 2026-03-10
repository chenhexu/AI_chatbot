export default function LoadingIndicator() {
  return (
    <div className="flex justify-start mb-4">
      <div className="bg-white rounded-2xl px-6 py-4 shadow-sm">
        <div
          className="flex items-center gap-2"
          role="img"
          aria-label="Assistant is typing"
        >
          <div className="flex gap-1">
            <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce"></div>
            <div
              className="w-2 h-2 bg-blue-500 rounded-full animate-bounce"
              style={{ animationDelay: "0.2s" }}
            ></div>
            <div
              className="w-2 h-2 bg-blue-500 rounded-full animate-bounce"
              style={{ animationDelay: "0.4s" }}
            ></div>
          </div>
        </div>
      </div>
    </div>
  );
}

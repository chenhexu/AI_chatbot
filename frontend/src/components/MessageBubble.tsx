"use client";

import ReactMarkdown from "react-markdown";

interface MessageBubbleProps {
  role: "user" | "assistant";
  content: string;
}

export default function MessageBubble({ role, content }: MessageBubbleProps) {
  const isUser = role === "user";

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"} mb-4`}>
      <div
        className={`max-w-[80%] rounded-lg px-4 py-3 ${
          isUser
            ? "bg-primary text-white"
            : "bg-white text-gray-800 shadow"
        }`}
      >
        <div className="flex items-center gap-2 mb-1">
          <span className="text-sm font-semibold">
            {isUser ? "👤 Vous" : "🤖 Assistant"}
          </span>
        </div>
        <div className="prose prose-sm max-w-none">
          <ReactMarkdown>{content}</ReactMarkdown>
        </div>
      </div>
    </div>
  );
}

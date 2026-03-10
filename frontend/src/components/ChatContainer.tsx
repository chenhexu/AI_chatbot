"use client";

import { useState, useRef, useEffect } from "react";
import MessageBubble from "./MessageBubble";
import InputArea from "./InputArea";
import LoadingIndicator from "./LoadingIndicator";

interface Message {
  role: "user" | "assistant";
  content: string;
  timestamp?: string;
}

export default function ChatContainer() {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content:
        "Bonjour! Je suis l'assistant du Collège Saint-Louis. Comment puis-je vous aider?",
      timestamp: new Date().toISOString(),
    },
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  const handleSend = async (message: string) => {
    const now = new Date().toISOString();
    setMessages((prev) => [...prev, { role: "user", content: message, timestamp: now }]);
    setIsLoading(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
      });

      if (!response.ok) throw new Error("Failed to get response");

      const data = await response.json();

      // Support both 'answer' and 'response' fields from API
      const responseText = data.answer || data.response || "Pas de réponse reçue";

      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: responseText, timestamp: new Date().toISOString() },
      ]);
    } catch (error) {
      console.error("Chat API error:", error);
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content:
            "⚠️ Désolé, une erreur s'est produite. Veuillez réessayer.",
          timestamp: new Date().toISOString(),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col bg-gradient-to-br from-blue-50 to-indigo-100 overflow-hidden">
      {/* Messages Container - scrollable area */}
      <div className="flex-1 overflow-y-auto px-4 py-6">
        <div className="max-w-6xl mx-auto space-y-4">
          {messages.map((msg, index) => (
            <MessageBubble key={index} role={msg.role} content={msg.content} />
          ))}
          {isLoading && <LoadingIndicator />}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input Area - fixed at bottom */}
      <InputArea onSend={handleSend} disabled={isLoading} />
    </div>
  );
}

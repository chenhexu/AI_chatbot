"use client";

import { useState } from "react";
import MessageBubble from "./MessageBubble";
import InputArea from "./InputArea";
import LoadingIndicator from "./LoadingIndicator";

interface Message {
  role: "user" | "assistant";
  content: string;
}

export default function ChatContainer() {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content: "Bonjour! Je suis l'assistant du Collège Saint-Louis. Comment puis-je vous aider?",
    },
  ]);
  const [isLoading, setIsLoading] = useState(false);

  const handleSend = async (message: string) => {
    setMessages((prev) => [...prev, { role: "user", content: message }]);
    setIsLoading(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
      });

      if (!response.ok) throw new Error("Failed to get response");

      const data = await response.json();

      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: data.answer },
      ]);
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "⚠️ Désolé, une erreur s'est produite. Veuillez réessayer.",
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col max-w-4xl mx-auto w-full">
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg, index) => (
          <MessageBubble key={index} role={msg.role} content={msg.content} />
        ))}
        {isLoading && <LoadingIndicator />}
      </div>

      <InputArea onSend={handleSend} disabled={isLoading} />
    </div>
  );
}

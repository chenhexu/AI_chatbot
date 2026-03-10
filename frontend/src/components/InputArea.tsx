"use client";

import { useState, FormEvent } from "react";

interface InputAreaProps {
  onSend: (message: string) => void;
  disabled: boolean;
}

export default function InputArea({ onSend, disabled }: InputAreaProps) {
  const [message, setMessage] = useState("");

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (message.trim() && !disabled) {
      onSend(message.trim());
      setMessage("");
    }
  };

  return (
    <div className="border-t bg-white p-4">
      <form onSubmit={handleSubmit} className="max-w-4xl mx-auto">
        <div className="flex gap-2">
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Posez votre question..."
            className="flex-1 border rounded-lg px-4 py-2 resize-none"
            rows={2}
            disabled={disabled}
            aria-label="Message input field"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSubmit(e);
              }
            }}
          />
          <button
            type="submit"
            disabled={disabled || !message.trim()}
            className="btn-primary self-end"
          >
            Envoyer ➤
          </button>
        </div>
      </form>
    </div>
  );
}

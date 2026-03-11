import { NextRequest, NextResponse } from "next/server";

// TypeScript interfaces
interface ChatRequest {
  message: string;
}

interface ChatResponse {
  response: string;
  timestamp?: string;
}

interface ErrorResponse {
  error: string;
  details?: string;
  backendStatus?: number;
  backendError?: string;
}

// Backend URL from environment with fallback
const BACKEND_URL = process.env.BACKEND_URL || "http://127.0.0.1:8086";
const REQUEST_TIMEOUT = 120000; // 120 seconds (2 minutes) - NotebookLM can take longer to process queries

// Helper function to create timeout promise
function createTimeoutPromise(ms: number): Promise<never> {
  return new Promise((_, reject) => {
    setTimeout(() => reject(new Error(`Request timeout after ${ms}ms`)), ms);
  });
}

// Message validation
function validateMessage(message: string): { valid: boolean; error?: string } {
  if (!message || typeof message !== "string") {
    return { valid: false, error: "Message is required and must be a string" };
  }

  const trimmed = message.trim();
  if (trimmed.length === 0) {
    return { valid: false, error: "Message cannot be empty" };
  }

  if (trimmed.length > 10000) {
    return { valid: false, error: "Message is too long (max 10000 characters)" };
  }

  return { valid: true };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as ChatRequest;
    const { message } = body;

    // Validate message
    const validation = validateMessage(message);
    if (!validation.valid) {
      const errorResponse: ErrorResponse = {
        error: "Invalid message",
        details: validation.error
      };
      return NextResponse.json(errorResponse, { status: 400 });
    }

    // Use trimmed message
    const trimmedMessage = message.trim();

    // Forward to backend with timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

    try {
      const response = await fetch(`${BACKEND_URL}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: trimmedMessage }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text().catch(() => "Unknown error");
        const errorResponse: ErrorResponse = {
          error: "Backend request failed",
          details: `Backend returned status ${response.status}`,
          backendStatus: response.status,
          backendError: errorText
        };
        return NextResponse.json(errorResponse, { status: response.status });
      }

      const data = await response.json() as ChatResponse;
      return NextResponse.json(data);
    } catch (fetchError) {
      if (fetchError instanceof Error && fetchError.name === 'AbortError') {
        const errorResponse: ErrorResponse = {
          error: "Request timeout",
          details: `Backend request exceeded ${REQUEST_TIMEOUT}ms timeout`
        };
        return NextResponse.json(errorResponse, { status: 504 });
      }
      throw fetchError;
    }
  } catch (error) {
    console.error("API proxy error:", error);

    const errorResponse: ErrorResponse = {
      error: "Failed to process request",
      details: error instanceof Error ? error.message : "Unknown error occurred"
    };

    return NextResponse.json(errorResponse, { status: 500 });
  }
}

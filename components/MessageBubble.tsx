'use client';

interface Message {
  id: string;
  text: string;
  isUser: boolean;
  timestamp: Date;
}

interface MessageBubbleProps {
  message: Message;
}

/**
 * Convert text with URLs to JSX with clickable links
 */
function renderTextWithLinks(text: string, isUser: boolean) {
  // Match URLs (including /api/pdf/... paths)
  const urlRegex = /(\/api\/pdf\/[^\s\)]+|https?:\/\/[^\s\)]+)/g;
  const parts: (string | JSX.Element)[] = [];
  let lastIndex = 0;
  let match;
  let key = 0;

  while ((match = urlRegex.exec(text)) !== null) {
    // Add text before the URL
    if (match.index > lastIndex) {
      parts.push(text.substring(lastIndex, match.index));
    }

    // Add the clickable link
    const url = match[0];
    const isPdfLink = url.startsWith('/api/pdf/');
    const displayText = isPdfLink 
      ? url.replace('/api/pdf/', '') 
      : url;

    parts.push(
      <a
        key={key++}
        href={url}
        target={isPdfLink ? '_blank' : '_self'}
        rel="noopener noreferrer"
        className={`underline ${
          isUser 
            ? 'text-blue-100 hover:text-white' 
            : 'text-blue-600 hover:text-blue-800'
        } font-medium`}
      >
        {displayText}
      </a>
    );

    lastIndex = match.index + match[0].length;
  }

  // Add remaining text
  if (lastIndex < text.length) {
    parts.push(text.substring(lastIndex));
  }

  // Always return an array to avoid hydration mismatches
  // If no URLs found, return array with just the text
  if (parts.length === 0) {
    return [text];
  }
  
  return parts;
}

export default function MessageBubble({ message }: MessageBubbleProps) {
  return (
    <div className={`flex ${message.isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-md lg:max-w-lg px-6 py-4 rounded-2xl shadow-sm ${
          message.isUser
            ? 'bg-blue-600 text-white'
            : 'bg-white text-gray-800'
        }`}
      >
        <div className="whitespace-pre-wrap break-words">
          {renderTextWithLinks(message.text, message.isUser)}
        </div>
        <p
          className={`text-xs mt-2 ${
            message.isUser ? 'text-blue-100' : 'text-gray-500'
          }`}
        >
          {message.timestamp.toLocaleTimeString('fr-FR', {
            hour: '2-digit',
            minute: '2-digit',
          })}
        </p>
      </div>
    </div>
  );
}



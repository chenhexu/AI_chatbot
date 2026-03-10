"use client";

import ReactMarkdown from "react-markdown";
import { ReactNode } from "react";

interface MessageBubbleProps {
  role: "user" | "assistant";
  content: string;
}

// Custom component for rendering markdown links
function CustomLink({
  href,
  children,
}: {
  href: string;
  children: ReactNode;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-blue-600 hover:text-blue-800 underline font-medium"
    >
      {children}
    </a>
  );
}

// Custom component for rendering tables
function CustomTable({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-x-auto my-4">
      <table className="border-collapse border border-gray-300 w-full text-sm">
        {children}
      </table>
    </div>
  );
}

// Custom component for rendering table headers
function CustomTableHead({ children }: { children: ReactNode }) {
  return (
    <thead>
      <tr className="bg-gray-100">{children}</tr>
    </thead>
  );
}

// Custom component for rendering table cells
function CustomTableCell({
  isHeader,
  children,
}: {
  isHeader?: boolean;
  children: ReactNode;
}) {
  return (
    <td
      className={`border border-gray-300 px-3 py-2 ${
        isHeader ? "font-semibold bg-gray-100" : ""
      }`}
    >
      {children}
    </td>
  );
}

// Custom component for rendering code blocks
function CustomCode({
  inline,
  children,
}: {
  inline?: boolean;
  children: ReactNode;
}) {
  if (inline) {
    return (
      <code className="bg-gray-100 px-2 py-1 rounded text-sm font-mono">
        {children}
      </code>
    );
  }

  return (
    <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto my-4">
      <code className="font-mono text-sm">{children}</code>
    </pre>
  );
}

// Custom component for rendering images
function CustomImage({
  src,
  alt,
}: {
  src: string;
  alt: string;
}) {
  return (
    <img
      src={src}
      alt={alt}
      className="rounded-lg shadow-md max-w-full h-auto my-4 border border-gray-200"
    />
  );
}

export default function MessageBubble({ role, content }: MessageBubbleProps) {
  const isUser = role === "user";

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"} mb-4`}>
      <div
        className={`${
          isUser
            ? "bg-blue-600 text-white max-w-md"
            : "bg-white text-gray-800 shadow max-w-lg"
        } rounded-2xl px-6 py-4`}
      >
        {/* Optional: Show role indicator in assistant messages */}
        {!isUser && (
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xl">🤖</span>
            <span className="text-xs font-semibold text-gray-500">Assistant</span>
          </div>
        )}

        {/* Render content as markdown to support tables, code, lists, etc. */}
        <div className="whitespace-pre-wrap break-words">
          <ReactMarkdown
            components={{
              a: ({ node, ...props }) => (
                <CustomLink {...props}>{props.children}</CustomLink>
              ),
              table: ({ node, ...props }) => (
                <CustomTable {...props}>{props.children}</CustomTable>
              ),
              thead: ({ node, ...props }) => (
                <CustomTableHead {...props}>{props.children}</CustomTableHead>
              ),
              th: ({ node, ...props }) => (
                <th className="border border-gray-300 px-3 py-2 font-semibold bg-gray-100 text-left">
                  {props.children}
                </th>
              ),
              td: ({ node, ...props }) => (
                <CustomTableCell {...props}>{props.children}</CustomTableCell>
              ),
              code: ({ node, inline, ...props }) => (
                <CustomCode inline={inline} {...props}>
                  {props.children}
                </CustomCode>
              ),
              pre: ({ node, ...props }) => (
                <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto my-4">
                  {props.children}
                </pre>
              ),
              img: ({ node, ...props }) => (
                <CustomImage {...props} />
              ),
              h1: ({ node, ...props }) => (
                <h1 className="text-xl font-bold mt-4 mb-2" {...props}>
                  {props.children}
                </h1>
              ),
              h2: ({ node, ...props }) => (
                <h2 className="text-lg font-bold mt-3 mb-2" {...props}>
                  {props.children}
                </h2>
              ),
              h3: ({ node, ...props }) => (
                <h3 className="text-base font-bold mt-2 mb-1" {...props}>
                  {props.children}
                </h3>
              ),
              ol: ({ node, ...props }) => (
                <ol className="list-decimal list-inside mb-2" {...props}>
                  {props.children}
                </ol>
              ),
              ul: ({ node, ...props }) => (
                <ul className="list-disc list-inside mb-2" {...props}>
                  {props.children}
                </ul>
              ),
              li: ({ node, ...props }) => (
                <li className="mb-1" {...props}>
                  {props.children}
                </li>
              ),
            }}
          >
            {content}
          </ReactMarkdown>
        </div>
      </div>
    </div>
  );
}

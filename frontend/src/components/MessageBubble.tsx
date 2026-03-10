"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ReactNode } from "react";

interface MessageBubbleProps {
  role: "user" | "assistant";
  content: string;
  timestamp?: string;
}

export default function MessageBubble({ role, content, timestamp }: MessageBubbleProps) {
  const isUser = role === "user";

  // Remove the separator lines from NotebookLM response if present
  const cleanContent = content.replace(/^=+\s*$/gm, '').trim();

  // Format timestamp if provided
  const formattedTime = timestamp ? new Date(timestamp).toLocaleTimeString('fr-FR', {
    hour: '2-digit',
    minute: '2-digit'
  }) : new Date().toLocaleTimeString('fr-FR', {
    hour: '2-digit',
    minute: '2-digit'
  });

  return (
    <div className={`flex flex-col ${isUser ? "items-end" : "items-start"} mb-4`}>
      {/* Role and icon above the message bubble */}
      <div className={`flex items-center gap-1.5 mb-1 ${isUser ? "mr-2" : "ml-2"}`}>
        {isUser ? (
          <>
            <span className="text-sm">👤</span>
            <span className="text-xs font-medium text-gray-600">Vous</span>
          </>
        ) : (
          <>
            <span className="text-sm">🤖</span>
            <span className="text-xs font-medium text-gray-600">Assistant</span>
          </>
        )}
      </div>

      {/* Message bubble */}
      <div
        className={`${
          isUser
            ? "bg-blue-600 text-white max-w-md"
            : "bg-white text-gray-800 shadow max-w-2xl"
        } rounded-2xl px-3 py-2`}
      >
        {/* Render content as markdown to support tables, code, lists, etc. */}
        <div className={`prose prose-sm max-w-none ${isUser ? "prose-invert" : "prose-gray"}`}>
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              a: (props: any) => {
                const { node, ...rest } = props;
                return (
                  <a
                    {...rest}
                    href={rest.href || "#"}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`underline font-medium ${isUser ? "text-blue-100 hover:text-white" : "text-blue-600 hover:text-blue-800"}`}
                  >
                    {rest.children}
                  </a>
                );
              },
              table: (props: any) => (
                <div className="overflow-x-auto my-4 rounded-lg border border-gray-200">
                  <table className={`min-w-full divide-y ${isUser ? "divide-blue-400 bg-blue-500" : "divide-gray-200 bg-white"}`}>
                    {props.children}
                  </table>
                </div>
              ),
              thead: (props: any) => (
                <thead className={isUser ? "bg-blue-400" : "bg-gray-50"}>
                  <tr>{props.children}</tr>
                </thead>
              ),
              th: (props: any) => (
                <th className={`px-4 py-2 text-left text-xs font-medium uppercase tracking-wider ${isUser ? "text-white" : "text-gray-700"}`}>
                  {props.children}
                </th>
              ),
              tbody: (props: any) => (
                <tbody className={`${isUser ? "bg-blue-500 divide-y divide-blue-400" : "bg-white divide-y divide-gray-200"}`}>
                  {props.children}
                </tbody>
              ),
              tr: (props: any) => (
                <tr className={isUser ? "hover:bg-blue-600" : "hover:bg-gray-50"}>
                  {props.children}
                </tr>
              ),
              td: (props: any) => (
                <td className={`px-4 py-2 text-sm ${isUser ? "text-white" : "text-gray-900"}`}>
                  {props.children}
                </td>
              ),
              code: (props: any) => {
                const { node, inline, ...rest } = props;
                if (inline) {
                  return (
                    <code className={`px-1.5 py-0.5 rounded text-sm font-mono font-semibold ${isUser ? "bg-blue-500 text-white" : "bg-gray-100 text-red-600"}`}>
                      {rest.children}
                    </code>
                  );
                }
                return (
                  <code className="bg-gray-900 text-gray-100 px-3 py-2 rounded-lg text-sm font-mono block overflow-x-auto">
                    {rest.children}
                  </code>
                );
              },
              pre: (props: any) => (
                <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto my-4 shadow-lg">
                  {props.children}
                </pre>
              ),
              img: (props: any) => {
                const { node, ...rest } = props;
                return (
                  <img
                    {...rest}
                    src={rest.src || ""}
                    alt={rest.alt || "Image"}
                    className="rounded-lg shadow-md max-w-full h-auto my-4 border border-gray-200"
                    loading="lazy"
                  />
                );
              },
              h1: (props: any) => (
                <h1 className={`text-xl font-bold mt-4 mb-2 ${isUser ? "text-white" : "text-gray-900"}`} {...props}>
                  {props.children}
                </h1>
              ),
              h2: (props: any) => (
                <h2 className={`text-lg font-bold mt-3 mb-2 ${isUser ? "text-white" : "text-gray-900"}`} {...props}>
                  {props.children}
                </h2>
              ),
              h3: (props: any) => (
                <h3 className={`text-base font-bold mt-2 mb-1 ${isUser ? "text-white" : "text-gray-900"}`} {...props}>
                  {props.children}
                </h3>
              ),
              h4: (props: any) => (
                <h4 className={`text-sm font-bold mt-2 mb-1 ${isUser ? "text-white" : "text-gray-900"}`} {...props}>
                  {props.children}
                </h4>
              ),
              h5: (props: any) => (
                <h5 className={`text-sm font-semibold mt-1 mb-1 ${isUser ? "text-white" : "text-gray-900"}`} {...props}>
                  {props.children}
                </h5>
              ),
              h6: (props: any) => (
                <h6 className={`text-xs font-semibold mt-1 mb-1 ${isUser ? "text-blue-100" : "text-gray-600"}`} {...props}>
                  {props.children}
                </h6>
              ),
              p: (props: any) => (
                <p className={`my-2 leading-relaxed ${isUser ? "text-white" : "text-gray-800"}`} {...props}>
                  {props.children}
                </p>
              ),
              strong: (props: any) => (
                <strong className={`font-bold ${isUser ? "text-white" : "text-gray-900"}`} {...props}>
                  {props.children}
                </strong>
              ),
              b: (props: any) => (
                <b className={`font-bold ${isUser ? "text-white" : "text-gray-900"}`} {...props}>
                  {props.children}
                </b>
              ),
              em: (props: any) => (
                <em className={`italic ${isUser ? "text-white" : "text-gray-800"}`} {...props}>
                  {props.children}
                </em>
              ),
              i: (props: any) => (
                <i className={`italic ${isUser ? "text-white" : "text-gray-800"}`} {...props}>
                  {props.children}
                </i>
              ),
              ol: (props: any) => (
                <ol className="list-decimal list-inside my-3 space-y-1 ml-4" {...props}>
                  {props.children}
                </ol>
              ),
              ul: (props: any) => (
                <ul className="list-disc list-inside my-3 space-y-1 ml-4" {...props}>
                  {props.children}
                </ul>
              ),
              li: (props: any) => (
                <li className={`leading-relaxed ${isUser ? "text-white" : "text-gray-800"}`} {...props}>
                  {props.children}
                </li>
              ),
              blockquote: (props: any) => (
                <blockquote className={`border-l-4 pl-4 my-4 italic ${isUser ? "border-blue-400 text-blue-50" : "border-gray-300 text-gray-700"}`} {...props}>
                  {props.children}
                </blockquote>
              ),
              hr: (props: any) => (
                <hr className={`my-4 ${isUser ? "border-blue-400" : "border-gray-300"}`} {...props} />
              ),
              div: (props: any) => (
                <div {...props}>
                  {props.children}
                </div>
              ),
              span: (props: any) => (
                <span {...props}>
                  {props.children}
                </span>
              ),
            }}
          >
            {cleanContent}
          </ReactMarkdown>
        </div>
      </div>

      {/* Timestamp below the message bubble */}
      <div className={`text-xs text-gray-400 mt-1 ${isUser ? "mr-2" : "ml-2"}`}>
        {formattedTime}
      </div>
    </div>
  );
}

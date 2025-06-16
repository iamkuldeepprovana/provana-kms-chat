"use client";
import { useEffect, useRef, useState } from "react";
import { marked } from "marked";
import Typewriter from "../components/Typewriter";

export default function Home() {
  // Chat state
  const [messages, setMessages] = useState<any[]>([]);
  const [input, setInput] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [clarification, setClarification] = useState<string | null>(null);
  const [thinking, setThinking] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const sessionIdRef = useRef<string>("");
  const [typing, setTyping] = useState(false);

  // Generate or get sessionId
  useEffect(() => {
    let sessionId = localStorage.getItem("chatSessionId");
    if (!sessionId) {
      sessionId = crypto.randomUUID();
      localStorage.setItem("chatSessionId", sessionId);
    }
    sessionIdRef.current = sessionId;
  }, []);

  // WebSocket connection
  useEffect(() => {
    let ws: WebSocket;
    let reconnectAttempts = 0;
    let shouldReconnect = true;
    function connect() {
      ws = new WebSocket(`wss://kmsaidev.provana.com/model/ws/chat`);
      wsRef.current = ws;
      ws.onopen = () => {
        setConnected(true);
        setMessages((msgs) => [
          ...msgs,
          { type: "system", content: "Connected to Provana KMS", className: "text-green-500" },
        ]);
        reconnectAttempts = 0;
        setIsProcessing(false);
      };
      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          handleMessage(data);
        } catch {
          setMessages((msgs) => [
            ...msgs,
            { type: "system", content: "Error processing server response.", className: "text-red-500" },
          ]);
          setIsProcessing(false);
        }
      };
      ws.onclose = (event) => {
        setConnected(false);
        setMessages((msgs) => [
          ...msgs,
          { type: "system", content: "Connection lost. Attempting to reconnect...", className: "text-yellow-500" },
        ]);
        setIsProcessing(false);
        if (shouldReconnect && event.code !== 1000 && reconnectAttempts < 5) {
          setTimeout(connect, 1000 * Math.pow(2, reconnectAttempts++));
        } else if (shouldReconnect) {
          setMessages((msgs) => [
            ...msgs,
            { type: "system", content: "Could not reconnect. Please refresh the page.", className: "text-red-500" },
          ]);
        }
      };
      ws.onerror = () => {
        setIsProcessing(false);
      };
    }
    connect();
    return () => {
      shouldReconnect = false;
      ws && ws.close(1000, "Page unloaded");
    };
    // eslint-disable-next-line
  }, []);

  function handleMessage(data: any) {
    console.log("Received message:", data);
    if (data.session_id !== sessionIdRef.current) return;
    if (data.type === "state_update") {
      setThinking(data.content);
      setTyping(false);
    } else if (data.type === "answer_token") {
      setThinking(null);
      setTyping(false);
      setMessages((msgs) => {
        const last = msgs[msgs.length - 1];
        if (last && last.type === "bot") {
          return [
            ...msgs.slice(0, -1),
            { ...last, content: last.content + data.content },
          ];
        } else {
          return [...msgs, { type: "bot", content: data.content }];
        }
      });
    } else if (data.type === "clarification_needed") {
      setThinking(null);
      setTyping(false);
      setClarification(data.content);
      setIsProcessing(true);
    } else if (data.type === "end_of_answer") {
      setThinking(null);
      setTyping(false);
      setIsProcessing(false);
    } else if (data.error) {
      setMessages((msgs) => [
        ...msgs,
        { type: "system", content: `Error: ${data.error}`, className: "text-red-500" },
      ]);
      setIsProcessing(false);
    }
  }

  // Scroll to bottom on new message
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTo({
        top: chatContainerRef.current.scrollHeight,
        behavior: "smooth",
      });
    }
  }, [messages, thinking, typing]);

  function sendMessage() {
    if (isProcessing || !input.trim()) return;
    if (!wsRef.current || wsRef.current.readyState !== 1) return; // Only send if open
    setMessages((msgs) => [
      ...msgs,
      { type: "user", content: input },
    ]);
    setTyping(true);
    wsRef.current.send(
      JSON.stringify({ session_id: sessionIdRef.current, question: input, filters: {} })
    );
    setInput("");
    setIsProcessing(true);
  }

  function sendClarification() {
    if (!clarification || !input.trim()) return;
    if (!wsRef.current || wsRef.current.readyState !== 1) return; // Only send if open
    setMessages((msgs) => [
      ...msgs,
      { type: "user", content: input },
    ]);
    setTyping(true);
    wsRef.current.send(
      JSON.stringify({ session_id: sessionIdRef.current, content: input })
    );
    setClarification(null);
    setInput("");
    setIsProcessing(true);
  }

  return (
    <div className="h-screen flex flex-col">
      {/* Header */}
      <header className="p-4 border-b border-[var(--border-color)]">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-xl font-bold text-white">Provana KMS</h1>
          <p className="text-sm text-[var(--text-secondary)]">Your Knowledge Management Solution</p>
        </div>
      </header>
      {/* Chat Container */}
      <div
        id="chat-container"
        ref={chatContainerRef}
        className="flex-1 p-6 overflow-y-auto"
      >
        <div className="max-w-4xl mx-auto space-y-6">
          {messages.length === 0 && (
            <div className="text-center text-[var(--text-secondary)] text-sm my-6">
              This is the start of your conversation. Ask me anything.
            </div>
          )}
          {messages.map((msg, i) => {
            if (msg.type === "user") {
              return (
                <div
                  key={i}
                  className="p-4 my-2 rounded-xl max-w-lg break-words ml-auto bg-[var(--accent-provana)] text-white message-enter-active"
                >
                  {msg.content}
                </div>
              );
            } else if (msg.type === "bot") {
              // Show typewriter effect for the latest bot message only
              const isLatestBot =
                i === messages.length - 1 &&
                messages.filter((m) => m.type === "bot").length > 0;
              if (isLatestBot) {
                return (
                  <div
                    key={i}
                    className="p-4 my-2 rounded-xl max-w-lg break-words mr-auto bg-[var(--background-light)] border border-[var(--border-color)] text-[var(--text-primary)] message-enter-active bot-message-content"
                  >
                    <Typewriter text={msg.content} speed={20} />
                  </div>
                );
              } else {
                return (
                  <div
                    key={i}
                    className="p-4 my-2 rounded-xl max-w-lg break-words mr-auto bg-[var(--background-light)] border border-[var(--border-color)] text-[var(--text-primary)] message-enter-active bot-message-content"
                    dangerouslySetInnerHTML={{ __html: marked.parse(msg.content) }}
                  />
                );
              }
            } else {
              return (
                <div
                  key={i}
                  className={`text-center my-3 text-sm italic ${msg.className || ""} message-enter-active`}
                >
                  {msg.content}
                </div>
              );
            }
          })}
          {thinking && (
            <div className="p-3 my-2 rounded-lg max-w-md break-words mr-auto text-[var(--text-secondary)] message-enter-active thinking-message">
              <span className="font-semibold text-[var(--accent-provana)] mr-2">●</span>
              {thinking}
            </div>
          )}
          {typing && (
            <div className="p-4 my-2 rounded-xl max-w-xs mr-auto bg-[var(--background-light)] text-[var(--text-primary)] message-enter-active typing-indicator">
              <span>●</span><span>●</span><span>●</span>
            </div>
          )}
          {clarification && (
            <div className="p-5 my-4 rounded-xl max-w-lg mx-auto bg-[var(--background-light)] border border-[var(--accent-provana)] text-[var(--text-primary)] shadow-lg message-enter-active">
              <p className="font-semibold text-white mb-3">Clarification Needed</p>
              <p className="mb-4 text-[var(--text-secondary)]">{clarification}</p>
              <input
                type="text"
                className="w-full p-3 bg-gray-800 border border-[var(--border-color)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--accent-provana)]"
                placeholder="Your response..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) sendClarification();
                }}
                autoFocus
              />
              <button
                type="button"
                className="mt-4 w-full px-6 py-2 bg-[var(--accent-provana)] text-white rounded-lg hover:bg-[var(--accent-provana-hover)] transition"
                onClick={sendClarification}
              >
                Submit
              </button>
            </div>
          )}
        </div>
      </div>
      {/* Input Area */}
      {!clarification && (
        <div className="p-4 border-t border-[var(--border-color)]">
          <div className="flex items-center space-x-3 max-w-4xl mx-auto">
            <input
              type="text"
              className="flex-1 p-4 bg-[var(--background-light)] border border-[var(--border-color)] rounded-full focus:outline-none focus:ring-2 focus:ring-[var(--accent-provana)] text-[var(--text-primary)] placeholder-[var(--text-secondary)] transition-all duration-200"
              placeholder="Ask a question..."
              autoComplete="off"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) sendMessage();
              }}
              disabled={isProcessing}
            />
            <button
              className="p-3 bg-[var(--accent-provana)] text-white rounded-full hover:bg-[var(--accent-provana-hover)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-provana)] focus:ring-offset-2 focus:ring-offset-[var(--background-dark)] disabled:bg-gray-600 disabled:cursor-not-allowed transition-all transform active:scale-90"
              type="button"
              onClick={sendMessage}
              disabled={isProcessing}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 24 24" fill="currentColor">
                <path d="M3.478 2.405a.75.75 0 00-.926.94l2.432 7.905H13.5a.75.75 0 010 1.5H4.984l-2.432 7.905a.75.75 0 00.926.94 60.519 60.519 0 0018.445-8.986.75.75 0 000-1.218A60.517 60.517 0 003.478 2.405z" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

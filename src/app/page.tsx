"use client";
import { useEffect, useRef, useState } from "react";
import { marked } from "marked";
import Typewriter from "../components/Typewriter";
import { useRouter } from "next/navigation";
import { ChatSidebar } from "../components/ChatSidebar";
import { Menu } from "lucide-react";

export default function Home() {
  // Chat state
  type Message = {
    type: "user" | "bot" | "system";
    content: string;
    className?: string;
  };
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [clarification, setClarification] = useState<string | null>(null);
  const [thinking, setThinking] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<
    "connected" | "reconnecting" | "disconnected"
  >("connected");
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const sessionIdRef = useRef<string>("");
  const [typing, setTyping] = useState(false);
  const [username, setUsername] = useState("");
  const [selectedSessionId, setSelectedSessionId] = useState<
    string | undefined
  >(undefined);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const userId = "user1"; // Hardcoded user ID for now
  const router = useRouter();
  const aiResponseRef = useRef("");

  // Check authentication on client side as well
  useEffect(() => {
    if (typeof window !== "undefined") {
      const isLoggedIn = document.cookie.includes("isLoggedIn=true");
      if (!isLoggedIn) {
        router.replace("/login");
      }
    }
  }, [router]);

  // Generate a new sessionId on every page load/refresh
  useEffect(() => {
    // Generate a new UUID for each page load
    const sessionId = crypto.randomUUID();
    localStorage.setItem("chatSessionId", sessionId);
    sessionIdRef.current = sessionId;

    debugMessage(`New chat session initialized with ID: ${sessionId}`);

    // Clear messages when a new session starts
    setMessages([
      {
        type: "system",
        content: "New chat session started",
        className: "text-green-500",
      },
    ]);

    console.log("New chat session created with ID:", sessionId);
  }, []);

  // Get username from localStorage
  useEffect(() => {
    if (typeof window !== "undefined") {
      const storedUsername = localStorage.getItem("username");
      if (storedUsername) setUsername(storedUsername);
    }
  }, []);

  // WebSocket connection
  useEffect(() => {
    let ws: WebSocket;
    let reconnectAttempts = 0;
    let shouldReconnect = true;
    function connect() {
      const wsEndpoint =
        process.env.NEXT_PUBLIC_WS_ENDPOINT ||
        "wss://kmsaidev.provana.com/model/ws/chat";
      ws = new WebSocket(wsEndpoint);
      wsRef.current = ws;
      ws.onopen = () => {
        console.log("WebSocket opened");
        setConnectionStatus("connected");
        setMessages((msgs) => [
          ...msgs.filter(
            (m) =>
              m.type !== "system" ||
              (!m.content.includes("Connection lost") &&
                !m.content.includes("Could not reconnect"))
          ),
          { type: "system", content: "", className: "text-green-500" },
        ]);
        reconnectAttempts = 0;
        setIsProcessing(false);
      };
      ws.onmessage = (event) => {
        // console.log("WebSocket message received:", event.data);
        try {
          const data = JSON.parse(event.data);
          handleMessage(data);
        } catch (err) {
          console.error("Failed to parse message", err);
          setMessages((msgs) => [
            ...msgs,
            {
              type: "system",
              content: "Error processing server response.",
              className: "text-red-500",
            },
          ]);
          setIsProcessing(false);
        }
      };
      ws.onclose = (event) => {
        console.warn("WebSocket closed", event);
        setConnectionStatus("reconnecting");
        setMessages((msgs) => [
          ...msgs.filter(
            (m) =>
              m.type !== "system" ||
              (!m.content.includes("Connected to Provana KMS") &&
                !m.content.includes("Could not reconnect"))
          ),
          {
            type: "system",
            content: "Connection lost. Attempting to reconnect...",
            className: "text-yellow-500",
          },
        ]);
        setIsProcessing(false);
        if (shouldReconnect && event.code !== 1000 && reconnectAttempts < 5) {
          setTimeout(connect, 1000 * Math.pow(2, reconnectAttempts++));
        } else if (shouldReconnect) {
          setMessages((msgs) => [
            ...msgs.filter(
              (m) =>
                m.type !== "system" || !m.content.includes("Connection lost")
            ),
            {
              type: "system",
              content: "Could not reconnect. Please refresh the page.",
              className: "text-red-500",
            },
          ]);
          setConnectionStatus("disconnected");
        }
      };
      ws.onerror = (event) => {
        // console.error("WebSocket error", event);
        setIsProcessing(false);
      };
    }
    connect();
    return () => {
      shouldReconnect = false;
      if (ws) {
        ws.close(1000, "Page unloaded");
      }
    };  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  type MessageData = {
    session_id: string;
    type?:
      | "state_update"
      | "answer_token"
      | "clarification_needed"
      | "answer"
      | "end_of_answer";
    content?: string;
    error?: string;
  };
  function handleMessage(data: MessageData) {
    // Store AI answer immediately when received
    console.log("Received message data:", data);
    if (data.type === "answer") {
      console.log("Received full answer:", data.content);
      // Use sessionIdRef.current if sessionId is not set
      const sid = sessionId || sessionIdRef.current;
      // Fallback for user: currentUser, localStorage, or username
      const user = currentUser || (typeof window !== "undefined" ? localStorage.getItem("username") : "") || username;
      console.log(user, sid, data.content);
      if (sid && user && data.content) {
        appendMessage(sid, user, {
          role: "ai",
          content: data.content,
        })
          .then(() => {
            console.log("AI answer saved to database");
            setTimeout(() => storeCompleteChatToMongoDB(), 500);
          })
          .catch((err) => console.error("Failed to save AI answer:", err));
      } else {
        console.warn("Cannot save AI answer: Missing sessionId, user, or content", { sid, user, content: data.content });
      }
    }
    if (data.session_id !== sessionIdRef.current) return;
    if (data.type === "state_update") {
      setThinking(data.content || null);
      setTyping(false);
    } else if (data.type === "answer_token") {
      setThinking(null);
      setTyping(false);
      setMessages((msgs) => {
        const last = msgs[msgs.length - 1];
        if (last && last.type === "bot") {
          return [
            ...msgs.slice(0, -1),
            { ...last, content: last.content + (data.content || "") },
          ];
        } else {
          return [...msgs, { type: "bot", content: data.content || "" }];
        }
      });
    } else if (data.type === "clarification_needed") {
      setThinking(null);
      setTyping(false);
      setClarification(data.content || null);
      setIsProcessing(false); // Allow input when clarification is needed
      setMessages((msgs) => [
        ...msgs,
        { type: "bot", content: data.content || "" },
      ]);
    } else if (data.type === "end_of_answer") {
      setThinking(null);
      setTyping(false);
      setIsProcessing(false);

      // Get the final bot message
      const botMessages = messages.filter((m) => m.type === "bot");
      if (botMessages.length > 0) {
        const lastBotMessage = botMessages[botMessages.length - 1];

        // Save the bot's response to MongoDB
        if (sessionId) {
          console.log(
            "Saving AI response to database:",
            lastBotMessage.content
          );
          appendMessage(sessionId, currentUser, {
            role: "ai",
            content: lastBotMessage.content,
          })
            .then(() => {
              console.log("AI response saved to database");
              // After individual message is saved, update the entire chat history
              setTimeout(() => storeCompleteChatToMongoDB(), 500);
            })
            .catch((err) => console.error("Failed to save AI response:", err));
        } else {
          console.warn("Cannot save AI response: No active session ID");
        }
      }
    } else if (data.error) {
      setMessages((msgs) => [
        ...msgs,
        {
          type: "system",
          content: `Error: ${data.error}`,
          className: "text-red-500",
        },
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

  // --- Chat session API helpers ---
  async function createSession(user: string, firstMessage: string) {
    const res = await fetch("/api/chat", {
      method: "POST",
      body: JSON.stringify({
        user,
        title: firstMessage,
        messages: [{ role: "user", content: firstMessage }],
      }),
      headers: { "Content-Type": "application/json" },
    });
    return res.json();
  }
  async function appendMessage(
    sessionId: string,
    user: string,
    message: { role: "user" | "ai"; content: string }
  ) {
    const res = await fetch("/api/chat", {
      method: "PUT",
      body: JSON.stringify({ sessionId, user, message }),
      headers: { "Content-Type": "application/json" },
    });
    return res.json();
  }
  async function getSession(user: string, sessionId: string) {
    const res = await fetch(`/api/chat?user=${user}&sessionId=${sessionId}`);
    return res.json();
  }

  // --- Main Chat logic integration ---
  // Replace userId with username from localStorage
  const [currentUser, setCurrentUser] = useState<string>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("username") || "";
    }
    return "";
  });
  useEffect(() => {
    if (typeof window !== "undefined") {
      const storedUsername = localStorage.getItem("username");
      if (storedUsername) setCurrentUser(storedUsername);
    }
  }, []);
  // --- Chat session state ---
  const [sessionId, setSessionId] = useState<string | undefined>(undefined);
  // --- Load session when selected ---
  useEffect(() => {
    if (currentUser && selectedSessionId) {
      getSession(currentUser, selectedSessionId).then((session) => {
        setSessionId(session.sessionId);
        setMessages(
          session.messages.map((m: any) => ({
            type: m.role === "ai" ? "bot" : "user",
            content: m.content,
          }))
        );
      });
    }
  }, [currentUser, selectedSessionId]);
  // --- New Chat handler ---
  async function handleNewChat() {
    setSessionId(undefined);
    setSelectedSessionId(undefined);
    setMessages([]);
    setInput("");
    // Generate a new session ID
    const newSessionId = crypto.randomUUID();
    localStorage.setItem("chatSessionId", newSessionId);
    sessionIdRef.current = newSessionId;
    setMessages([
      {
        type: "system",
        content: "New chat session started",
        className: "text-green-500",
      },
    ]);
  }

  // --- Send message handler ---
  async function handleSendMessage() {
    if (!input.trim() || isProcessing) return;
    if (!sessionId) {
      // First message, create session
      const session = await createSession(currentUser, input);
      setSessionId(session.sessionId);
      setSelectedSessionId(session.sessionId);
      setMessages([{ type: "user", content: input }]);
      setInput("");
      sendMessage(session.sessionId, input);
    } else {
      await appendMessage(sessionId, currentUser, {
        role: "user",
        content: input,
      });
      setMessages((msgs) => [...msgs, { type: "user", content: input }]);
      setInput("");
      sendMessage(sessionId, input);
    }
  }

  // Store the current chat state in MongoDB after each message exchange
  function storeCompleteChatToMongoDB() {
    // Fallback for user: currentUser, localStorage, or username
    const user = currentUser || (typeof window !== "undefined" ? localStorage.getItem("username") : "") || username;
    if (!sessionId || !user) {
      // Only warn if actually not saving
      // console.warn("Cannot store chat: Missing sessionId or user");
      return;
    }

    // Convert UI messages to MongoDB format
    const formattedMessages = messages
      .filter((msg) => msg.type === "user" || msg.type === "bot") // Only keep user and bot messages
      .map((msg) => ({
        role: msg.type === "bot" ? "ai" : "user",
        content: msg.content,
      }));

    // Update the entire session with all messages
    fetch(`/api/chat?user=${user}&sessionId=${sessionId}`, {
      method: "GET",
    })
      .then((res) => res.json())
      .then((session) => {
        // Only update if we have messages that aren't in the database
        if (formattedMessages.length > session.messages.length) {
          console.log("Updating session with all messages:", formattedMessages);

          // Replace all messages in the session with our complete set
          fetch("/api/chat/update-all", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              sessionId,
              user: currentUser,
              messages: formattedMessages,
            }),
          })
            .then((res) => {
              if (res.ok) console.log("Full chat history saved to database");
              else console.error("Failed to save chat history");
            })
            .catch((err) => console.error("Error saving chat history:", err));
        }
      })
      .catch((err) => console.error("Error checking session:", err));
  }
  function sendMessage(sessionId: string, message: string) {
    if (!wsRef.current || wsRef.current.readyState !== 1) return; // Only send if open
    setTyping(true);

    // Ensure we're using the right session ID - the one from sessionId param
    sessionIdRef.current = sessionId;
    debugMessage(`Set current session ID to: ${sessionId}`);

    const payload = {
      session_id: sessionId,
      question: message,
      predefined_dimensions: { ClientName: [currentUser] },
    };
    console.log("Sending message payload:", payload);
    wsRef.current.send(JSON.stringify(payload));
    setIsProcessing(true);
  }
  function sendClarification() {
    if (!clarification || !input.trim()) return;
    if (!wsRef.current || wsRef.current.readyState !== 1) return; // Only send if open
    setMessages((msgs) => [...msgs, { type: "user", content: input }]);
    setTyping(true);

    // Use current sessionId from state, which should match the server's
    const currentSessionId = sessionId || sessionIdRef.current;
    debugMessage(`Sending clarification with session ID: ${currentSessionId}`);

    wsRef.current.send(
      JSON.stringify({ session_id: currentSessionId, content: input })
    );
    setClarification(null);
    setInput("");
    setIsProcessing(true);
  }

  // Function to load a chat session
  const loadSession = async (sessionId: string) => {
    if (!sessionId) return;
    
    setIsProcessing(true);
    try {
      // Clear current messages
      setMessages([]);
      
      // Fetch the session from the API
      const response = await fetch(`/api/chat?user=${username}&sessionId=${sessionId}`);
      if (!response.ok) throw new Error('Failed to fetch session');
      
      const session = await response.json();
      
      // Convert MongoDB format to UI format
      const uiMessages = session.messages.map((msg: any) => ({
        type: msg.role === 'ai' ? 'bot' : 'user',
        content: msg.content
      }));
      
      // Update the UI
      setMessages(uiMessages);
      sessionIdRef.current = sessionId;
      
    } catch (error) {
      console.error('Error loading session:', error);
      // Add error message
      setMessages([{
        type: 'system',
        content: 'Failed to load chat history.',
        className: 'text-red-500'
      }]);
    } finally {
      setIsProcessing(false);
    }
  };

  // Cleans markdown links by encoding spaces as %20 in URLs
  function cleanMarkdownLinks(markdown: string): string {
    return markdown.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (match, text, url) => {
      // If the URL contains spaces and is not already encoded
      if (url.includes(" ") && !(url.startsWith("<") && url.endsWith(">"))) {
        return `[${text}](${url.replace(/ /g, "%20")})`;
      }
      return match;
    });
  }

  function debugMessage(message: string) {
    console.log(message);
    // Also display in UI for debugging
    setMessages((msgs) => [
      ...msgs,
      {
        type: "system",
        content: `DEBUG: ${message}`,
        className: "text-purple-500",
      },
    ]);
  }

  // Helper function to dump the current messages state to console
  function dumpMessages() {
    console.log("Current messages:", messages);
    console.log("aiResponseRef.current:", aiResponseRef.current);
  }

  // Logout function
  function handleLogout() {
    // Remove the auth cookie
    document.cookie = "isLoggedIn=; path=/; expires=Thu, 01 Jan 1970 00:00:00 UTC;";
    // Clear localStorage if you're storing anything there
    localStorage.removeItem("username");
    localStorage.removeItem("chatSessionId");
    // Redirect to login page
    router.replace("/login");
  }

  return (
    <div className="h-screen flex flex-row">
      {/* Chat Sidebar */}
      <ChatSidebar
        user={username}
        selectedSessionId={selectedSessionId}
        onSelectSession={(sessionId) => {
          setSelectedSessionId(sessionId);
          // Load the selected session
          loadSession(sessionId);
        }}
        onNewChat={handleNewChat}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      {/* Toggle Sidebar Button (only when sidebar is closed) */}
      {!sidebarOpen && (
        <button
          className="fixed top-4 left-4 z-50 p-2 rounded-full bg-[var(--background-dark)] text-[var(--accent-provana)] shadow-lg hover:bg-[var(--background-light)] transition"
          onClick={() => setSidebarOpen(true)}
          aria-label="Open Sidebar"
        >
          <Menu size={20} />
        </button>
      )}

      <div className="h-screen flex flex-col flex-1 overflow-hidden">
        {/* Header */}        <header className="p-2 border-b border-[var(--border-color)]">
          <div className="max-w-4xl mx-auto flex justify-between items-center">
            <div>
              <h1 className="text-lg font-bold text-white">Provana KMS</h1>
              <p className="text-xs text-[var(--text-secondary)]">Your Knowledge Management Solution</p>
            </div>
            <div className="flex space-x-2">
              <button
                onClick={handleNewChat}
                className="px-3 py-1.5 bg-[var(--accent-provana)] text-white rounded hover:bg-[var(--accent-provana-hover)] transition text-sm"
              >
                New Chat
              </button>
              <button
                onClick={handleLogout}
                className="px-3 py-1.5 bg-red-600 text-white rounded hover:bg-red-700 transition text-sm"
              >
                Logout
              </button>
            </div>
          </div>
        </header>
        {/* Chat Container */}
        {connectionStatus === "reconnecting" && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
            <div className="flex flex-col items-center p-8 bg-white rounded-xl shadow-lg">
              <div className="loader mb-4" style={{ width: 40, height: 40, border: '4px solid #ccc', borderTop: '4px solid #0070f3', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
              <span className="text-lg font-semibold text-gray-700">Attempting to reconnect...</span>
            </div>
          </div>
        )}
        <div
          id="chat-container"
          ref={chatContainerRef}
          className="flex-1 p-6 overflow-y-auto"
        >
          <div className="max-w-4xl mx-auto space-y-6">
            {/* Welcome Back Card only when connected, with reduced spacing */}
            {/* (Moved inside chat container) */}
            {username && connectionStatus === "connected" && (
              <div className="dashboard-welcome-card my-2 mx-auto">
                <h2>👋 Welcome Back <span className="highlight">{username}</span></h2>
                <p>Ready to start your conversation?</p>
              </div>
            )}
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
                      <Typewriter text={cleanMarkdownLinks(msg.content)} speed={20} />
                    </div>
                  );
                } else {
                  return (
                    <div                    key={i}
                      className="p-4 my-2 rounded-xl max-w-lg break-words mr-auto bg-[var(--background-light)] border border-[var(--border-color)] text-[var(--text-primary)] message-enter-active bot-message-content"
                      dangerouslySetInnerHTML={{ __html: marked.parse(cleanMarkdownLinks(msg.content)) }}
                    />
                  );
                }
              } else {
                // System messages (e.g., connection lost, connected)
                const isReconnecting = connectionStatus === "reconnecting" && msg.content.includes("Connection lost");
                const isConnected = connectionStatus === "connected" && msg.content.includes("Connected to Provana KMS");
                if (!isReconnecting && !isConnected) return null;
                return (
                  <div
                    key={i}
                    className={`text-center my-3 text-sm italic ${msg.className || ""} message-enter-active`}
                  >
                    {isReconnecting && (
                      <span className="inline-block align-middle mr-2">
                        <span className="loader" style={{ display: 'inline-block', width: 18, height: 18, border: '3px solid #ccc', borderTop: '3px solid #0070f3', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                      </span>
                    )}
                    {msg.content}
                    {isConnected && (
                      <span className="inline-block align-middle ml-2 text-green-500 font-bold">●</span>
                    )}
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
          </div>
        </div>
        {/* Input Area */}
        <div className="p-4 border-t border-[var(--border-color)]">
          <div className="flex items-center space-x-3 max-w-4xl mx-auto">
            <input
              type="text"
              className="flex-1 p-4 bg-[var(--background-light)] border border-[var(--border-color)] rounded-full focus:outline-none focus:ring-2 focus:ring-[var(--accent-provana)] text-[var(--text-primary)] placeholder-[var(--text-secondary)] transition-all duration-200"
              placeholder={clarification ? "Please clarify..." : "Ask a question..."}
              autoComplete="off"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  if (clarification) {
                    sendClarification();
                  } else {
                    handleSendMessage();
                  }
                }
              }}
              disabled={isProcessing}
            />
            <button
              className="p-3 bg-[var(--accent-provana)] text-white rounded-full hover:bg-[var(--accent-provana-hover)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-provana)] focus:ring-offset-2 focus:ring-offset-[var(--background-dark)] disabled:bg-gray-600 disabled:cursor-not-allowed transition-all transform active:scale-90"
              type="button"
              onClick={clarification ? sendClarification : handleSendMessage}
              disabled={isProcessing}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 24 24" fill="currentColor">
                <path d="M3.478 2.405a.75.75 0 00-.926.94l2.432 7.905H13.5a.75.75 0 010 1.5H4.984l-2.432 7.905a.75.75 0 00.926.94 60.519 60.519 0 0018.445-8.986.75.75 0 000-1.218A60.517 60.517 0 003.478 2.405z" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

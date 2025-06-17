"use client";

import React, { useEffect, useState } from "react";
import { Button } from "./ui/button";
import { Plus, MessageSquare, X } from "lucide-react";
import clsx from "clsx";

interface ChatSession {
  id: string;
  title?: string;
  firstMessage?: string;
  createdAt?: string;
}

interface ChatSidebarProps {
  userId: string;
  selectedSessionId?: string;
  onSelectSession: (sessionId: string) => void;
  onNewChat?: () => void;
  open?: boolean;
  onClose?: () => void;
}

export const ChatSidebar: React.FC<ChatSidebarProps> = ({
  userId,
  selectedSessionId,
  onSelectSession,
  onNewChat,
  open = true,
  onClose,
}) => {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /* ────────────────────────────────────────────────────────── */
  /* fetch user’s chat sessions                                 */
  /* ────────────────────────────────────────────────────────── */
  useEffect(() => {
    const fetchSessions = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/chat/sessions?userId=${userId}`);
        if (!res.ok) throw new Error("Failed to fetch sessions");
        const data = await res.json();
        setSessions(data.sessions || []);
      } catch (err: any) {
        setError(err.message || "Unknown error");
      } finally {
        setLoading(false);
      }
    };
    fetchSessions();
  }, [userId]);

  if (!open) return null;

  /* ────────────────────────────────────────────────────────── */
  /* UI                                                        */
  /* ────────────────────────────────────────────────────────── */
  return (
    <aside
      className="
        w-72                          /* wider to match header rhythm   */
        bg-[var(--background-dark)]   /* same dark tone as navbar       */
        border-r border-[var(--border-color)]
        h-full flex flex-col shadow-md
      "
    >
      {/* Top strip */}
      <div className="flex items-center justify-between h-15 px-5 border-b border-[var(--border-color)]">
        <span className="font-bold text-m tracking-wide text-white">
          Chats
        </span>
        <div className="flex gap-2 items-center">
          <Button
            size="icon"
            variant="ghost"
            onClick={onNewChat}
            aria-label="New Chat"
            className="hover:bg-[var(--accent-provana)]/10"
          >
            <Plus className="w-5 h-5 text-[var(--accent-provana)]" />
          </Button>
          {onClose && (
            <Button
              size="icon"
              variant="ghost"
              onClick={onClose}
              aria-label="Close Sidebar"
              className="ml-1"
            >
              <X className="w-5 h-5 text-[var(--accent-provana)]" />
            </Button>
          )}
        </div>
      </div>

      {/* Chat list */}
      <div className="flex-1 overflow-y-auto p-4">
        {loading ? (
          <div className="text-sm text-gray-500">Loading...</div>
        ) : error ? (
          <div className="text-sm text-red-500">{error}</div>
        ) : (
          <ul className="space-y-3">
            {sessions.length === 0 ? (
              <li className="text-sm text-gray-400 text-center py-8">
                No chats found.
              </li>
            ) : (
              sessions.map((session) => (
                <li
                  key={session.id}
                  onClick={() => onSelectSession(session.id)}
                  className={clsx(
                    "p-4 rounded-xl max-w-xs mx-auto flex items-center gap-3 cursor-pointer transition-all border-l-4",
                    selectedSessionId === session.id
                      ? "bg-[var(--accent-provana)] text-white border-[var(--accent-provana)] shadow-lg"
                      : "bg-[var(--background-dark)] text-[var(--text-secondary)] hover:bg-[var(--background-light)]/5 border-transparent"
                  )}
                >
                  <MessageSquare
                    className={clsx(
                      "w-5 h-5 flex-shrink-0",
                      selectedSessionId === session.id
                        ? "text-white"
                        : "text-[var(--accent-provana)]"
                    )}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="truncate font-medium">
                      {session.title ||
                        session.firstMessage ||
                        "Untitled Chat"}
                    </div>
                    {session.createdAt && (
                      <div className="text-xs text-gray-400">
                        {new Date(session.createdAt).toLocaleDateString()}
                      </div>
                    )}
                  </div>
                </li>
              ))
            )}
          </ul>
        )}
      </div>
    </aside>
  );
};

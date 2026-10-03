// src/components/Sidebar.tsx
"use client";

import React, { useState, useMemo } from "react";
import { useChatStore, type Convo } from "@/store/chat";
import {
  Plus,
  Search,
  Trash2,
  Settings as SettingsIcon,
  MessageSquare,
  X,
} from "lucide-react";
import { cn } from "@/lib/cn";

interface SidebarProps {
  isOpenMobile: boolean;
  onCloseMobile: () => void;
  onOpenSettings: () => void;
}

export function Sidebar({
  isOpenMobile,
  onCloseMobile,
  onOpenSettings,
}: SidebarProps) {
  const conversations = useChatStore((s) => s.conversations);
  const activeConvoId = useChatStore((s) => s.activeConvoId);
  const selectConversation = useChatStore((s) => s.selectConversation);
  const createConversation = useChatStore((s) => s.createConversation);
  const deleteConversation = useChatStore((s) => s.deleteConversation);

  const [searchQuery, setSearchQuery] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Group conversations by date
  const groupedConvos = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    const filtered = conversations.filter(
      (c) => !q || c.title.toLowerCase().includes(q)
    );

    const now = Date.now();
    const oneDay = 24 * 60 * 60 * 1000;

    const groups: {
      today: Convo[];
      yesterday: Convo[];
      last7Days: Convo[];
      older: Convo[];
    } = {
      today: [],
      yesterday: [],
      last7Days: [],
      older: [],
    };

    for (const c of filtered) {
      const diff = now - c.updatedAt;
      if (diff < oneDay) {
        groups.today.push(c);
      } else if (diff < 2 * oneDay) {
        groups.yesterday.push(c);
      } else if (diff < 7 * oneDay) {
        groups.last7Days.push(c);
      } else {
        groups.older.push(c);
      }
    }

    return groups;
  }, [conversations, searchQuery]);

  const handleSelect = (id: string) => {
    selectConversation(id);
    onCloseMobile();
  };

  const handleNewChat = () => {
    createConversation();
    onCloseMobile();
  };

  const renderGroup = (title: string, list: Convo[]) => {
    if (list.length === 0) return null;

    return (
      <div key={title} className="mb-4">
        <div className="px-3 py-1 text-[11px] font-semibold text-[var(--muted)] uppercase tracking-wider">
          {title}
        </div>
        <div className="space-y-0.5 mt-1">
          {list.map((c) => {
            const isActive = c.id === activeConvoId;
            const isDeleting = deletingId === c.id;

            return (
              <div
                key={c.id}
                className={cn(
                  "group relative flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-colors cursor-pointer select-none",
                  isActive
                    ? "bg-[var(--surface-2)] text-[var(--text)] font-semibold"
                    : "text-[var(--muted)] hover:text-[var(--text)] hover:bg-[var(--surface-2)]/60"
                )}
                onClick={() => !isDeleting && handleSelect(c.id)}
              >
                <div className="flex items-center gap-2 truncate flex-1 min-w-0 pr-1">
                  <MessageSquare className="w-3.5 h-3.5 shrink-0 opacity-70" />
                  <span className="truncate">{c.title || "Untitled"}</span>
                </div>

                {/* Trash button with inline confirm */}
                {isDeleting ? (
                  <div
                    className="flex items-center gap-1.5 shrink-0 z-10"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      onClick={() => {
                        deleteConversation(c.id);
                        setDeletingId(null);
                      }}
                      className="px-1.5 py-0.5 rounded text-[11px] bg-[var(--danger)] text-white hover:opacity-90 transition-opacity"
                    >
                      Delete
                    </button>
                    <button
                      onClick={() => setDeletingId(null)}
                      className="px-1.5 py-0.5 rounded text-[11px] bg-[var(--surface)] text-[var(--muted)] hover:text-[var(--text)]"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeletingId(c.id);
                    }}
                    className="opacity-0 group-hover:opacity-100 p-1 rounded-md text-[var(--muted)] hover:text-[var(--danger)] hover:bg-[var(--surface)] transition-all shrink-0 cursor-pointer"
                    title="Delete conversation"
                    aria-label="Delete conversation"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const content = (
    <div className="flex flex-col h-full bg-[var(--surface)] border-r border-[var(--border)] w-72">
      {/* Header with New Chat */}
      <div className="p-3 border-b border-[var(--border)] space-y-2">
        <div className="flex items-center justify-between">
          <button
            onClick={handleNewChat}
            className="flex-1 inline-flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-[var(--accent)] text-white text-xs font-semibold hover:opacity-95 transition-opacity shadow-xs cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>New chat</span>
          </button>
          {isOpenMobile && (
            <button
              onClick={onCloseMobile}
              className="p-2 ml-2 rounded-xl text-[var(--muted)] hover:text-[var(--text)] hover:bg-[var(--surface-2)] transition-colors lg:hidden"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Filter input */}
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-[var(--muted)] pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search chats…"
            className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-[var(--bg)] border border-[var(--border)] text-xs text-[var(--text)] placeholder:text-[var(--muted)] focus:outline-none focus:border-[var(--accent)]"
          />
        </div>
      </div>

      {/* Conversation list */}
      <div className="flex-1 overflow-y-auto p-2">
        {conversations.length === 0 ? (
          <div className="text-center py-8 text-xs text-[var(--muted)]">
            No conversations yet
          </div>
        ) : (
          <>
            {renderGroup("Today", groupedConvos.today)}
            {renderGroup("Yesterday", groupedConvos.yesterday)}
            {renderGroup("Previous 7 days", groupedConvos.last7Days)}
            {renderGroup("Older", groupedConvos.older)}
          </>
        )}
      </div>

      {/* Footer */}
      <div className="p-3 border-t border-[var(--border)] flex items-center justify-between">
        <button
          onClick={() => {
            onOpenSettings();
            onCloseMobile();
          }}
          className="inline-flex items-center gap-2 text-xs font-medium text-[var(--muted)] hover:text-[var(--text)] transition-colors cursor-pointer"
        >
          <SettingsIcon className="w-4 h-4" />
          <span>Settings</span>
        </button>
        <span className="text-[11px] font-mono text-[var(--muted)] opacity-70">
          v3.2 · 50M
        </span>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop static column */}
      <div className="hidden lg:block shrink-0 h-full">{content}</div>

      {/* Mobile Drawer */}
      {isOpenMobile && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-xs transition-opacity"
            onClick={onCloseMobile}
          />
          <div className="relative z-10 h-full shadow-2xl animate-in slide-in-from-left duration-200">
            {content}
          </div>
        </div>
      )}
    </>
  );
}

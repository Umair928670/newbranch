"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/router";
import * as Ably from 'ably';
import { useAuth } from "@/lib/auth-context";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Send, ArrowLeft, Loader2, Phone, Video, MoreVertical } from "lucide-react";
import Link from "next/link";
import { format } from "date-fns";

// --- TYPES ---
type Message = {
  id: string;
  senderId: string;
  content: string;
  createdAt: string;
};

export default function ChatPage() {
  const router = useRouter();
  const bookingId = router.query.bookingId as string;
  const { user } = useAuth();

  const [ablyClient, setAblyClient] = useState<Ably.Realtime | null>(null);
  const [channel, setChannel] = useState<Ably.RealtimeChannel | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // 1. Fetch Chat History from Database
  const { data: history, isLoading: historyLoading } = useQuery<Message[]>({
    queryKey: [`/api/chat/${bookingId}`],
    enabled: !!bookingId
  });

  // Fetch booking details (passenger/driver) to display names and avatars
  const { data: bookingDetails, isLoading: bookingLoading } = useQuery<any>({
    queryKey: bookingId ? [`/api/bookings/${bookingId}`] : [],
    enabled: !!bookingId,
  });

  // 2. Initialize Ably & Subscribe
  useEffect(() => {
    if (!bookingId || !user) return;

    // Reuse a single Ably client per window to avoid create/close races
    const globalAny: any = (typeof window !== 'undefined' ? window : {});
    if (!globalAny.__UNIPOOL_ABLY_CLIENT) {
      try {
        globalAny.__UNIPOOL_ABLY_CLIENT = new Ably.Realtime({ authUrl: `/api/auth/ably?userId=${user.id}` });
        globalAny.__UNIPOOL_ABLY_CLIENT_USER = user.id;
      } catch (err) {
        console.warn('Ably init failed', err);
        return;
      }
    }

    const client: Ably.Realtime = globalAny.__UNIPOOL_ABLY_CLIENT as Ably.Realtime;
    const chatChannel = client.channels.get(`booking:${bookingId}`);

    // Subscribe to new messages
    const onMessage = (msg: any) => {
      const newMessage = msg.data;
      // normalize timestamp field to createdAt if needed
      if (newMessage && !newMessage.createdAt && newMessage.timestamp) {
        newMessage.createdAt = newMessage.timestamp;
      }
      setMessages((prev) => [...prev, newMessage]);
    };
    chatChannel.subscribe('message', onMessage);

    setAblyClient(client);
    setChannel(chatChannel);

    return () => {
      try {
        if (chatChannel) chatChannel.unsubscribe(onMessage as any);
      } catch (e) {
        console.warn('Ably unsubscribe error', e);
      }
      // Do not close the global client here to avoid racing close calls.
    };
  }, [bookingId, user]);

  // 3. Sync History to State
  useEffect(() => {
    if (history) {
      // ensure messages have createdAt
      const normalized = history.map((m: any) => ({ ...m, createdAt: m.createdAt || m.timestamp || new Date().toISOString() }));
      setMessages(normalized);
    }
  }, [history]);

  // 4. Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // 5. Send Message Mutation
  const sendMessageMutation = useMutation({
    mutationFn: async (text: string) => {
      return apiRequest("POST", "/api/chat", {
        bookingId,
        senderId: user?.id,
        content: text
      });
    },
    onSuccess: () => {
      setInputText("");
      inputRef.current?.focus();
    }
  });

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;
    sendMessageMutation.mutate(inputText);
  };

  const getOtherParticipant = () => {
    if (!bookingDetails || !user) return null;
    return user.id === bookingDetails.passenger?.id ? bookingDetails.driver : bookingDetails.passenger;
  };

  const otherParticipant = getOtherParticipant();

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="text-center">
          <h2 className="text-2xl font-semibold mb-2">Please log in</h2>
          <p className="text-muted-foreground">You need to be logged in to access chat.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] bg-background">
      {/* HEADER - Responsive */}
      <div className="flex items-center justify-between p-3 sm:p-4 border-b bg-card shadow-sm">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <Link href="/dashboard">
            <Button
              variant="ghost"
              size="icon"
              className="shrink-0 h-8 w-8 sm:h-10 sm:w-10"
            >
              <ArrowLeft className="h-4 w-4 sm:h-5 sm:w-5" />
            </Button>
          </Link>

          <div className="flex items-center gap-3 min-w-0 flex-1">
            <Avatar className="h-8 w-8 sm:h-10 sm:w-10 shrink-0">
              {otherParticipant?.avatar ? (
                <AvatarImage src={otherParticipant.avatar} />
              ) : (
                <AvatarFallback className="text-xs sm:text-sm">
                  {(otherParticipant?.name || '?').split(' ').map((n: any) => n[0]).join('').slice(0, 2)}
                </AvatarFallback>
              )}
            </Avatar>

            <div className="min-w-0 flex-1">
              <h1 className="font-semibold text-sm sm:text-base truncate">
                {otherParticipant?.name || `Ride Chat`}
              </h1>
              <p className="text-xs sm:text-sm text-muted-foreground truncate">
                {bookingLoading ? 'Loading...' : `Booking #${bookingId?.slice(0, 8)}`}
              </p>
            </div>
          </div>
        </div>

        {/* Action buttons - hidden on very small screens */}
        <div className="flex items-center gap-1 sm:gap-2">
          <Button variant="ghost" size="icon" className="h-8 w-8 sm:h-10 sm:w-10">
            <Phone className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8 sm:h-10 sm:w-10">
            <MoreVertical className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* MESSAGES AREA - Responsive */}
      <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-3 sm:space-y-4 bg-muted/20">
        {historyLoading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
              <Send className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="font-medium text-lg mb-2">Start a conversation</h3>
            <p className="text-muted-foreground text-sm max-w-sm">
              Send a message to discuss ride details, pickup location, or any questions.
            </p>
          </div>
        ) : (
          messages.map((msg, idx) => {
            const isMe = msg.senderId === user.id;
            const sender = bookingDetails?.passenger?.id === msg.senderId
              ? bookingDetails.passenger
              : (bookingDetails?.driver?.id === msg.senderId ? bookingDetails.driver : null);

            const showAvatar = idx === 0 || messages[idx - 1].senderId !== msg.senderId;
            const showTimestamp = idx === messages.length - 1 ||
              messages[idx + 1].senderId !== msg.senderId ||
              new Date(messages[idx + 1].createdAt).getTime() - new Date(msg.createdAt).getTime() > 300000; // 5 minutes

            return (
              <div key={msg.id || idx} className={`flex gap-2 sm:gap-3 ${isMe ? 'justify-end' : 'justify-start'}`}>
                {!isMe && (
                  <div className="flex flex-col items-center gap-1">
                    {showAvatar ? (
                      <Avatar className="h-8 w-8 sm:h-10 sm:w-10 shrink-0">
                        {sender?.avatar ? (
                          <AvatarImage src={sender.avatar} />
                        ) : (
                          <AvatarFallback className="text-xs sm:text-sm">
                            {(sender?.name || '?').split(' ').map((n: any) => n[0]).join('').slice(0, 2)}
                          </AvatarFallback>
                        )}
                      </Avatar>
                    ) : (
                      <div className="h-8 w-8 sm:h-10 sm:w-10" />
                    )}
                  </div>
                )}

                <div className={`flex flex-col gap-1 max-w-[75%] sm:max-w-[70%] ${isMe ? 'items-end' : 'items-start'}`}>
                  <div className={`px-3 py-2 sm:px-4 sm:py-3 rounded-2xl text-sm sm:text-base shadow-sm ${
                    isMe
                      ? 'bg-primary text-primary-foreground rounded-br-sm'
                      : 'bg-card border text-card-foreground rounded-bl-sm'
                  }`}>
                    <p className="break-words">{msg.content}</p>
                  </div>

                  {showTimestamp && (
                    <span className="text-[10px] sm:text-xs text-muted-foreground px-2">
                      {format(new Date(msg.createdAt), 'HH:mm')}
                    </span>
                  )}
                </div>

                {isMe && (
                  <div className="flex flex-col items-center gap-1">
                    {showAvatar ? (
                      <Avatar className="h-8 w-8 sm:h-10 sm:w-10 shrink-0">
                        {user?.avatar ? (
                          <AvatarImage src={user.avatar} />
                        ) : (
                          <AvatarFallback className="text-xs sm:text-sm">
                            {(user?.name || 'Me').split(' ').map((n: any) => n[0]).join('').slice(0, 2)}
                          </AvatarFallback>
                        )}
                      </Avatar>
                    ) : (
                      <div className="h-8 w-8 sm:h-10 sm:w-10" />
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* INPUT AREA - Responsive */}
      <div className="p-3 sm:p-4 bg-card border-t">
        <form onSubmit={handleSend} className="flex gap-2 sm:gap-3">
          <div className="flex-1 relative">
            <Input
              ref={inputRef}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Type a message..."
              className="pr-12 h-10 sm:h-12 text-sm sm:text-base"
              disabled={sendMessageMutation.isPending}
              maxLength={500}
            />
            {inputText.length > 400 && (
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                {inputText.length}/500
              </span>
            )}
          </div>
          <Button
            type="submit"
            size="icon"
            className="h-10 w-10 sm:h-12 sm:w-12 shrink-0"
            disabled={sendMessageMutation.isPending || !inputText.trim()}
          >
            {sendMessageMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </form>
      </div>
    </div>
  );
}
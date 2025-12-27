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
import { Send, ArrowLeft, Loader2 } from "lucide-react";
import Link from "next/link";

// --- TYPES ---
type Message = {
  id: string;
  senderId: string;
  content: string;
  createdAt: string; // use createdAt from server
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

  // 1. Fetch Chat History from Database
  const { data: history } = useQuery<Message[]>({
    queryKey: [`/api/chat/${bookingId}`],
    enabled: !!bookingId
  });

  // Fetch booking details (passenger/driver) to display names and avatars
  const { data: bookingDetails } = useQuery<any>({
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
    }
  });

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;
    sendMessageMutation.mutate(inputText);
  };

  if (!user) return <div className="p-8 text-center">Please log in to chat.</div>;

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] bg-background">
      {/* HEADER */}
      <div className="p-4 border-b flex items-center gap-4 bg-primary text-primary-foreground shadow-md">
        <Link href="/dashboard">
          <Button variant="ghost" size="icon" className="text-primary-foreground hover:bg-primary/20">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div>
          <h2 className="font-semibold text-lg">Ride Chat</h2>
          <p className="text-xs text-primary-foreground/80">
            {bookingDetails ? (
              // show the other participant's name: if current user is passenger, show driver; else show passenger
              (user?.id === bookingDetails.passenger?.id) ? (bookingDetails.driver?.name || `Booking #${bookingId?.slice(0,8)}`) : (bookingDetails.passenger?.name || `Booking #${bookingId?.slice(0,8)}`)
            ) : `Booking #${bookingId?.slice(0,8)}`}
          </p>
        </div>
      </div>

      {/* MESSAGES AREA */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-muted/10">
        {messages.map((msg, idx) => {
          const isMe = msg.senderId === user.id;
          // Determine sender details from booking details
          const sender = bookingDetails?.passenger?.id === msg.senderId ? bookingDetails.passenger : (bookingDetails?.driver?.id === msg.senderId ? bookingDetails.driver : null);
          return (
            <div key={idx} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
              <div className={`flex items-end max-w-[80%] gap-2 ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
                <Avatar className="h-8 w-8 border">
                  {isMe ? (
                    user?.avatar ? (
                      <AvatarImage src={user.avatar} />
                    ) : (
                      <AvatarFallback>{(user?.name || 'Me').split(' ').map((n:any)=>n[0]).join('').slice(0,2)}</AvatarFallback>
                    )
                  ) : sender?.avatar ? (
                    <AvatarImage src={sender.avatar} />
                  ) : (
                    <AvatarFallback>{(sender?.name||'?').split(' ').map((n:any)=>n[0]).join('').slice(0,2)}</AvatarFallback>
                  )}
                </Avatar>

                <div className={`p-3 rounded-2xl text-sm ${isMe ? 'bg-primary text-primary-foreground rounded-br-none' : 'bg-white border shadow-sm rounded-bl-none dark:bg-slate-800 dark:border-border dark:text-slate-200 text-muted-foreground'}`}>
                  <p>{msg.content}</p>
                  <span className={`text-[10px] block mt-1 opacity-70 ${isMe ? 'text-primary-foreground' : 'text-muted-foreground'}`}>
                    {new Date(msg.createdAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true })}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* INPUT AREA */}
      <div className="p-4 bg-background border-t">
        <form onSubmit={handleSend} className="flex gap-2">
          <Input 
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Type your message..."
            className="flex-1"
            disabled={sendMessageMutation.isPending}
          />
          <Button type="submit" size="icon" disabled={sendMessageMutation.isPending || !inputText.trim()}>
            {sendMessageMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </form>
      </div>
    </div>
  );
}
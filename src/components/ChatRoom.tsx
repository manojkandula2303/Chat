import { useState, useEffect, useRef, DragEvent, ChangeEvent, FormEvent } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  Paperclip, Copy, Check, Users, LogOut, Send, 
  Image as ImageIcon, FileText, Video as VideoIcon, Download, X, Eye
} from "lucide-react";
import { Room, Message, Participant } from "../types";
import { formatBytes, formatTime } from "../utils";

interface ChatRoomProps {
  roomId: string;
  room: Room;
  currentUserId: string;
  onSendMessage: (text: string) => Promise<void>;
  onSendFile: (name: string, base64: string, mimeType: string) => Promise<void>;
  onSendTyping: (isTyping: boolean) => Promise<void>;
  onMarkAsRead: () => Promise<void>;
  onLeaveRoom: () => void;
  isSendingMessage: boolean;
  isUploadingFile: boolean;
  uploadProgress: string;
}

export default function ChatRoom({
  roomId,
  room,
  currentUserId,
  onSendMessage,
  onSendFile,
  onSendTyping,
  onMarkAsRead,
  onLeaveRoom,
  isSendingMessage,
  isUploadingFile,
  uploadProgress
}: ChatRoomProps) {
  const [inputText, setInputText] = useState("");
  const [copiedLink, setCopiedLink] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [lightboxName, setLightboxName] = useState<string>("");

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isTypingStateRef = useRef<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Derive other participant
  const currentParticipant = room.participants.find(p => p.id === currentUserId);
  const otherParticipant = room.participants.find(p => p.id !== currentUserId);

  // Auto scroll to bottom
  const scrollToBottom = (behavior: "smooth" | "auto" = "smooth") => {
    messagesEndRef.current?.scrollIntoView({ behavior });
  };

  useEffect(() => {
    scrollToBottom("smooth");
  }, [room.messages.length]);

  // Mark all messages as read once loaded or whenever a new message arrives of other sender
  useEffect(() => {
    const unreadFromOther = room.messages.some(
      m => m.senderId !== currentUserId && m.status !== "read"
    );
    if (unreadFromOther) {
      onMarkAsRead();
    }
  }, [room.messages, currentUserId, onMarkAsRead]);

  // Handle Clipboard Copy
  const handleCopyLink = () => {
    const inviteUrl = `${window.location.origin}/#room/${roomId}`;
    navigator.clipboard.writeText(inviteUrl).then(() => {
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    });
  };

  // Handle typing state emission on key presses
  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    setInputText(e.target.value);

    if (!isTypingStateRef.current) {
      isTypingStateRef.current = true;
      onSendTyping(true);
    }

    if (typingTimerRef.current) {
      clearTimeout(typingTimerRef.current);
    }

    typingTimerRef.current = setTimeout(() => {
      isTypingStateRef.current = false;
      onSendTyping(false);
    }, 2000);
  };

  const handleSendText = async (e: FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || isSendingMessage) return;

    const msg = inputText.trim();
    setInputText("");

    // Clear typing states
    if (typingTimerRef.current) {
      clearTimeout(typingTimerRef.current);
    }
    isTypingStateRef.current = false;
    onSendTyping(false);

    await onSendMessage(msg);
  };

  // Process File Buffer uploading
  const processSelectedFile = async (file: File) => {
    if (file.size > 25 * 1024 * 1024) {
      alert("Privacy Safe limit: Files must be under 25 megabytes.");
      return;
    }

    const reader = new FileReader();
    reader.onload = async (e) => {
      const base64 = e.target?.result as string;
      if (base64) {
        await onSendFile(file.name, base64, file.type);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processSelectedFile(e.target.files[0]);
    }
  };

  // Drag and drop events
  const handleDrag = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processSelectedFile(e.dataTransfer.files[0]);
    }
  };

  // Media render functions
  const renderMessageContent = (msg: Message) => {
    if (msg.type === "text") {
      return (
        <p className="text-sm leading-relaxed whitespace-pre-wrap break-words font-light">
          {msg.text}
        </p>
      );
    }

    if (msg.type === "file" && msg.file) {
      const f = msg.file;
      const isImg = f.type.startsWith("image/");
      const isVid = f.type.startsWith("video/");

      if (isImg) {
        return (
          <div className="space-y-2">
            <div className="relative group max-w-sm rounded-lg overflow-hidden border border-brand-border bg-brand-accent-light/50">
              <img
                src={f.url}
                alt={f.name}
                referrerPolicy="no-referrer"
                className="max-h-60 w-full object-cover cursor-pointer hover:opacity-95 transition-opacity duration-200"
                onClick={() => {
                  setLightboxUrl(f.url);
                  setLightboxName(f.name);
                }}
              />
              <div className="absolute right-2 top-2 p-1.5 bg-brand-text/75 rounded-full text-brand-bg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none">
                <Eye className="w-3.5 h-3.5" />
              </div>
            </div>
            <div className="flex items-center space-x-1.5 text-[10px] text-brand-muted font-mono">
              <span className="truncate max-w-xs">{f.name}</span>
              <span>·</span>
              <span>{formatBytes(f.size)}</span>
              <a
                href={f.url}
                download={f.name}
                className="p-1 hover:text-brand-text hover:bg-brand-accent-light rounded transition-all ml-auto"
                title="Download Image"
              >
                <Download className="w-3 h-3" />
              </a>
            </div>
          </div>
        );
      }

      if (isVid) {
        return (
          <div className="space-y-2 max-w-sm">
            <div className="rounded-lg overflow-hidden border border-brand-border bg-black">
              <video
                src={f.url}
                controls
                referrerPolicy="no-referrer"
                className="max-h-60 w-full"
              />
            </div>
            <div className="flex items-center space-x-1.5 text-[10px] text-brand-muted font-mono">
              <span className="truncate max-w-xs">{f.name}</span>
              <span>·</span>
              <span>{formatBytes(f.size)}</span>
              <a
                href={f.url}
                download={f.name}
                className="p-1 hover:text-brand-text hover:bg-brand-accent-light rounded transition-all ml-auto"
                title="Download Video"
              >
                <Download className="w-3 h-3" />
              </a>
            </div>
          </div>
        );
      }

      // Default Document template
      return (
        <div className="flex items-center space-x-3 bg-brand-bg hover:bg-brand-accent-light/50 border border-brand-border rounded-xl p-3.5 transition-all w-full max-w-xs select-none">
          <div className="p-2.5 bg-brand-card border border-brand-border rounded-lg text-brand-accent shadow-sm">
            <FileText className="w-5 h-5 stroke-[1.5]" />
          </div>
          <div className="flex-1 min-w-0 pr-1">
            <p className="text-xs font-medium text-brand-text truncate" title={f.name}>
              {f.name}
            </p>
            <p className="text-[10px] font-mono text-brand-muted mt-0.5">
              {formatBytes(f.size)}
            </p>
          </div>
          <a
            href={f.url}
            download={f.name}
            className="p-2 h-9 w-9 bg-brand-card hover:bg-brand-accent hover:text-brand-bg rounded-lg border border-brand-border flex items-center justify-center transition-all cursor-pointer"
            title="Download Document"
          >
            <Download className="w-3.5 h-3.5" />
          </a>
        </div>
      );
    }
  };

  // Render Status labels (Sent, Delivered, Read)
  const renderMessageMetadata = (msg: Message) => {
    const isMe = msg.senderId === currentUserId;
    const timeStr = formatTime(msg.timestamp);

    if (!isMe) {
      return (
        <span className="text-[9px] font-mono text-brand-muted/70 tracking-tight uppercase">
          {timeStr}
        </span>
      );
    }

    let statusDisplay = "···";
    if (msg.status === "sent") statusDisplay = "Sent";
    if (msg.status === "delivered") statusDisplay = "Delivered";
    if (msg.status === "read") statusDisplay = "Read";

    return (
      <span className="text-[9px] font-mono text-brand-muted/70 tracking-tight uppercase flex items-center justify-end space-x-1.5 select-none">
        <span>{timeStr}</span>
        <span className="text-brand-border select-none">·</span>
        <span className={msg.status === "read" ? "text-emerald-600 font-medium" : ""}>
          {statusDisplay}
        </span>
      </span>
    );
  };

  const getRoleLabel = (pid: string) => {
    const idx = room.participants.findIndex(p => p.id === pid);
    if (idx === 0) return "Host";
    return idx >= 0 ? `Resident ${idx + 1}` : "Guest";
  };

  return (
    <div 
      className="h-screen flex flex-col justify-between relative bg-brand-bg/40"
      onDragEnter={handleDrag}
      onDragOver={handleDrag}
      onDragLeave={handleDrag}
      onDrop={handleDrop}
    >
      {/* Top Header Bar */}
      <header className="px-6 py-4 bg-brand-card border-b border-brand-border flex items-center justify-between z-10 shadow-xs">
        {/* Participants States */}
        <div className="flex items-center space-x-4">
          <div className="flex flex-col">
            <div className="flex items-center space-x-2">
              <span className="font-display font-medium text-sm text-brand-text">
                {room.participants.length > 1 ? `Channel Chat (${room.participants.length}/${room.maxParticipants || 10})` : "Awaiting Guest..."}
              </span>
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 bg-emerald-400" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
              </span>
            </div>
            <div className="text-[10px] font-mono text-brand-muted hover:text-brand-text transition-colors mt-0.5 select-none flex items-center space-x-1.5">
              <span>{room.participants.filter(p => p.isOnline).length} online</span>
              <span>·</span>
              <span>{room.participants.length > 1 ? (room.maxParticipants === 2 ? "Secure Private Pair" : "Secure Deca Group") : "Awaiting participants to enter"}</span>
            </div>
          </div>
        </div>

        {/* Action Tray */}
        <div className="flex items-center space-x-2">
          {/* Active room indicator & invite copying */}
          <button
            onClick={handleCopyLink}
            className="flex items-center space-x-1.5 bg-brand-bg hover:bg-brand-accent-light text-brand-text hover:text-brand-text px-3 py-1.5 rounded-lg border border-brand-border text-xs transition-colors cursor-pointer"
          >
            {copiedLink ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-600" />
                <span className="font-mono text-emerald-600 font-medium">Link Copied!</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5 stroke-[1.5]" />
                <span className="font-mono text-brand-muted select-none">Copy Invitation</span>
              </>
            )}
          </button>

          <button
            onClick={onLeaveRoom}
            title="Leave and close chat channel"
            className="p-1.5 text-brand-muted hover:text-brand-text bg-brand-bg hover:bg-brand-accent-light rounded-lg border border-brand-border transition-colors cursor-pointer"
          >
            <LogOut className="w-4 h-4 stroke-[1.5]" />
          </button>
        </div>
      </header>

      {/* Messages Board */}
      <main className="flex-1 overflow-y-auto px-6 py-8 space-y-6">
        <div className="max-w-2xl mx-auto space-y-6">
          
          {/* Privacy Welcome banner */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="border border-dashed border-brand-border rounded-xl p-5 text-center space-y-2 bg-brand-card/35 max-w-lg mx-auto"
          >
            <p className="text-xs font-mono tracking-wider text-brand-muted uppercase">
              {room.maxParticipants === 2 ? "Secure Private Pair" : "Secure Multi-User Channel"}
            </p>
            <p className="text-xs font-light text-brand-muted leading-relaxed">
              This space functions entirely in memory and locally. No logs are held. Invite links expire when all participants disconnect.
            </p>
            {room.participants.length < (room.maxParticipants || 10) && (
              <div className="pt-2">
                <button
                  onClick={handleCopyLink}
                  className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-brand-accent text-brand-bg hover:bg-brand-text transition-colors duration-150 rounded-lg font-display font-medium text-[10px] tracking-wide uppercase cursor-pointer"
                >
                  <Copy className="w-3 h-3" />
                  <span>Share invitation to join ({room.participants.length}/{room.maxParticipants || 10})</span>
                </button>
              </div>
            )}
          </motion.div>

          {/* Active room residents listing */}
          <div className="flex justify-center flex-wrap gap-2 text-[10px] font-mono text-brand-muted/75 uppercase select-none">
            {room.participants.map((p) => (
              <div key={p.id} className="flex items-center space-x-1 border border-brand-border rounded-full px-2 py-0.5 bg-brand-card">
                <span className={`w-1 h-1 rounded-full ${p.isOnline ? "bg-emerald-500" : "bg-neutral-400"}`} />
                <span>{p.name} ({getRoleLabel(p.id)})</span>
              </div>
            ))}
          </div>

          <div className="space-y-4 pt-4">
            {room.messages.map((msg) => {
              const isMe = msg.senderId === currentUserId;
              return (
                <div
                  key={msg.id}
                  className={`flex flex-col ${isMe ? "items-end" : "items-start"} animate-msg-fade`}
                >
                  <div className="max-w-[85%] md:max-w-[70%] space-y-1">
                    {/* Speaker name */}
                    <p className={`text-[10px] font-mono text-brand-muted/70 tracking-wide uppercase px-1.5 ${isMe ? "text-right" : "text-left"}`}>
                      {isMe ? "You" : msg.senderName} <span className="text-neutral-300">·</span> {getRoleLabel(msg.senderId)}
                    </p>

                    {/* Speech bubble */}
                    <div
                      className={`px-4 py-3.5 rounded-2xl shadow-xs border ${
                        isMe
                          ? "bg-brand-accent/50 text-brand-text border-brand-border rounded-tr-none"
                          : "bg-brand-card text-brand-text border-brand-border rounded-tl-none"
                      }`}
                    >
                      {renderMessageContent(msg)}
                    </div>

                    {/* Metadata line (Status / Time) */}
                    <div className="px-1.5">
                      {renderMessageMetadata(msg)}
                    </div>
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>
        </div>
      </main>

      {/* Footer Area with Input, Typing awareness & File Uploader progress */}
      <footer className="bg-brand-card border-t border-brand-border p-4 sticky bottom-0">
        <div className="max-w-2xl mx-auto space-y-2">
          
          {/* Bottom Indicators Row (Files uploading, typing) */}
          <div className="h-4 flex items-center justify-between text-[11px] font-mono text-brand-muted">
            <div className="select-none">
              <AnimatePresence>
                {(() => {
                  const typingParticipants = room.participants.filter(p => p.id !== currentUserId && p.isTyping);
                  if (typingParticipants.length === 0) return null;
                  return (
                    <motion.div
                      initial={{ opacity: 0, y: 3 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 3 }}
                      className="flex items-center space-x-1.5 text-brand-muted"
                    >
                      <span className="flex space-x-1 items-center py-0.5">
                        <span className="w-1 h-1 bg-brand-muted rounded-full animate-bounce [animation-delay:-0.3s]" />
                        <span className="w-1 h-1 bg-brand-muted rounded-full animate-bounce [animation-delay:-0.15s]" />
                        <span className="w-1 h-1 bg-brand-muted rounded-full animate-bounce" />
                      </span>
                      <span>
                        {typingParticipants.length === 1
                          ? `${typingParticipants[0].name} is drafting...`
                          : typingParticipants.length === 2
                          ? `${typingParticipants[0].name} and ${typingParticipants[1].name} are drafting...`
                          : `${typingParticipants.length} people are drafting...`}
                      </span>
                    </motion.div>
                  );
                })()}
              </AnimatePresence>
            </div>

            <div>
              {isUploadingFile && (
                <div className="flex items-center space-x-2 text-brand-accent font-medium">
                  <span className="w-3 h-3 border-2 border-brand-accent/30 border-t-brand-accent rounded-full animate-spin" />
                  <span>{uploadProgress || "Encrypting file upload..."}</span>
                </div>
              )}
            </div>
          </div>

          {/* Core Chat Box Bar */}
          <form onSubmit={handleSendText} className="relative flex items-center space-x-2">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              className="hidden"
              id="file-element"
              accept="image/*,video/*,application/pdf,text/*,.zip,.rar,.doc,.docx"
            />
            {/* Attachment Button */}
            <button
              type="button"
              id="clip-btn"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploadingFile}
              title="Attach media secure files"
              className="flex items-center justify-center p-3 bg-brand-bg hover:bg-brand-accent-light text-brand-muted hover:text-brand-text rounded-xl border border-brand-border transition-colors disabled:opacity-50 cursor-pointer"
            >
              <Paperclip className="w-4 h-4 stroke-[1.5]" />
            </button>

            {/* Main input string */}
            <input
              type="text"
              id="chat-input"
              value={inputText}
              onChange={handleInputChange}
              disabled={isSendingMessage || isUploadingFile}
              placeholder={room.participants.length > 1 ? "Formulate a message..." : "Share link above to invite guests..."}
              className="flex-1 bg-brand-bg outline-none border border-brand-border focus:border-brand-text/50 text-sm py-3 px-4 rounded-xl font-light transition-all disabled:opacity-50"
              autoComplete="off"
            />

            {/* Send Button */}
            <AnimatePresence>
              {inputText.trim() && (
                <motion.button
                  type="submit"
                  id="send-msg-btn"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.15 }}
                  disabled={isSendingMessage}
                  className="p-3 bg-brand-accent hover:bg-brand-text text-brand-bg rounded-xl flex items-center justify-center transition-colors disabled:opacity-50 cursor-pointer shadow-xs"
                >
                  <Send className="w-4 h-4 stroke-[1.5]" />
                </motion.button>
              )}
            </AnimatePresence>
          </form>
        </div>
      </footer>

      {/* Drag & Drop Overlay */}
      <AnimatePresence>
        {dragActive && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-brand-text/70 backdrop-blur-xs flex flex-col items-center justify-center space-y-4 z-50 p-6 text-brand-bg border-4 border-dashed border-brand-border/40 m-4 rounded-2xl pointer-events-none"
          >
            <div className="p-4 bg-brand-bg/10 rounded-full border border-brand-bg/20">
              <Paperclip className="w-8 h-8 animate-pulse text-brand-bg" />
            </div>
            <div className="text-center space-y-1">
              <p className="font-display text-lg font-light tracking-wide">
                Drop files privately here
              </p>
              <p className="text-xs font-mono text-brand-bg/60 uppercase">
                Up to 25 Megabytes
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Interactive Lightbox Overlay */}
      <AnimatePresence>
        {lightboxUrl && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-neutral-950/95 backdrop-blur-sm z-50 flex flex-col justify-between p-6 overflow-hidden select-none"
          >
            {/* Lightbox Header */}
            <div className="flex items-center justify-between text-white border-b border-white/5 pb-3">
              <span className="text-xs font-mono truncate max-w-lg tracking-wide">{lightboxName}</span>
              <button
                onClick={() => setLightboxUrl(null)}
                className="p-2 hover:bg-white/10 rounded-full transition-colors cursor-pointer text-white/80 hover:text-white"
              >
                <X className="w-5 h-5 stroke-[1.5]" />
              </button>
            </div>

            {/* Lightbox Container */}
            <div className="flex-1 flex items-center justify-center min-h-0 py-6">
              <motion.img
                initial={{ scale: 0.96, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.96, opacity: 0 }}
                transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                src={lightboxUrl}
                alt={lightboxName}
                referrerPolicy="no-referrer"
                className="max-h-full max-w-full object-contain select-none"
              />
            </div>

            {/* Lightbox Footer */}
            <div className="flex justify-center pt-2">
              <a
                href={lightboxUrl}
                download={lightboxName}
                className="flex items-center space-x-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-100 font-display px-6 py-2.5 rounded-full text-xs font-medium cursor-pointer transition-colors shadow-lg"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Save to device</span>
              </a>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

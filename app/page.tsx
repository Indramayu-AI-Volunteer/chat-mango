"use client"

import { useState, useRef, useEffect } from "react"
import { Send, User, Loader2, Settings, Save, ExternalLink, Maximize, Minimize, Plus, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { MangoIcon } from "./components/MangoIcon"
import { TopengIcon } from "./components/TopengIcon"
import { MarkdownMessage } from "./components/MarkdownMessage"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogFooter, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { useRouter } from "next/navigation"

// Tentukan tipe pesan chat
interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

// Tipe untuk mode tampilan
type ViewMode = 'fullscreen' | 'lightwidescreen';

// Daftar versi model Gemini
const geminiVersions = [
  "gemini-1.0-pro",
  "gemini-1.5-pro",
  "gemini-1.5-flash",
  "gemini-2.0-flash"
];

const LangAIResponses = [
  "Bahasa Jawa Indramayu",
  "Sesuai Prompt"
];

export default function ChatPage() {
  const router = useRouter();
  const [accountOpen, setAccountOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [inputRows, setInputRows] = useState(1);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // State untuk sidebar
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [selectedModel, setSelectedModel] = useState("gemini");
  const [geminiVersion, setGeminiVersion] = useState("gemini-2.0-flash");
  const [langAIResponse, setLangAIResponse] = useState("Bahasa Jawa Indramayu");
  const [hfToken, setHfToken] = useState("");
  const [hfEndpoint, setHfEndpoint] = useState("");
  const [colabEndpoint, setColabEndpoint] = useState("");
  const [vllmEndpoint, setVllmEndpoint] = useState("");

  // State untuk mode tampilan
  const [viewMode, setViewMode] = useState<ViewMode>('lightwidescreen');

  // Chat sessions state and persistence
  interface Session {
    id: string;
    name: string;
    messages: ChatMessage[];
    createdAt: number;
  }
  const [sessions, setSessions] = useState<Session[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string>("");

  // Load sessions from localStorage
  useEffect(() => {
    const stored = localStorage.getItem("chatSessions");
    let parsed: Session[] = [];
    try {
      parsed = stored ? JSON.parse(stored) : [];
    } catch {
      parsed = [];
    }
    if (parsed.length > 0) {
      setSessions(parsed);
      const storedId = localStorage.getItem("currentSessionId");
      const exists = storedId && parsed.some(s => s.id === storedId);
      const targetId = exists ? storedId! : parsed[0].id;
      setCurrentSessionId(targetId);
      setMessages(parsed.find(s => s.id === targetId)!.messages);
      localStorage.setItem("currentSessionId", targetId);
    } else {
      const id = Date.now().toString();
      const newSess: Session = { id, name: `Session ${new Date().toLocaleString()}`, messages: [], createdAt: Date.now() };
      setSessions([newSess]);
      setCurrentSessionId(id);
      setMessages([]);
      localStorage.setItem("chatSessions", JSON.stringify([newSess]));
      localStorage.setItem("currentSessionId", id);
    }
  }, []);

  // Update sessions when messages change
  useEffect(() => {
    if (!currentSessionId) return;
    setSessions(prev =>
      prev.map(s => s.id === currentSessionId ? { ...s, messages } : s)
    );
  }, [messages, currentSessionId]);

  // Persist sessions to localStorage
  useEffect(() => {
    localStorage.setItem("chatSessions", JSON.stringify(sessions));
  }, [sessions]);

  const selectSession = (id: string) => {
    const sess = sessions.find(s => s.id === id);
    if (sess) {
      setCurrentSessionId(id);
      setMessages(sess.messages);
      localStorage.setItem("currentSessionId", id);
    }
  };

  const newSession = () => {
    const id = Date.now().toString();
    const name = `Session ${new Date().toLocaleString()}`;
    const newSess: Session = { id, name, messages: [], createdAt: Date.now() };
    setSessions(prev => [...prev, newSess]);
    selectSession(id);
  };

  // Delete a session, and update current session if needed
  const deleteSession = (id: string) => {
    setSessions(prev => prev.filter(s => s.id !== id));
    if (id === currentSessionId) {
      const remaining = sessions.filter(s => s.id !== id);
      if (remaining.length > 0) {
        const next = remaining[0];
        setCurrentSessionId(next.id);
        setMessages(next.messages);
        localStorage.setItem("currentSessionId", next.id);
      } else {
        // No sessions left, create new
        const newId = Date.now().toString();
        const fresh: Session = { id: newId, name: `Session ${new Date().toLocaleString()}`, messages: [], createdAt: Date.now() };
        setSessions([fresh]);
        setCurrentSessionId(newId);
        setMessages([]);
        localStorage.setItem("currentSessionId", newId);
      }
    }
  };

  // Auto-resize textarea based on content
  useEffect(() => {
    const rows = input.split("\n").length;
    setInputRows(Math.min(5, Math.max(1, rows)));
  }, [input]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // For debugging
  useEffect(() => {
    if (messages.length > 0) {
      console.log("Current messages:", messages);
    }
  }, [messages]);

  // Load view mode from localStorage
  useEffect(() => {
    const savedViewMode = localStorage.getItem("viewMode");
    if (savedViewMode && (savedViewMode === 'fullscreen' || savedViewMode === 'lightwidescreen')) {
      setViewMode(savedViewMode as ViewMode);
    }
  }, []);

  // Toggle view mode
  const toggleViewMode = () => {
    const newMode = viewMode === 'fullscreen' ? 'lightwidescreen' : 'fullscreen';
    setViewMode(newMode);
    localStorage.setItem("viewMode", newMode);
  };

  // Handle input change
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
  };

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    // Add user message
    const userMessage: ChatMessage = { role: 'user', content: input.trim() };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    try {

      // Send to API with model configuration
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messages: [...messages, userMessage],
          config: {
            model: selectedModel,
            ...(selectedModel === "gemini" && {
              gemini_version: geminiVersion,
              lang_ai_response: langAIResponse
            }),
            ...(selectedModel === "huggingface" && {
              hf_token: hfToken,
              hf_endpoint: hfEndpoint
            }),
            ...(selectedModel === "colab" && {
              colab_endpoint: colabEndpoint
            }),
            ...(selectedModel === "vllm" && {
              vllm_endpoint: vllmEndpoint
            })
          }
        }),
      });

      if (!response.ok) {
        throw new Error(`API responded with status ${response.status}`);
      }

      // Parse response
      const data = await response.json();

      // Extract AI response and add to messages
      if (data.choices && data.choices[0]?.message) {
        const aiMessage: ChatMessage = {
          role: 'assistant',
          content: data.choices[0].message.content
        };
        setMessages((prev) => [...prev, aiMessage]);
      } else {
        console.error("Unexpected API response format:", data);
        throw new Error("Unexpected API response format");
      }
    } catch (error) {
      console.error("Error in chat:", error);
      // Add error message
      setMessages((prev) => [...prev, { role: 'assistant', content: "Maaf, terjadi kesalahan saat memproses permintaan Anda." }]);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle saving settings
  const handleSaveSettings = () => {
    // console.log langAIResponse from localStorage
    // console.log("langAIResponse from localStorage:", langAIResponse);
    // Simpan pengaturan (bisa ditambahkan ke localStorage)
    localStorage.setItem("chatSettings", JSON.stringify({
      model: selectedModel,
      geminiVersion: geminiVersion,
      langAIResponse: langAIResponse,
      hfToken: hfToken,
      hfEndpoint: hfEndpoint,
      colabEndpoint: colabEndpoint,
      vllmEndpoint: vllmEndpoint
    }));

    // Tutup sidebar
    setSettingsOpen(false);
  };

  // Load settings from localStorage
  useEffect(() => {
    const savedSettings = localStorage.getItem("chatSettings");
    if (savedSettings) {
      try {
        const settings = JSON.parse(savedSettings);
        setSelectedModel(settings.model || "gemini");
        setGeminiVersion(settings.geminiVersion || "gemini-2.0-flash");
        setLangAIResponse(settings.langAIResponse || "Bahasa Jawa Indramayu");
        setHfToken(settings.hfToken || "");
        setHfEndpoint(settings.hfEndpoint || "");
        setColabEndpoint(settings.colabEndpoint || "");
        setVllmEndpoint(settings.vllmEndpoint || "");
      } catch (error) {
        console.error("Error parsing saved settings:", error);
      }
    }
  }, []);

  return (
    <div className={cn(
      "flex min-h-screen max-h-screen overflow-hidden bg-gray-50 transition-all duration-300 ease-in-out",
      viewMode === 'lightwidescreen' && "p-4"
    )}>
      <div className={cn(
        "flex w-full min-h-[90vh] max-h-[90vh] bg-white",
        viewMode === 'lightwidescreen' && "rounded-2xl overflow-hidden shadow-lg max-w-[80%] mx-auto"
      )}>
        {/* Sidebar with sessions and Settings */}
        <div className="fixed inset-y-0 left-0 z-50 w-64 bg-white border-r flex flex-col justify-between md:relative md:translate-x-0">
          {/* Sessions list */}
          <div className="overflow-y-auto flex-1 p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Chat Sessions</h3>
              <Button variant="ghost" size="icon" onClick={newSession}>
                <Plus className="w-4 h-4" />
              </Button>
            </div>
            <ul className="space-y-2">
              {sessions.map(sess => (
                <li key={sess.id}>
                  <div className="flex items-center justify-between group">
                    <button
                      onClick={() => selectSession(sess.id)}
                      className={cn(
                        "flex-1 text-left px-2 py-1 rounded",
                        sess.id === currentSessionId
                          ? "bg-[#FDBE02] text-white"
                          : "hover:bg-gray-100 text-gray-800"
                      )}
                    >
                      {sess.name}
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteSession(sess.id);
                      }}
                      className="opacity-0 group-hover:opacity-100 p-1 text-red-500"
                      aria-label="Delete session"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
          {/* Settings trigger */}
          <div className="p-4 border-t space-y-2">
            {/* Account trigger */}
            <Dialog open={accountOpen} onOpenChange={setAccountOpen}>
              <DialogTrigger asChild>
                <Button variant="ghost" size="icon" className="w-full justify-start">
                  <User className="w-5 h-5 mr-2" />
                  Account
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Account</DialogTitle>
                </DialogHeader>
                <DialogFooter className="flex space-x-2">
                  <Button variant="outline" onClick={() => { setAccountOpen(false); router.push("/login"); }}>
                    Login
                  </Button>
                  <Button onClick={() => { setAccountOpen(false); router.push("/register"); }}>
                    Register
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            {/* Feedback & Donate buttons */}
            <Button variant="ghost" size="icon" className="w-full justify-start" onClick={() => window.open('https://example.com/feedback', '_blank')}>
              <ExternalLink className="w-5 h-5 mr-2" />
              Feedback
            </Button>
            <Button variant="ghost" size="icon" className="w-full justify-start" onClick={() => window.open('https://example.com/donate', '_blank')}>
              <ExternalLink className="w-5 h-5 mr-2" />
              Donate
            </Button>
            {/* Settings trigger */}
            <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
              <DialogTrigger asChild>
                <Button variant="ghost" size="icon" className="w-full justify-start">
                  <Settings className="w-5 h-5 mr-2" />
                  Settings
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Settings</DialogTitle>
                  <DialogDescription>Configure your model and endpoints</DialogDescription>
                </DialogHeader>
                <div className="space-y-6">
                  {/* Model Selection */}
                  <div className="space-y-2">
                    <Label htmlFor="model-select">Select Model</Label>
                    <Select
                      value={selectedModel}
                      onValueChange={setSelectedModel}
                    >
                      <SelectTrigger id="model-select">
                        <SelectValue placeholder="Select a model" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="gemini">Gemini</SelectItem>
                        <SelectItem value="huggingface">Huggingface</SelectItem>
                        <SelectItem value="colab">Google Colab(FastAPI)</SelectItem>
                        <SelectItem value="pellm">PeLLM-Komodo (unavailable)</SelectItem>
                        <SelectItem value="vllm">VLLM (unavailable)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Gemini Settings */}
                  {selectedModel === "gemini" && (
                    <div className="space-y-3">
                      <div className="space-y-2">
                        <Label htmlFor="gemini-version" className="text-sm font-medium">Gemini Version</Label>
                        <Select
                          value={geminiVersion}
                          onValueChange={setGeminiVersion}
                        >
                          <SelectTrigger id="gemini-version">
                            <SelectValue placeholder="Select version" />
                          </SelectTrigger>
                          <SelectContent>
                            {geminiVersions.map((version) => (
                              <SelectItem key={version} value={version}>
                                {version}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="lang-ai-response" className="text-sm font-medium">Bahasa Untuk Respon AI</Label>
                        <Select
                          value={langAIResponse}
                          onValueChange={setLangAIResponse}
                        >
                          <SelectTrigger id="lang-ai-response">
                            <SelectValue placeholder="Select version" />
                          </SelectTrigger>
                          <SelectContent>
                            {LangAIResponses.map((version) => (
                              <SelectItem key={version} value={version}>
                                {version}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                  )}

                  {/* Huggingface Settings */}
                  {selectedModel === "huggingface" && (
                    <div className="space-y-3">
                      <div className="space-y-2">
                        <Label htmlFor="hf-token" className="text-sm font-medium">HF Token</Label>
                        <Input
                          id="hf-token"
                          type="password"
                          value={hfToken}
                          onChange={(e) => setHfToken(e.target.value)}
                          placeholder="Enter Huggingface Token"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="hf-endpoint" className="text-sm font-medium">HF Endpoint URL</Label>
                        <Input
                          id="hf-endpoint"
                          type="text"
                          value={hfEndpoint}
                          onChange={(e) => setHfEndpoint(e.target.value)}
                          placeholder="Enter Endpoint URL"
                        />
                      </div>
                    </div>
                  )}

                  {/* Google Colab Settings */}
                  {selectedModel === "colab" && (
                    <div className="space-y-3">
                      <div className="space-y-2">
                        <Label htmlFor="colab-endpoint" className="text-sm font-medium">URL Endpoint</Label>
                        <Input
                          id="colab-endpoint"
                          type="text"
                          value={colabEndpoint}
                          onChange={(e) => setColabEndpoint(e.target.value)}
                          placeholder="https://your-ngrok-url/"
                        />
                      </div>
                      <Alert className="bg-blue-50 text-blue-800 border-blue-200 text-xs">
                        <AlertDescription>
                          Contoh kode google colab bisa diakses pada {" "}
                          <a href="https://colab.research.google.com/drive/1SvPh9n00W-x82k8xlZtYj0F6AZHKJ0tz?usp=sharing" target="_blank" rel="noopener noreferrer" className="underline text-blue-600 flex items-center">
                            URL Google Colab
                            <ExternalLink className="ml-1 w-3 h-3" />
                          </a>
                          {" "}atau bisa diakses pada link{" "}
                          <a href="https://inihanyalahcontohurlsaja2.com/" target="_blank" rel="noopener noreferrer" className="underline text-blue-600 flex items-center">
                            inihanyalahcontohurlsaja2.com (unavailable)
                            <ExternalLink className="ml-1 w-3 h-3" />
                          </a>
                        </AlertDescription>
                      </Alert>
                    </div>
                  )}

                  {/* VLLM Settings */}
                  {selectedModel === "vllm" && (
                    <div className="space-y-3">
                      <div className="space-y-2">
                        <Label htmlFor="vllm-endpoint" className="text-sm font-medium">URL Endpoint</Label>
                        <Input
                          id="vllm-endpoint"
                          type="text"
                          value={vllmEndpoint}
                          onChange={(e) => setVllmEndpoint(e.target.value)}
                          placeholder="https://your-vllm-endpoint/"
                        />
                      </div>
                    </div>
                  )}
                </div>
                <DialogFooter>
                  <Button onClick={handleSaveSettings}>Save Settings</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex flex-col flex-1 h-full max-h-full overflow-hidden">
          {/* Header */}
          <header className="flex items-center justify-between px-4 py-3 border-b bg-[#FDBE02] text-white flex-shrink-0">
            <div className="flex items-center">
              <MangoIcon className="w-6 h-6 mr-2 text-white" />
              <h1 className="text-xl font-bold">chatMango</h1>
            </div>
            <div className="flex gap-2">
              {/* View Mode Toggle */}
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={toggleViewMode}
                      className="text-white hover:bg-[#E5AB02]"
                    >
                      {viewMode === 'fullscreen' ?
                        <Minimize className="w-5 h-5" /> :
                        <Maximize className="w-5 h-5" />
                      }
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    {viewMode === 'fullscreen' ? 'Switch to Light Mode' : 'Switch to Full Mode'}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </header>

          {/* Chat Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center text-[#FDBE02]">
                <TopengIcon style={{ width: '14rem', height: '14rem' }} className="mb-4 text-[#FDBE02]" />
                <h2 className="text-xl font-semibold mb-2">Welcome to chatMango</h2>
                <p className="max-w-md">
                  Ask me anything and I'll do my best to help you. I can answer questions, provide information, and assist
                  with various tasks.
                </p>
              </div>
            ) : (
              messages.map((message, index) => (
                <div
                  key={index}
                  className={cn("flex items-start gap-3",
                    message.role === "user" ? "justify-end ml-auto max-w-3xl" : "mr-auto max-w-3xl"
                  )}
                >
                  {message.role === "user" ? (
                    // User message - Align right
                    <>
                      <div
                        className={cn(
                          "rounded-lg px-4 py-2 max-w-[85%]",
                          "bg-[#FDBE02] text-white"
                        )}
                      >
                        <div className="prose prose-sm whitespace-pre-wrap text-right">{message.content}</div>
                      </div>
                      <div
                        className={cn(
                          "flex items-center justify-center w-8 h-8 rounded-full shrink-0",
                          "bg-[#FDBE02] text-white"
                        )}
                      >
                        <User className="w-5 h-5" />
                      </div>
                    </>
                  ) : (
                    // Assistant message - Now using MarkdownMessage component
                    <>
                      <div
                        className={cn(
                          "flex items-center justify-center w-8 h-8 rounded-full shrink-0",
                          "bg-[#FDBE02] text-white"
                        )}
                      >
                        <MangoIcon className="w-5 h-5" />
                      </div>
                      <div
                        className={cn(
                          "rounded-lg px-4 py-2 max-w-[85%]",
                          "bg-white border border-gray-200 text-black"
                        )}
                      >
                        <MarkdownMessage content={message.content} />
                      </div>
                    </>
                  )}
                </div>
              ))
            )}
            {isLoading && (
              <div className="flex items-start gap-3 max-w-3xl mr-auto">
                <div className="flex items-center justify-center w-8 h-8 rounded-full shrink-0 bg-[#FDBE02] text-white">
                  <MangoIcon className="w-5 h-5" />
                </div>
                <div className="rounded-lg px-4 py-2 bg-white border border-gray-200 text-black">
                  <Loader2 className="w-4 h-4 animate-spin" />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Form */}
          <div className="border-t p-4 bg-white flex-shrink-0">
            <form onSubmit={handleSubmit} className="flex items-end gap-2 max-w-3xl mx-auto">
              <Textarea
                value={input}
                onChange={handleInputChange}
                placeholder="Type your message..."
                className="flex-1 min-h-10 resize-none border-gray-300 focus:border-[#FDBE02] focus:ring-[#FDBE02]"
                rows={inputRows}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault()
                    if (input.trim()) {
                      handleSubmit(e as any)
                    }
                  }
                }}
              />
              <Button
                type="submit"
                disabled={isLoading || !input.trim()}
                className="bg-[#FDBE02] hover:bg-[#E5AB02] text-white"
              >
                <Send className="w-4 h-4" />
                <span className="sr-only">Send</span>
              </Button>
            </form>
          </div>
        </div>
      </div>
    </div>
  )
}

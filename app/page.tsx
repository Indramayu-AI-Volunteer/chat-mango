"use client"

import { useState, useRef, useEffect } from "react"
import { Send, Bot, User, Loader2, Settings, Save } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"

// Tentukan tipe pesan chat
interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export default function ChatPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [inputRows, setInputRows] = useState(1);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // State untuk sidebar
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [selectedModel, setSelectedModel] = useState("gemini");
  const [hfToken, setHfToken] = useState("");
  const [hfEndpoint, setHfEndpoint] = useState("");

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
            ...(selectedModel === "huggingface" && {
              hf_token: hfToken,
              hf_endpoint: hfEndpoint
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
    // Simpan pengaturan (bisa ditambahkan ke localStorage)
    localStorage.setItem("chatSettings", JSON.stringify({
      model: selectedModel,
      hfToken: hfToken,
      hfEndpoint: hfEndpoint
    }));

    // Tutup sidebar
    setIsSidebarOpen(false);
  };

  // Load settings from localStorage
  useEffect(() => {
    const savedSettings = localStorage.getItem("chatSettings");
    if (savedSettings) {
      try {
        const settings = JSON.parse(savedSettings);
        setSelectedModel(settings.model || "gemini");
        setHfToken(settings.hfToken || "");
        setHfEndpoint(settings.hfEndpoint || "");
      } catch (error) {
        console.error("Error parsing saved settings:", error);
      }
    }
  }, []);

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <div
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-64 bg-white border-r transform transition-transform duration-300 ease-in-out",
          isSidebarOpen ? "translate-x-0" : "-translate-x-full",
          "md:relative md:translate-x-0", // Always visible on larger screens
        )}
      >
        <div className="flex flex-col h-full p-4">
          <h2 className="text-lg font-semibold mb-4">Settings</h2>

          <div className="space-y-6 flex-1">
            {/* Model Selection */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Select Model</Label>
              <RadioGroup value={selectedModel} onValueChange={setSelectedModel}>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="gemini" id="gemini" />
                  <Label htmlFor="gemini">Gemini</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="huggingface" id="huggingface" />
                  <Label htmlFor="huggingface">Huggingface</Label>
                </div>
              </RadioGroup>
            </div>

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
          </div>

          {/* Save Button */}
          <Button
            className="mt-4 bg-[#FDBE02] hover:bg-[#E5AB02] text-black"
            onClick={handleSaveSettings}
          >
            <Save className="w-4 h-4 mr-2" />
            Save Settings
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex flex-col flex-1 h-full">
        {/* Header */}
        <header className="flex items-center justify-between px-4 py-3 border-b bg-[#FDBE02] text-black">
          <div className="flex items-center">
            <Bot className="w-6 h-6 mr-2" />
            <h1 className="text-xl font-bold">chatMango</h1>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="md:hidden" // Hide on larger screens
          >
            <Settings className="w-5 h-5" />
          </Button>
        </header>

        {/* Chat Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center text-gray-500">
              <Bot className="w-12 h-12 mb-4 text-[#FDBE02]" />
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
                className={cn("flex items-start gap-3 max-w-3xl", message.role === "user" ? "ml-auto" : "mr-auto")}
              >
                <div
                  className={cn(
                    "flex items-center justify-center w-8 h-8 rounded-full shrink-0",
                    message.role === "user" ? "bg-black text-white" : "bg-[#FDBE02] text-black",
                  )}
                >
                  {message.role === "user" ? <User className="w-5 h-5" /> : <Bot className="w-5 h-5" />}
                </div>
                <div
                  className={cn(
                    "rounded-lg px-4 py-2 max-w-[85%]",
                    message.role === "user" ? "bg-black text-white" : "bg-white border border-gray-200 text-black",
                  )}
                >
                  <div className="prose prose-sm whitespace-pre-wrap">{message.content}</div>
                </div>
              </div>
            ))
          )}
          {isLoading && (
            <div className="flex items-start gap-3 max-w-3xl mr-auto">
              <div className="flex items-center justify-center w-8 h-8 rounded-full shrink-0 bg-[#FDBE02] text-black">
                <Bot className="w-5 h-5" />
              </div>
              <div className="rounded-lg px-4 py-2 bg-white border border-gray-200 text-black">
                <Loader2 className="w-4 h-4 animate-spin" />
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Form */}
        <div className="border-t p-4 bg-white">
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
              className="bg-[#FDBE02] hover:bg-[#E5AB02] text-black"
            >
              <Send className="w-4 h-4" />
              <span className="sr-only">Send</span>
            </Button>
          </form>
        </div>
      </div>
    </div>
  )
}

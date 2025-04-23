"use client"

import { useState, useRef, useEffect } from "react"
import { Send, Bot, User, Loader2, Settings, Save, ExternalLink } from "lucide-react"
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

// Tentukan tipe pesan chat
interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

// Daftar versi model Gemini
const geminiVersions = [
  "gemini-1.0-pro",
  "gemini-1.5-pro",
  "gemini-1.5-flash",
  "gemini-2.0-flash"
];

export default function ChatPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [inputRows, setInputRows] = useState(1);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // State untuk sidebar
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [selectedModel, setSelectedModel] = useState("gemini");
  const [geminiVersion, setGeminiVersion] = useState("gemini-2.0-flash");
  const [hfToken, setHfToken] = useState("");
  const [hfEndpoint, setHfEndpoint] = useState("");
  const [colabEndpoint, setColabEndpoint] = useState("");

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
            ...(selectedModel === "gemini" && {
              gemini_version: geminiVersion
            }),
            ...(selectedModel === "huggingface" && {
              hf_token: hfToken,
              hf_endpoint: hfEndpoint
            }),
            ...(selectedModel === "colab" && {
              colab_endpoint: colabEndpoint
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
      geminiVersion: geminiVersion,
      hfToken: hfToken,
      hfEndpoint: hfEndpoint,
      colabEndpoint: colabEndpoint
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
        setGeminiVersion(settings.geminiVersion || "gemini-2.0-flash");
        setHfToken(settings.hfToken || "");
        setHfEndpoint(settings.hfEndpoint || "");
        setColabEndpoint(settings.colabEndpoint || "");
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
          </div>

          {/* Save Button */}
          <Button
            className="mt-4 bg-[#FDBE02] hover:bg-[#E5AB02] text-white"
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
        <header className="flex items-center justify-between px-4 py-3 border-b bg-[#FDBE02] text-white">
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
                  // Assistant message - Remain as is
                  <>
                    <div
                      className={cn(
                        "flex items-center justify-center w-8 h-8 rounded-full shrink-0",
                        "bg-[#FDBE02] text-white"
                      )}
                    >
                      <Bot className="w-5 h-5" />
                    </div>
                    <div
                      className={cn(
                        "rounded-lg px-4 py-2 max-w-[85%]",
                        "bg-white border border-gray-200 text-black"
                      )}
                    >
                      <div className="prose prose-sm whitespace-pre-wrap">{message.content}</div>
                    </div>
                  </>
                )}
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

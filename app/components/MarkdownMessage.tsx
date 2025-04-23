import React, { useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import { cn } from '@/lib/utils';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/cjs/styles/prism';
import { ClipboardCopy, Check } from 'lucide-react';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';

interface MarkdownMessageProps {
    content: string;
    className?: string;
}

interface CodeBlockProps {
    node: any;
    inline: boolean;
    className?: string;
    children: React.ReactNode;
}

export function MarkdownMessage({ content, className }: MarkdownMessageProps) {
    useEffect(() => {
        // Initialize any scripts or side effects that might be needed
    }, []);

    const CodeBlock = ({ node, inline, className, children, ...props }: CodeBlockProps) => {
        const match = /language-(\w+)/.exec(className || '');
        const language = match && match[1] ? match[1] : '';
        const [copied, setCopied] = React.useState(false);

        const handleCopy = () => {
            const code = String(children).replace(/\n$/, '');
            navigator.clipboard.writeText(code);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        };

        if (inline) {
            return (
                <code className="bg-gray-100 text-gray-800 px-1 py-0.5 rounded text-sm" {...props}>
                    {children}
                </code>
            );
        }

        return (
            <div className="relative group">
                <div className="absolute right-2 top-2 z-10">
                    <button
                        onClick={handleCopy}
                        className="p-1.5 rounded-md bg-gray-700 hover:bg-gray-600 text-gray-200"
                        aria-label="Copy code"
                    >
                        {copied ? <Check size={14} /> : <ClipboardCopy size={14} />}
                    </button>
                </div>
                <SyntaxHighlighter
                    style={vscDarkPlus}
                    language={language}
                    className="rounded-md !mt-0"
                    customStyle={{ margin: 0 }}
                    showLineNumbers={true}
                    wrapLines={true}
                >
                    {String(children).replace(/\n$/, '')}
                </SyntaxHighlighter>
            </div>
        );
    };

    return (
        <div className={cn("prose prose-sm max-w-none prose-headings:mt-4 prose-headings:mb-2", className)}>
            <ReactMarkdown
                remarkPlugins={[remarkGfm, remarkMath]}
                rehypePlugins={[rehypeKatex]}
                components={{
                    code: CodeBlock,
                    a: ({ node, ...props }) => (
                        <a
                            {...props}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:text-blue-800 hover:underline"
                        />
                    ),
                    table: ({ node, ...props }) => (
                        <div className="overflow-x-auto">
                            <table className="border-collapse border border-gray-300" {...props} />
                        </div>
                    ),
                    th: ({ node, ...props }) => (
                        <th className="border border-gray-300 px-4 py-2 bg-gray-100 font-semibold" {...props} />
                    ),
                    td: ({ node, ...props }) => (
                        <td className="border border-gray-300 px-4 py-2" {...props} />
                    ),
                }}
            >
                {content}
            </ReactMarkdown>
        </div>
    );
} 
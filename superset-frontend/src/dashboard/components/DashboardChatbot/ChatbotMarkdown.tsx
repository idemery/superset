/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */
import { FC, useEffect, useRef, useState, memo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import mermaid from 'mermaid';
import { styled, keyframes } from '@apache-superset/core/ui';

// Initialize mermaid with dark theme
mermaid.initialize({
  startOnLoad: false,
  theme: 'dark',
  securityLevel: 'loose',
  fontFamily: 'inherit',
  themeVariables: {
    primaryColor: '#3b82f6',
    primaryTextColor: '#fff',
    primaryBorderColor: '#60a5fa',
    lineColor: '#94a3b8',
    secondaryColor: '#8b5cf6',
    tertiaryColor: '#1e293b',
    background: '#0f172a',
    mainBkg: '#1e293b',
    secondBkg: '#334155',
    border1: '#475569',
    border2: '#64748b',
    arrowheadColor: '#94a3b8',
    textColor: '#e2e8f0',
    nodeTextColor: '#f1f5f9',
  },
});

// Mermaid diagram component
interface MermaidDiagramProps {
  chart: string;
}

const MermaidContainer = styled.div`
  margin: 12px 0;
  padding: 16px;
  background: rgba(15, 23, 42, 0.6);
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  overflow-x: auto;

  svg {
    max-width: 100%;
    height: auto;
  }

  .mermaid {
    display: flex;
    justify-content: center;
  }
`;

const MermaidError = styled.div`
  color: #f87171;
  font-size: 12px;
  padding: 8px;
  background: rgba(239, 68, 68, 0.1);
  border-radius: 4px;
  border: 1px solid rgba(239, 68, 68, 0.3);
`;

const MermaidDiagram: FC<MermaidDiagramProps> = memo(({ chart }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [svg, setSvg] = useState<string>('');

  useEffect(() => {
    const renderDiagram = async () => {
      if (!chart.trim()) return;

      try {
        const id = `mermaid-${Math.random().toString(36).substr(2, 9)}`;
        const { svg: renderedSvg } = await mermaid.render(id, chart.trim());
        setSvg(renderedSvg);
        setError(null);
      } catch (err) {
        console.error('Mermaid rendering error:', err);
        setError(err instanceof Error ? err.message : 'Failed to render diagram');
        setSvg('');
      }
    };

    renderDiagram();
  }, [chart]);

  if (error) {
    return (
      <MermaidContainer>
        <MermaidError>
          <strong>Diagram Error:</strong> {error}
          <pre style={{ marginTop: 8, fontSize: 11, opacity: 0.7 }}>{chart}</pre>
        </MermaidError>
      </MermaidContainer>
    );
  }

  if (!svg) {
    return (
      <MermaidContainer>
        <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12 }}>
          Rendering diagram...
        </div>
      </MermaidContainer>
    );
  }

  return (
    <MermaidContainer>
      <div
        ref={containerRef}
        className="mermaid"
        dangerouslySetInnerHTML={{ __html: svg }}
      />
    </MermaidContainer>
  );
});

MermaidDiagram.displayName = 'MermaidDiagram';

// Styled markdown container
const MarkdownContainer = styled.div`
  font-size: 14px;
  line-height: 1.6;
  color: rgba(255, 255, 255, 0.9);

  /* Headings */
  h1, h2, h3, h4, h5, h6 {
    margin: 16px 0 8px 0;
    font-weight: 600;
    line-height: 1.3;
    color: #fff;
  }

  h1 { font-size: 1.4em; }
  h2 { font-size: 1.25em; }
  h3 { font-size: 1.1em; }
  h4, h5, h6 { font-size: 1em; }

  /* Paragraphs */
  p {
    margin: 8px 0;
  }

  /* Links */
  a {
    color: #60a5fa;
    text-decoration: none;
    &:hover {
      text-decoration: underline;
      color: #93c5fd;
    }
  }

  /* Lists */
  ul, ol {
    margin: 8px 0;
    padding-left: 20px;
  }

  li {
    margin: 4px 0;
  }

  ul {
    list-style-type: disc;
  }

  ol {
    list-style-type: decimal;
  }

  /* Nested lists */
  ul ul, ol ul {
    list-style-type: circle;
  }

  /* Blockquotes */
  blockquote {
    margin: 12px 0;
    padding: 8px 16px;
    border-left: 3px solid #3b82f6;
    background: rgba(59, 130, 246, 0.1);
    border-radius: 0 4px 4px 0;
    color: rgba(255, 255, 255, 0.8);

    p {
      margin: 4px 0;
    }
  }

  /* Inline code */
  code:not(pre code) {
    background: rgba(255, 255, 255, 0.1);
    padding: 2px 6px;
    border-radius: 4px;
    font-family: 'Fira Code', 'Consolas', 'Monaco', monospace;
    font-size: 0.9em;
    color: #f472b6;
  }

  /* Code blocks */
  pre {
    margin: 12px 0;
    border-radius: 8px;
    overflow: hidden;

    code {
      font-family: 'Fira Code', 'Consolas', 'Monaco', monospace;
      font-size: 13px;
    }
  }

  /* Tables */
  table {
    width: 100%;
    margin: 12px 0;
    border-collapse: collapse;
    font-size: 13px;
  }

  th, td {
    padding: 8px 12px;
    border: 1px solid rgba(255, 255, 255, 0.15);
    text-align: left;
  }

  th {
    background: rgba(59, 130, 246, 0.2);
    font-weight: 600;
    color: #fff;
  }

  tr:nth-child(even) {
    background: rgba(255, 255, 255, 0.03);
  }

  tr:hover {
    background: rgba(255, 255, 255, 0.05);
  }

  /* Horizontal rule */
  hr {
    margin: 16px 0;
    border: none;
    border-top: 1px solid rgba(255, 255, 255, 0.15);
  }

  /* Images */
  img {
    max-width: 100%;
    height: auto;
    border-radius: 8px;
    margin: 8px 0;
  }

  /* Task lists (GFM) */
  input[type="checkbox"] {
    margin-right: 8px;
    accent-color: #3b82f6;
  }

  /* Strikethrough */
  del {
    color: rgba(255, 255, 255, 0.5);
  }

  /* Strong and emphasis */
  strong {
    font-weight: 600;
    color: #fff;
  }

  em {
    font-style: italic;
  }
`;

// Code block with copy button
const CodeBlockWrapper = styled.div`
  position: relative;
  margin: 12px 0;

  &:hover .copy-button {
    opacity: 1;
  }
`;

const CopyButton = styled.button`
  position: absolute;
  top: 8px;
  right: 8px;
  padding: 4px 8px;
  font-size: 11px;
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 4px;
  color: rgba(255, 255, 255, 0.7);
  cursor: pointer;
  opacity: 0;
  transition: all 0.2s ease;
  z-index: 10;

  &:hover {
    background: rgba(255, 255, 255, 0.2);
    color: #fff;
  }

  &.copied {
    background: rgba(34, 197, 94, 0.3);
    border-color: rgba(34, 197, 94, 0.5);
    color: #4ade80;
  }
`;

const LanguageTag = styled.span`
  position: absolute;
  top: 8px;
  left: 12px;
  font-size: 10px;
  color: rgba(255, 255, 255, 0.4);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  z-index: 10;
`;

interface CodeBlockProps {
  language: string;
  value: string;
}

const CodeBlock: FC<CodeBlockProps> = memo(({ language, value }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  // Check if it's a mermaid diagram
  if (language === 'mermaid') {
    return <MermaidDiagram chart={value} />;
  }

  return (
    <CodeBlockWrapper>
      {language && <LanguageTag>{language}</LanguageTag>}
      <CopyButton
        className={`copy-button ${copied ? 'copied' : ''}`}
        onClick={handleCopy}
      >
        {copied ? '✓ Copied' : 'Copy'}
      </CopyButton>
      <SyntaxHighlighter
        language={language || 'text'}
        style={oneDark}
        customStyle={{
          margin: 0,
          borderRadius: 8,
          padding: '32px 16px 16px 16px',
          background: 'rgba(15, 23, 42, 0.8)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
        }}
        showLineNumbers={value.split('\n').length > 3}
        lineNumberStyle={{
          minWidth: '2.5em',
          paddingRight: '1em',
          color: 'rgba(255, 255, 255, 0.25)',
          userSelect: 'none',
        }}
      >
        {value}
      </SyntaxHighlighter>
    </CodeBlockWrapper>
  );
});

CodeBlock.displayName = 'CodeBlock';

// Main markdown renderer component
interface ChatbotMarkdownProps {
  content: string;
  isStreaming?: boolean;
}

const ChatbotMarkdown: FC<ChatbotMarkdownProps> = ({ content, isStreaming }) => {
  return (
    <MarkdownContainer>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          code({ node, inline, className, children, ...props }) {
            const match = /language-(\w+)/.exec(className || '');
            const language = match ? match[1] : '';
            const value = String(children).replace(/\n$/, '');

            if (!inline && (match || value.includes('\n'))) {
              return <CodeBlock language={language} value={value} />;
            }

            return (
              <code className={className} {...props}>
                {children}
              </code>
            );
          },
          // Custom link renderer to open in new tab
          a({ href, children, ...props }) {
            return (
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                {...props}
              >
                {children}
              </a>
            );
          },
          // Custom table wrapper for horizontal scroll
          table({ children, ...props }) {
            return (
              <div style={{ overflowX: 'auto' }}>
                <table {...props}>{children}</table>
              </div>
            );
          },
        }}
      >
        {content}
      </ReactMarkdown>
      {isStreaming && <span className="streaming-cursor">▋</span>}
    </MarkdownContainer>
  );
};

export default memo(ChatbotMarkdown);
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
import { FC, useEffect, useRef, useState, memo, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark, oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism';
import mermaid from 'mermaid';
import { styled, keyframes, useTheme } from '@apache-superset/core/ui';

// Mermaid diagram component
interface MermaidDiagramProps {
  chart: string;
  isDark: boolean;
}

const MermaidContainer = styled.div<{ $isDark: boolean }>`
  margin: 12px 0;
  padding: 16px;
  background: ${({ theme, $isDark }) => $isDark ? theme.colorFillTertiary : theme.colorBgLayout};
  border-radius: ${({ theme }) => theme.borderRadius}px;
  border: 1px solid ${({ theme }) => theme.colorBorderSecondary};
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
  color: ${({ theme }) => theme.colorError};
  font-size: ${({ theme }) => theme.fontSizeSM}px;
  padding: 8px;
  background: ${({ theme }) => theme.colorErrorBg};
  border-radius: ${({ theme }) => theme.borderRadius}px;
  border: 1px solid ${({ theme }) => theme.colorErrorBorder};
`;

const MermaidDiagram: FC<MermaidDiagramProps> = memo(({ chart, isDark }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [svg, setSvg] = useState<string>('');

  useEffect(() => {
    // Re-initialize mermaid when theme changes
    mermaid.initialize({
      startOnLoad: false,
      theme: isDark ? 'dark' : 'default',
      securityLevel: 'loose',
      fontFamily: 'inherit',
      themeVariables: isDark ? {
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
      } : {
        primaryColor: '#2893B3',
        primaryTextColor: '#000',
        primaryBorderColor: '#2893B3',
        lineColor: '#64748b',
        secondaryColor: '#8b5cf6',
        tertiaryColor: '#f5f5f5',
        background: '#ffffff',
        mainBkg: '#ffffff',
        secondBkg: '#f5f5f5',
        border1: '#d9d9d9',
        border2: '#e5e5e5',
        arrowheadColor: '#64748b',
        textColor: 'rgba(0,0,0,0.88)',
        nodeTextColor: 'rgba(0,0,0,0.88)',
      },
    });

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
  }, [chart, isDark]);

  const theme = useTheme();

  if (error) {
    return (
      <MermaidContainer $isDark={isDark}>
        <MermaidError>
          <strong>Diagram Error:</strong> {error}
          <pre style={{ marginTop: 8, fontSize: 11, opacity: 0.7 }}>{chart}</pre>
        </MermaidError>
      </MermaidContainer>
    );
  }

  if (!svg) {
    return (
      <MermaidContainer $isDark={isDark}>
        <div style={{ color: theme.colorTextTertiary, fontSize: theme.fontSizeSM }}>
          Rendering diagram...
        </div>
      </MermaidContainer>
    );
  }

  return (
    <MermaidContainer $isDark={isDark}>
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
const MarkdownContainer = styled.div<{ $isDark: boolean }>`
  font-size: ${({ theme }) => theme.fontSize}px;
  line-height: ${({ theme }) => theme.lineHeight};
  color: ${({ theme }) => theme.colorText};

  /* Headings */
  h1, h2, h3, h4, h5, h6 {
    margin: 16px 0 8px 0;
    font-weight: ${({ theme }) => theme.fontWeightStrong};
    line-height: 1.3;
    color: ${({ theme }) => theme.colorTextHeading};
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
    color: ${({ theme }) => theme.colorLink};
    text-decoration: none;
    &:hover {
      text-decoration: underline;
      color: ${({ theme }) => theme.colorLinkHover};
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
    border-left: 3px solid ${({ theme }) => theme.colorPrimary};
    background: ${({ theme }) => theme.colorPrimaryBg};
    border-radius: 0 ${({ theme }) => theme.borderRadius}px ${({ theme }) => theme.borderRadius}px 0;
    color: ${({ theme }) => theme.colorTextSecondary};

    p {
      margin: 4px 0;
    }
  }

  /* Inline code */
  code:not(pre code) {
    background: ${({ theme, $isDark }) => $isDark ? theme.colorFillSecondary : theme.colorFillTertiary};
    padding: 2px 6px;
    border-radius: ${({ theme }) => theme.borderRadius}px;
    font-family: ${({ theme }) => theme.fontFamilyCode};
    font-size: 0.9em;
    color: ${({ theme }) => theme.colorError};
  }

  /* Code blocks */
  pre {
    margin: 12px 0;
    border-radius: ${({ theme }) => theme.borderRadius}px;
    overflow: hidden;

    code {
      font-family: ${({ theme }) => theme.fontFamilyCode};
      font-size: ${({ theme }) => theme.fontSizeSM}px;
    }
  }

  /* Tables */
  table {
    width: 100%;
    margin: 12px 0;
    border-collapse: collapse;
    font-size: ${({ theme }) => theme.fontSizeSM}px;
  }

  th, td {
    padding: 8px 12px;
    border: 1px solid ${({ theme }) => theme.colorBorderSecondary};
    text-align: left;
  }

  th {
    background: ${({ theme }) => theme.colorPrimaryBg};
    font-weight: ${({ theme }) => theme.fontWeightStrong};
    color: ${({ theme }) => theme.colorTextHeading};
  }

  tr:nth-child(even) {
    background: ${({ theme }) => theme.colorFillAlter};
  }

  tr:hover {
    background: ${({ theme }) => theme.colorFillTertiary};
  }

  /* Horizontal rule */
  hr {
    margin: 16px 0;
    border: none;
    border-top: 1px solid ${({ theme }) => theme.colorBorderSecondary};
  }

  /* Images */
  img {
    max-width: 100%;
    height: auto;
    border-radius: ${({ theme }) => theme.borderRadius}px;
    margin: 8px 0;
  }

  /* Task lists (GFM) */
  input[type="checkbox"] {
    margin-right: 8px;
    accent-color: ${({ theme }) => theme.colorPrimary};
  }

  /* Strikethrough */
  del {
    color: ${({ theme }) => theme.colorTextTertiary};
  }

  /* Strong and emphasis */
  strong {
    font-weight: ${({ theme }) => theme.fontWeightStrong};
    color: ${({ theme }) => theme.colorTextHeading};
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

const CopyButton = styled.button<{ $isDark: boolean }>`
  position: absolute;
  top: 8px;
  right: 8px;
  padding: 4px 8px;
  font-size: 11px;
  background: ${({ theme }) => theme.colorFillSecondary};
  border: 1px solid ${({ theme }) => theme.colorBorder};
  border-radius: ${({ theme }) => theme.borderRadius}px;
  color: ${({ theme }) => theme.colorTextSecondary};
  cursor: pointer;
  opacity: 0;
  transition: all 0.2s ease;
  z-index: 10;

  &:hover {
    background: ${({ theme }) => theme.colorFillContentHover};
    color: ${({ theme }) => theme.colorText};
  }

  &.copied {
    background: ${({ theme }) => theme.colorSuccessBg};
    border-color: ${({ theme }) => theme.colorSuccessBorder};
    color: ${({ theme }) => theme.colorSuccess};
  }
`;

const LanguageTag = styled.span<{ $isDark: boolean }>`
  position: absolute;
  top: 8px;
  left: 12px;
  font-size: 10px;
  color: ${({ theme }) => theme.colorTextTertiary};
  text-transform: uppercase;
  letter-spacing: 0.5px;
  z-index: 10;
`;

// Placeholder shown while mermaid diagram is streaming
const MermaidPlaceholder = styled.div<{ $isDark: boolean }>`
  margin: 12px 0;
  padding: 16px;
  background: ${({ theme, $isDark }) => $isDark ? theme.colorFillTertiary : theme.colorBgLayout};
  border-radius: ${({ theme }) => theme.borderRadius}px;
  border: 1px solid ${({ theme }) => theme.colorBorderSecondary};
  color: ${({ theme }) => theme.colorTextTertiary};
  font-size: ${({ theme }) => theme.fontSizeSM}px;
  display: flex;
  align-items: center;
  gap: 8px;

  &::before {
    content: '📊';
  }
`;

interface CodeBlockProps {
  language: string;
  value: string;
  isDark: boolean;
  isStreaming?: boolean;
}

const CodeBlock: FC<CodeBlockProps> = memo(({ language, value, isDark, isStreaming }) => {
  const [copied, setCopied] = useState(false);
  const theme = useTheme();

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  // Check if it's a mermaid diagram - defer rendering until streaming is complete
  if (language === 'mermaid') {
    if (isStreaming) {
      return (
        <MermaidPlaceholder $isDark={isDark}>
          Generating diagram...
        </MermaidPlaceholder>
      );
    }
    return <MermaidDiagram chart={value} isDark={isDark} />;
  }

  return (
    <CodeBlockWrapper>
      {language && <LanguageTag $isDark={isDark}>{language}</LanguageTag>}
      <CopyButton
        className={`copy-button ${copied ? 'copied' : ''}`}
        onClick={handleCopy}
        $isDark={isDark}
      >
        {copied ? '✓ Copied' : 'Copy'}
      </CopyButton>
      <SyntaxHighlighter
        language={language || 'text'}
        style={isDark ? oneDark : oneLight}
        customStyle={{
          margin: 0,
          borderRadius: theme.borderRadius,
          padding: '32px 16px 16px 16px',
          background: isDark ? theme.colorFillTertiary : theme.colorBgLayout,
          border: `1px solid ${theme.colorBorderSecondary}`,
        }}
        showLineNumbers={value.split('\n').length > 3}
        lineNumberStyle={{
          minWidth: '2.5em',
          paddingRight: '1em',
          color: theme.colorTextTertiary,
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
  const theme = useTheme();
  
  // Detect if dark mode based on colorBgBase
  const isDark = useMemo(() => {
    return theme.colorBgBase === '#000' || theme.colorBgBase === '#000000';
  }, [theme.colorBgBase]);

  return (
    <MarkdownContainer $isDark={isDark}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          code({ node, inline, className, children, ...props }) {
            const match = /language-(\w+)/.exec(className || '');
            const language = match ? match[1] : '';
            const value = String(children).replace(/\n$/, '');

            if (!inline && (match || value.includes('\n'))) {
              return (
                <CodeBlock 
                  language={language} 
                  value={value} 
                  isDark={isDark} 
                  isStreaming={isStreaming}
                />
              );
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
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
import {
  FC,
  useState,
  useRef,
  useEffect,
  useCallback,
  KeyboardEvent,
} from 'react';
import { styled, keyframes } from '@apache-superset/core/ui';
import { t } from '@superset-ui/core';

// Types
interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  isStreaming?: boolean;
}

interface DashboardChatbotProps {
  dashboardId: number;
  dashboardTitle?: string;
  /** Override the default LLM API URL */
  apiUrl?: string;
  /** Override the default model name */
  modelName?: string;
  /** Enable streaming responses (default: true) */
  enableStreaming?: boolean;
}

interface ChatCompletionMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

// Configuration - can be overridden via props or environment variables
const DEFAULT_LLM_API_URL = 'http://localhost:11435/v1/chat/completions';
const DEFAULT_MODEL = 'qwen3:4b-instruct';

// Animations
const pulseGlow = keyframes`
  0%, 100% {
    box-shadow: 0 0 20px rgba(59, 130, 246, 0.4),
                0 0 40px rgba(59, 130, 246, 0.2),
                0 0 60px rgba(59, 130, 246, 0.1);
  }
  50% {
    box-shadow: 0 0 25px rgba(59, 130, 246, 0.6),
                0 0 50px rgba(59, 130, 246, 0.3),
                0 0 75px rgba(59, 130, 246, 0.15);
  }
`;

const slideUp = keyframes`
  from {
    opacity: 0;
    transform: translateY(20px) scale(0.95);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
`;

const fadeIn = keyframes`
  from { opacity: 0; }
  to { opacity: 1; }
`;

const typingDots = keyframes`
  0%, 60%, 100% { transform: translateY(0); }
  30% { transform: translateY(-4px); }
`;

const sparkle = keyframes`
  0%, 100% {
    opacity: 0;
    transform: scale(0) rotate(0deg);
  }
  50% {
    opacity: 1;
    transform: scale(1) rotate(180deg);
  }
`;

const shimmer = keyframes`
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
`;

// Styled Components
const ChatbotContainer = styled.div`
  position: fixed;
  bottom: 24px;
  right: 24px;
  z-index: 1000;
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
`;

const FloatingButton = styled.button<{ isOpen: boolean }>`
  width: 60px;
  height: 60px;
  border-radius: 50%;
  border: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 50%, #06b6d4 100%);
  background-size: 200% 200%;
  animation: ${pulseGlow} 2s ease-in-out infinite;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  position: relative;
  overflow: hidden;

  &::before {
    content: '';
    position: absolute;
    top: -50%;
    left: -50%;
    width: 200%;
    height: 200%;
    background: linear-gradient(
      45deg,
      transparent 30%,
      rgba(255, 255, 255, 0.1) 50%,
      transparent 70%
    );
    transform: rotate(45deg);
    transition: all 0.5s;
  }

  &:hover {
    transform: scale(1.1);
    &::before { left: 100%; }
  }

  &:active { transform: scale(0.95); }

  svg {
    width: 28px;
    height: 28px;
    color: white;
    filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.2));
    transition: transform 0.3s ease;
  }

  ${({ isOpen }) => isOpen && `
    transform: rotate(90deg) scale(1);
    &:hover { transform: rotate(90deg) scale(1.1); }
  `}
`;

const SparkleEffect = styled.span`
  position: absolute;
  width: 8px;
  height: 8px;
  background: white;
  border-radius: 50%;
  animation: ${sparkle} 2s ease-in-out infinite;
  &:nth-of-type(1) { top: 8px; right: 12px; animation-delay: 0s; }
  &:nth-of-type(2) { bottom: 10px; left: 10px; animation-delay: 0.5s; }
  &:nth-of-type(3) { top: 50%; left: 6px; animation-delay: 1s; }
`;

const ChatWindow = styled.div<{ isOpen: boolean }>`
  position: absolute;
  bottom: 76px;
  right: 0;
  width: 420px;
  height: 580px;
  background: linear-gradient(180deg, rgba(15, 23, 42, 0.98) 0%, rgba(30, 41, 59, 0.98) 100%);
  border-radius: 20px;
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5),
              0 0 0 1px rgba(255, 255, 255, 0.1),
              0 0 80px rgba(59, 130, 246, 0.15);
  display: ${({ isOpen }) => (isOpen ? 'flex' : 'none')};
  flex-direction: column;
  overflow: hidden;
  animation: ${slideUp} 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  backdrop-filter: blur(20px);
`;

const ChatHeader = styled.div`
  padding: 20px 24px;
  background: linear-gradient(90deg, rgba(59, 130, 246, 0.2) 0%, rgba(139, 92, 246, 0.2) 50%, rgba(6, 182, 212, 0.2) 100%);
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  display: flex;
  align-items: center;
  gap: 12px;
`;

const AvatarContainer = styled.div`
  width: 44px;
  height: 44px;
  border-radius: 12px;
  background: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.4);
  svg { width: 24px; height: 24px; color: white; }
`;

const HeaderInfo = styled.div`
  flex: 1;
`;

const HeaderTitle = styled.h3`
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: white;
  letter-spacing: -0.02em;
`;

const HeaderSubtitle = styled.p`
  margin: 2px 0 0;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.6);
`;

const ConnectionStatus = styled.span<{ connected: boolean }>`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  &::before {
    content: '';
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: ${({ connected }) => connected ? '#22c55e' : '#ef4444'};
  }
`;

const CloseButton = styled.button`
  width: 32px;
  height: 32px;
  border-radius: 8px;
  border: none;
  background: rgba(255, 255, 255, 0.1);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
  &:hover { background: rgba(255, 255, 255, 0.2); transform: scale(1.05); }
  svg { width: 16px; height: 16px; color: rgba(255, 255, 255, 0.7); }
`;

const MessagesContainer = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 16px;

  &::-webkit-scrollbar { width: 6px; }
  &::-webkit-scrollbar-track { background: transparent; }
  &::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.2); border-radius: 3px; }
  &::-webkit-scrollbar-thumb:hover { background: rgba(255, 255, 255, 0.3); }
`;

const MessageWrapper = styled.div<{ isUser: boolean }>`
  display: flex;
  flex-direction: column;
  align-items: ${({ isUser }) => (isUser ? 'flex-end' : 'flex-start')};
  animation: ${fadeIn} 0.3s ease;
`;

const MessageBubble = styled.div<{ isUser: boolean; isStreaming?: boolean }>`
  max-width: 85%;
  padding: 12px 16px;
  border-radius: ${({ isUser }) => isUser ? '16px 16px 4px 16px' : '16px 16px 16px 4px'};
  background: ${({ isUser }) => isUser
    ? 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)'
    : 'rgba(255, 255, 255, 0.08)'};
  color: ${({ isUser }) => isUser ? 'white' : 'rgba(255, 255, 255, 0.9)'};
  font-size: 14px;
  line-height: 1.6;
  box-shadow: ${({ isUser }) => isUser
    ? '0 4px 12px rgba(59, 130, 246, 0.3)'
    : '0 2px 8px rgba(0, 0, 0, 0.2)'};
  border: 1px solid ${({ isUser }) => isUser ? 'transparent' : 'rgba(255, 255, 255, 0.08)'};
  white-space: pre-wrap;
  word-break: break-word;

  ${({ isStreaming }) => isStreaming && `
    &::after {
      content: '▋';
      animation: blink 1s infinite;
      margin-left: 2px;
    }
    @keyframes blink {
      0%, 50% { opacity: 1; }
      51%, 100% { opacity: 0; }
    }
  `}
`;

const MessageTime = styled.span`
  font-size: 10px;
  color: rgba(255, 255, 255, 0.4);
  margin-top: 4px;
  padding: 0 4px;
`;

const TypingIndicator = styled.div`
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 12px 16px;
  background: rgba(255, 255, 255, 0.08);
  border-radius: 16px 16px 16px 4px;
  width: fit-content;

  span {
    width: 8px;
    height: 8px;
    background: rgba(255, 255, 255, 0.5);
    border-radius: 50%;
    animation: ${typingDots} 1.4s ease-in-out infinite;
    &:nth-of-type(2) { animation-delay: 0.2s; }
    &:nth-of-type(3) { animation-delay: 0.4s; }
  }
`;

const InputContainer = styled.div`
  padding: 16px 20px 20px;
  background: rgba(0, 0, 0, 0.2);
  border-top: 1px solid rgba(255, 255, 255, 0.1);
`;

const InputWrapper = styled.div`
  display: flex;
  gap: 12px;
  align-items: flex-end;
`;

const TextInput = styled.textarea`
  flex: 1;
  min-height: 44px;
  max-height: 120px;
  padding: 12px 16px;
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.15);
  background: rgba(255, 255, 255, 0.08);
  color: white;
  font-size: 14px;
  font-family: inherit;
  resize: none;
  outline: none;
  transition: all 0.2s ease;

  &::placeholder { color: rgba(255, 255, 255, 0.4); }
  &:focus {
    border-color: rgba(59, 130, 246, 0.6);
    background: rgba(255, 255, 255, 0.1);
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.15);
  }
`;

const SendButton = styled.button<{ disabled: boolean }>`
  width: 44px;
  height: 44px;
  border-radius: 12px;
  border: none;
  background: ${({ disabled }) => disabled
    ? 'rgba(255, 255, 255, 0.1)'
    : 'linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)'};
  cursor: ${({ disabled }) => disabled ? 'not-allowed' : 'pointer'};
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
  flex-shrink: 0;

  &:hover:not(:disabled) { transform: scale(1.05); box-shadow: 0 4px 12px rgba(59, 130, 246, 0.4); }
  &:active:not(:disabled) { transform: scale(0.95); }

  svg {
    width: 20px;
    height: 20px;
    color: ${({ disabled }) => disabled ? 'rgba(255, 255, 255, 0.3)' : 'white'};
    transform: rotate(-45deg);
  }
`;

const WelcomeMessage = styled.div`
  text-align: center;
  padding: 20px;
  color: rgba(255, 255, 255, 0.7);

  h4 { font-size: 16px; font-weight: 600; color: white; margin: 0 0 8px; }
  p { font-size: 13px; line-height: 1.5; margin: 0 0 16px; }
`;

const SuggestionChips = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  justify-content: center;
`;

const SuggestionChip = styled.button`
  padding: 8px 14px;
  border-radius: 20px;
  border: 1px solid rgba(59, 130, 246, 0.4);
  background: rgba(59, 130, 246, 0.1);
  color: rgba(255, 255, 255, 0.9);
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    background: rgba(59, 130, 246, 0.25);
    border-color: rgba(59, 130, 246, 0.6);
    transform: translateY(-1px);
  }
`;

const ErrorMessage = styled.div`
  padding: 12px 16px;
  background: rgba(239, 68, 68, 0.2);
  border: 1px solid rgba(239, 68, 68, 0.4);
  border-radius: 12px;
  color: #fca5a5;
  font-size: 13px;
  animation: ${fadeIn} 0.3s ease;
  display: flex;
  align-items: center;
  gap: 8px;

  button {
    margin-left: auto;
    padding: 4px 12px;
    border-radius: 6px;
    border: 1px solid rgba(255, 255, 255, 0.2);
    background: transparent;
    color: white;
    font-size: 12px;
    cursor: pointer;
    &:hover { background: rgba(255, 255, 255, 0.1); }
  }
`;

// SVG Icons as components
const AIIcon: FC = () => (
  // <svg viewBox="0 0 24 24" fill="none">
  //   <path d="M12 2L13.09 8.26L18 6L15.74 10.91L22 12L15.74 13.09L18 18L13.09 15.74L12 22L10.91 15.74L6 18L8.26 13.09L2 12L8.26 10.91L6 6L10.91 8.26L12 2Z" fill="currentColor"/>
  // </svg>
  <svg viewBox="0 0 124 149" width="24" height="29" overflow="hidden">
  <defs><clipPath id="clip0"><rect x="239" y="733" width="124" height="149"/></clipPath></defs><g clip-path="url(#clip0)" transform="translate(-239 -733)"><path d="M25.1285 98.1167C20.4225 102.912 20.1561 110.104 24.4182 115.964 24.9509 116.675 25.5725 117.385 26.1941 118.273 22.4647 120.404 18.6466 120.67 14.6509 119.605 6.39313 117.207 0.355174 109.127 0 99.9814-0.26638 93.7658 1.59828 88.0831 4.52846 82.6667 7.10347 77.9606 10.3 73.6985 14.1182 69.9692 27.8811 56.2062 40.4898 43.6864 54.2528 30.0122 54.3416 29.9234 52.1217 56.9166 51.2338 72.1003 51.2338 72.1003 32.9424 90.3029 25.1285 98.2055Z" fill="#E9A69B" transform="matrix(1 0 0 1.05141 239.2 733)"/><path d="M123.6 0C123.245 2.30863 121.381 15.3613 119.516 28.0587 117.119 44.4855 108.328 59.4028 95.0977 69.5252 74.9416 84.9753 47.0605 106.286 45.0183 107.44 46.6165 96.3409 49.3691 84.2649 50.8786 73.5209L51.2338 71.9227C75.3856 47.9484 99.3598 24.1518 123.6 0Z" fill="#DA6A59" transform="matrix(1 0 0 1.05141 239.2 733)"/><path d="M98.3831 141.714C85.4193 141.714 72.4554 141.892 59.4916 141.714 52.9209 141.625 47.1493 138.873 42.3545 134.344 37.2044 129.372 32.232 124.311 27.082 119.25 26.3716 118.628 26.2829 118.273 27.2596 117.651 32.9424 114.455 38.5363 111.258 44.1303 108.062 44.7519 107.706 45.1071 107.706 45.7286 108.062 63.1321 119.161 98.3831 141.714 98.2943 141.803Z" fill="#DA6A59" transform="matrix(1 0 0 1.05141 239.2 733)"/></g>
  </svg>
);

const SendIcon: FC = () => (
  <svg viewBox="0 0 24 24" fill="none">
    <path d="M22 2L11 13M22 2L15 22L11 13M22 2L2 9L11 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const CloseIcon: FC = () => (
  <svg viewBox="0 0 24 24" fill="none">
    <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

// Helpers
const generateId = (): string => `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
const formatTime = (date: Date): string => date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

// Main Component
const DashboardChatbotStreaming: FC<DashboardChatbotProps> = ({
  dashboardId,
  dashboardTitle = 'Dashboard',
  apiUrl = DEFAULT_LLM_API_URL,
  modelName = DEFAULT_MODEL,
  enableStreaming = true,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(true);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => { scrollToBottom(); }, [messages, scrollToBottom]);
  useEffect(() => { if (isOpen && inputRef.current) inputRef.current.focus(); }, [isOpen]);

  // Cleanup on unmount
  useEffect(() => {
    return () => { abortControllerRef.current?.abort(); };
  }, []);

  const buildSystemPrompt = useCallback((): string => {
    return `You are a helpful AI assistant for Apache Superset dashboards. You are currently helping the user with dashboard ID: ${dashboardId}, titled "${dashboardTitle}".

Your capabilities include:
- Helping users understand their dashboard and charts
- Assisting with creating new charts and visualizations using Superset's API
- Explaining data insights and metrics
- Guiding users through Superset features
- Answering questions about the dashboard's data

When the user asks to create a chart or modify the dashboard, use the available tools to interact with the Superset API.

Available API endpoints you can help with:
- GET /api/v1/chart/ - List charts
- POST /api/v1/chart/ - Create a new chart
- GET /api/v1/dataset/ - List datasets
- GET /api/v1/dashboard/${dashboardId} - Get current dashboard info
- POST /api/v1/dashboard/${dashboardId}/charts - Add chart to dashboard

Always be helpful, concise, and provide actionable guidance. When suggesting chart creation, explain the parameters needed.

Current context:
- Dashboard ID: ${dashboardId}
- Dashboard Title: ${dashboardTitle}`;
  }, [dashboardId, dashboardTitle]);

  // Streaming response handler
  const handleStreamingResponse = useCallback(
    async (reader: ReadableStreamDefaultReader<Uint8Array>, messageId: string) => {
      const decoder = new TextDecoder();
      let buffer = '';
      let fullContent = '';

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6);
              if (data === '[DONE]') continue;

              try {
                const parsed = JSON.parse(data);
                const content = parsed.choices?.[0]?.delta?.content;
                if (content) {
                  fullContent += content;
                  setMessages(prev =>
                    prev.map(msg =>
                      msg.id === messageId
                        ? { ...msg, content: fullContent, isStreaming: true }
                        : msg
                    )
                  );
                }
              } catch {
                // Skip malformed JSON
              }
            }
          }
        }

        // Mark streaming as complete
        setMessages(prev =>
          prev.map(msg =>
            msg.id === messageId ? { ...msg, isStreaming: false } : msg
          )
        );
      } catch (err) {
        if (err instanceof Error && err.name !== 'AbortError') {
          throw err;
        }
      }
    },
    []
  );

  // Send message to LLM
  const sendToLLM = useCallback(
    async (userMessage: string): Promise<void> => {
      const conversationHistory: ChatCompletionMessage[] = messages
        .filter(m => !m.isStreaming)
        .map(msg => ({ role: msg.role, content: msg.content }));

      const requestMessages: ChatCompletionMessage[] = [
        { role: 'system', content: buildSystemPrompt() },
        ...conversationHistory,
        { role: 'user', content: userMessage },
      ];

      abortControllerRef.current = new AbortController();

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: modelName,
          messages: requestMessages,
          temperature: 0.7,
          max_tokens: 2048,
          stream: enableStreaming,
        }),
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) {
        setIsConnected(false);
        const errorText = await response.text();
        throw new Error(`API request failed: ${response.status} - ${errorText}`);
      }

      setIsConnected(true);

      if (enableStreaming && response.body) {
        const messageId = generateId();
        setMessages(prev => [
          ...prev,
          {
            id: messageId,
            role: 'assistant',
            content: '',
            timestamp: new Date(),
            isStreaming: true,
          },
        ]);
        await handleStreamingResponse(response.body.getReader(), messageId);
      } else {
        const data = await response.json();
        const content = data.choices?.[0]?.message?.content || 'No response generated.';
        setMessages(prev => [
          ...prev,
          {
            id: generateId(),
            role: 'assistant',
            content,
            timestamp: new Date(),
          },
        ]);
      }
    },
    [messages, buildSystemPrompt, apiUrl, modelName, enableStreaming, handleStreamingResponse]
  );

  const handleSendMessage = useCallback(
    async (messageText?: string) => {
      const text = messageText || inputValue.trim();
      if (!text || isLoading) return;

      setError(null);
      setInputValue('');

      const userMessage: Message = {
        id: generateId(),
        role: 'user',
        content: text,
        timestamp: new Date(),
      };

      setMessages(prev => [...prev, userMessage]);
      setIsLoading(true);

      try {
        await sendToLLM(text);
      } catch (err) {
        if (err instanceof Error && err.name !== 'AbortError') {
          console.error('Error sending message:', err);
          setError(err.message || 'Failed to get response. Please try again.');
        }
      } finally {
        setIsLoading(false);
      }
    },
    [inputValue, isLoading, sendToLLM]
  );

  const handleStopGeneration = () => {
    abortControllerRef.current?.abort();
    setIsLoading(false);
    setMessages(prev =>
      prev.map(msg => (msg.isStreaming ? { ...msg, isStreaming: false } : msg))
    );
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputValue(e.target.value);
    e.target.style.height = 'auto';
    e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`;
  };

  const handleRetry = () => {
    setError(null);
    const lastUserMessage = [...messages].reverse().find(m => m.role === 'user');
    if (lastUserMessage) {
      setMessages(prev => prev.filter(m => m.id !== lastUserMessage.id));
      handleSendMessage(lastUserMessage.content);
    }
  };

  const suggestions = [
    t('Create a bar chart'),
    t('What datasets are available?'),
    t('Help me add a filter'),
  ];

  return (
    <ChatbotContainer>
      <ChatWindow isOpen={isOpen}>
        <ChatHeader>
          <AvatarContainer>
            <AIIcon />
          </AvatarContainer>
          <HeaderInfo>
            <HeaderTitle>{t('ALLM Assistant')}</HeaderTitle>
            <HeaderSubtitle>
              <ConnectionStatus connected={isConnected}>
                {isConnected ? t('Connected') : t('Disconnected')}
              </ConnectionStatus>
              {' • '}
              {t('Dashboard #%s', dashboardId)}
            </HeaderSubtitle>
          </HeaderInfo>
          <CloseButton onClick={() => setIsOpen(false)} aria-label={t('Close')}>
            <CloseIcon />
          </CloseButton>
        </ChatHeader>

        <MessagesContainer>
          {messages.length === 0 ? (
            <WelcomeMessage>
              <h4>👋 {t("Hello! I'm ALLM, your Dashboard Assistant")}</h4>
              <p>{t('I can help you create charts, understand your data, and navigate this dashboard. What would you like to do?')}</p>
              <SuggestionChips>
                {suggestions.map((suggestion, index) => (
                  <SuggestionChip key={index} onClick={() => handleSendMessage(suggestion)}>
                    {suggestion}
                  </SuggestionChip>
                ))}
              </SuggestionChips>
            </WelcomeMessage>
          ) : (
            messages.map(message => (
              <MessageWrapper key={message.id} isUser={message.role === 'user'}>
                <MessageBubble isUser={message.role === 'user'} isStreaming={message.isStreaming}>
                  {message.content || (message.isStreaming ? t('Thinking...') : '')}
                </MessageBubble>
                <MessageTime>{formatTime(message.timestamp)}</MessageTime>
              </MessageWrapper>
            ))
          )}

          {isLoading && !messages.some(m => m.isStreaming) && (
            <MessageWrapper isUser={false}>
              <TypingIndicator>
                <span /><span /><span />
              </TypingIndicator>
            </MessageWrapper>
          )}

          {error && (
            <ErrorMessage>
              {error}
              <button onClick={handleRetry}>{t('Retry')}</button>
            </ErrorMessage>
          )}

          <div ref={messagesEndRef} />
        </MessagesContainer>

        <InputContainer>
          <InputWrapper>
            <TextInput
              ref={inputRef}
              value={inputValue}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder={t('Create chart for...')}
              rows={1}
              disabled={isLoading}
            />
            {isLoading && messages.some(m => m.isStreaming) ? (
              <SendButton disabled={false} onClick={handleStopGeneration} aria-label={t('Stop')}>
                <svg viewBox="0 0 24 24" fill="currentColor" style={{ transform: 'none' }}>
                  <rect x="6" y="6" width="12" height="12" rx="2" />
                </svg>
              </SendButton>
            ) : (
              <SendButton
                onClick={() => handleSendMessage()}
                disabled={!inputValue.trim() || isLoading}
                aria-label={t('Send message')}
              >
                <SendIcon />
              </SendButton>
            )}
          </InputWrapper>
        </InputContainer>
      </ChatWindow>

      <FloatingButton
        isOpen={isOpen}
        onClick={() => setIsOpen(!isOpen)}
        aria-label={isOpen ? t('Close chat') : t('Open chat assistant')}
      >
        {!isOpen && (
          <>
            <SparkleEffect /><SparkleEffect /><SparkleEffect />
          </>
        )}
        {isOpen ? <CloseIcon /> : <AIIcon />}
      </FloatingButton>
    </ChatbotContainer>
  );
};

export default DashboardChatbotStreaming;
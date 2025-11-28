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
  useMemo,
} from 'react';
import { styled, keyframes, useTheme } from '@apache-superset/core/ui';
import { t } from '@superset-ui/core';
import ChatbotMarkdown from './ChatbotMarkdown';


// Types
interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  isStreaming?: boolean;
}

// Serializable version of Message for localStorage
interface StoredMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string; // ISO string
}

interface DashboardChatbotProps {
  dashboardId: number;
  dashboardTitle?: string;
  /** Override the default LLM API URL */
  apiUrl?: string;
  apiKey?: string;
  /** Override the default model name */
  modelName?: string;
  /** Enable streaming responses (default: true) */
  enableStreaming?: boolean;
}

interface ChatCompletionMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

// Chat window size configurations
// type ChatSize = 'small' | 'medium' | 'large';
type ChatSize = 'medium' | 'large';

interface SizeConfig {
  width: number;
  height: number;
}

const SIZE_CONFIGS: Record<ChatSize, SizeConfig> = {
  // small: { width: 360, height: 480 },
  medium: { width: 420, height: 580 },
  large: { width: 520, height: 720 },
};

// const SIZE_ORDER: ChatSize[] = ['small', 'medium', 'large'];
const SIZE_ORDER: ChatSize[] = ['medium', 'large'];

// Configuration - can be overridden via props or environment variables
const DEFAULT_LLM_API_URL = 'http://localhost:8111/v1/chat/completions';
const DEFAULT_LLM_API_KEY = 'http://host.docker.internal:11434/v1__nothing__Qwen3-Coder:latest__http://host.docker.internal:8088__admin__admin';
const DEFAULT_MODEL = 'superset';

// ===========================================
// Sh_DB Brand Colors (from logo)
// ===========================================
const BRAND = {
  coral: '#da6a59',
  coralLight: '#e88a7d',
  coralDark: '#c45a4b',
  coralPale: '#fdf0ee',
  navy: '#172d67',
  navyLight: '#2a4080',
  navyMuted: '#5c73a7',
  navyDeep: '#101f4a',
  peach: '#e9a69b',
  peachLight: '#f2c4bd',
  peachPale: '#f5d9d4',
};

// Local storage keys
const STORAGE_KEYS = {
  MESSAGES: (dashboardId: number) => `superset_chatbot_messages_${dashboardId}`,
  IS_OPEN: (dashboardId: number) => `superset_chatbot_open_${dashboardId}`,
  SIZE: (dashboardId: number) => `superset_chatbot_size_${dashboardId}`,
};

// Helper functions for local storage
const loadFromStorage = <T,>(key: string, defaultValue: T): T => {
  try {
    const stored = localStorage.getItem(key);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (err) {
    console.error('Error loading from localStorage:', err);
  }
  return defaultValue;
};

const saveToStorage = <T,>(key: string, value: T): void => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (err) {
    console.error('Error saving to localStorage:', err);
  }
};

const removeFromStorage = (key: string): void => {
  try {
    localStorage.removeItem(key);
  } catch (err) {
    console.error('Error removing from localStorage:', err);
  }
};

// Convert Message to StoredMessage for localStorage
const serializeMessages = (messages: Message[]): StoredMessage[] => {
  return messages
    .filter(msg => !msg.isStreaming) // Don't store streaming messages
    .map(msg => ({
      id: msg.id,
      role: msg.role,
      content: msg.content,
      timestamp: msg.timestamp.toISOString(),
    }));
};

// Convert StoredMessage back to Message
const deserializeMessages = (stored: StoredMessage[]): Message[] => {
  return stored.map(msg => ({
    id: msg.id,
    role: msg.role,
    content: msg.content,
    timestamp: new Date(msg.timestamp),
    isStreaming: false,
  }));
};

// Animations - Updated with brand colors
const pulseGlow = keyframes`
  0%, 100% {
    box-shadow: 0 0 20px ${BRAND.coral}66,
                0 0 40px ${BRAND.coral}33,
                0 0 60px ${BRAND.coral}1A;
  }
  50% {
    box-shadow: 0 0 25px ${BRAND.coral}99,
                0 0 50px ${BRAND.coral}4D,
                0 0 75px ${BRAND.coral}26;
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

// Styled Components - Updated with Sh_DB Brand Bold theme
const ChatbotContainer = styled.div`
  position: fixed;
  bottom: 24px;
  right: 24px;
  z-index: 1000;
  font-family: 'Space Grotesk', ${({ theme }) => theme.fontFamily || "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"};
`;

const FloatingButton = styled.button<{ isOpen: boolean }>`
  width: 64px;
  height: 64px;
  border-radius: 50%;
  border: 3px solid ${BRAND.peach};
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, ${BRAND.coral} 0%, ${BRAND.coralDark} 50%, ${BRAND.navy} 100%);
  background-size: 200% 200%;
  animation: ${pulseGlow} 2.5s ease-in-out infinite;
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
      rgba(255, 255, 255, 0.15) 50%,
      transparent 70%
    );
    transform: rotate(45deg);
    transition: all 0.5s;
  }

  &:hover {
    transform: scale(1.1);
    border-color: ${BRAND.coral};
    &::before { left: 100%; }
  }

  &:active { transform: scale(0.95); }

  svg {
    width: 30px;
    height: 30px;
    color: white;
    filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.3));
    transition: transform 0.3s ease;
  }

  ${({ isOpen }) => isOpen && `
    transform: rotate(90deg) scale(1);
    background: ${BRAND.navy};
    &:hover { 
      transform: rotate(90deg) scale(1.1); 
      background: ${BRAND.navyLight};
    }
  `}
`;

const SparkleEffect = styled.span`
  position: absolute;
  width: 8px;
  height: 8px;
  background: ${BRAND.peachLight};
  border-radius: 50%;
  animation: ${sparkle} 2s ease-in-out infinite;
  &:nth-of-type(1) { top: 8px; right: 12px; animation-delay: 0s; }
  &:nth-of-type(2) { bottom: 10px; left: 10px; animation-delay: 0.5s; }
  &:nth-of-type(3) { top: 50%; left: 6px; animation-delay: 1s; }
`;

const ChatWindow = styled.div<{ isOpen: boolean; $isDark: boolean; $width: number; $height: number }>`
  position: absolute;
  bottom: 80px;
  right: 0;
  width: ${({ $width }) => $width}px;
  height: ${({ $height }) => $height}px;
  background: ${({ $isDark }) => $isDark 
    ? `linear-gradient(180deg, #111d33 0%, #0d1526 100%)`
    : `linear-gradient(180deg, #ffffff 0%, #faf9f8 100%)`};
  border-radius: 16px;
  box-shadow: 0 8px 32px ${BRAND.navy}1A, 0 16px 48px ${BRAND.coral}14;
  border: 2px solid ${({ $isDark }) => $isDark ? BRAND.navyMuted : BRAND.peach};
  display: ${({ isOpen }) => (isOpen ? 'flex' : 'none')};
  flex-direction: column;
  overflow: hidden;
  animation: ${slideUp} 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  transition: width 0.3s ease, height 0.3s ease;
`;

const ChatHeader = styled.div<{ $isDark: boolean }>`
  padding: 18px 20px;
  background: ${BRAND.navy};
  border-bottom: 3px solid ${BRAND.coral};
  display: flex;
  align-items: center;
  gap: 14px;
`;

const AvatarContainer = styled.div`
  width: 48px;
  height: 48px;
  border-radius: 12px;
  background: linear-gradient(135deg, ${BRAND.coral} 0%, ${BRAND.coralDark} 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 4px 12px ${BRAND.coral}66;
  border: 2px solid ${BRAND.peach};
  svg { width: 26px; height: 26px; color: white; }
`;

const HeaderInfo = styled.div`
  flex: 1;
`;

const HeaderTitle = styled.h3`
  margin: 0;
  font-size: 17px;
  font-weight: 600;
  color: #ffffff;
  letter-spacing: -0.02em;
  font-family: 'Space Grotesk', sans-serif;
`;

const HeaderSubtitle = styled.p`
  margin: 3px 0 0;
  font-size: 12px;
  color: ${BRAND.peachLight};
`;

const ConnectionStatus = styled.span<{ connected: boolean }>`
  display: inline-flex;
  align-items: center;
  gap: 5px;
  &::before {
    content: '';
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: ${({ connected }) => connected ? '#4ade80' : BRAND.coral};
    box-shadow: ${({ connected }) => connected 
      ? '0 0 8px #4ade80' 
      : `0 0 8px ${BRAND.coral}`};
  }
`;

const HeaderButtons = styled.div`
  display: flex;
  gap: 8px;
`;

const HeaderButton = styled.button`
  width: 34px;
  height: 34px;
  border-radius: 8px;
  border: 1px solid ${BRAND.navyMuted};
  background: ${BRAND.navyLight};
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
  &:hover { 
    background: ${BRAND.navyMuted}; 
    transform: scale(1.05);
    border-color: ${BRAND.peach};
  }
  svg { 
    width: 16px; 
    height: 16px; 
    color: ${BRAND.peachLight}; 
  }
`;

const CloseButton = styled(HeaderButton)`
  &:hover {
    background: ${BRAND.coral};
    border-color: ${BRAND.coral};
    svg { color: white; }
  }
`;

const ResetButton = styled(HeaderButton)`
  &:hover {
    background: ${BRAND.coralDark};
    border-color: ${BRAND.coral};
    svg { color: white; }
  }
`;

const ResizeButton = styled(HeaderButton)`
  &:hover {
    background: ${BRAND.navyMuted};
    svg { color: ${BRAND.peach}; }
  }
`;

const MessagesContainer = styled.div<{ $isDark: boolean }>`
  flex: 1;
  overflow-y: auto;
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  background: ${({ $isDark }) => $isDark ? '#0d1526' : '#faf9f8'};

  &::-webkit-scrollbar { width: 6px; }
  &::-webkit-scrollbar-track { background: transparent; }
  &::-webkit-scrollbar-thumb { 
    background: ${({ $isDark }) => $isDark ? BRAND.navyMuted : BRAND.peach}; 
    border-radius: 3px; 
  }
  &::-webkit-scrollbar-thumb:hover { 
    background: ${({ $isDark }) => $isDark ? BRAND.navyLight : BRAND.coral}; 
  }
`;

const MessageWrapper = styled.div<{ isUser: boolean }>`
  display: flex;
  flex-direction: column;
  align-items: ${({ isUser }) => (isUser ? 'flex-end' : 'flex-start')};
  animation: ${fadeIn} 0.3s ease;
`;

const MessageBubble = styled.div<{ isUser: boolean; isStreaming?: boolean; $isDark: boolean }>`
  max-width: 85%;
  padding: 14px 18px;
  border-radius: ${({ isUser }) => isUser 
    ? '16px 16px 4px 16px' 
    : '16px 16px 16px 4px'};
  background: ${({ isUser, $isDark }) => isUser
    ? `linear-gradient(135deg, ${BRAND.coral} 0%, ${BRAND.coralDark} 100%)`
    : $isDark 
      ? BRAND.navyLight
      : '#ffffff'};
  color: ${({ isUser, $isDark }) => isUser 
    ? '#ffffff' 
    : $isDark ? '#e8ebf3' : BRAND.navy};
  font-size: 14px;
  line-height: 1.6;
  box-shadow: ${({ isUser, $isDark }) => isUser
    ? `0 4px 16px ${BRAND.coral}4D`
    : $isDark 
      ? `0 2px 8px ${BRAND.navyDeep}66`
      : `0 2px 12px ${BRAND.navy}14`};
  border: 2px solid ${({ isUser, $isDark }) => isUser 
    ? BRAND.peach 
    : $isDark ? BRAND.navyMuted : BRAND.peachLight};
  white-space: pre-wrap;
  word-break: break-word;
  font-family: 'Space Grotesk', sans-serif;

  ${({ isStreaming }) => isStreaming && `
    &::after {
      content: '▋';
      animation: blink 1s infinite;
      margin-left: 2px;
      color: ${BRAND.coral};
    }
    @keyframes blink {
      0%, 50% { opacity: 1; }
      51%, 100% { opacity: 0; }
    }
  `}
`;

const UserMessageContent = styled.div`
  font-size: 14px;
  line-height: 1.6;
  white-space: pre-wrap;
`;

const MessageTime = styled.span<{ $isDark: boolean }>`
  font-size: 10px;
  color: ${({ $isDark }) => $isDark ? BRAND.navyMuted : BRAND.navyMuted};
  margin-top: 4px;
  padding: 0 4px;
  font-family: 'IBM Plex Mono', monospace;
`;

const TypingIndicator = styled.div<{ $isDark: boolean }>`
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 14px 18px;
  background: ${({ $isDark }) => $isDark ? BRAND.navyLight : '#ffffff'};
  border: 2px solid ${({ $isDark }) => $isDark ? BRAND.navyMuted : BRAND.peachLight};
  border-radius: 16px 16px 16px 4px;
  width: fit-content;
  box-shadow: 0 2px 8px ${BRAND.navy}14;

  span {
    width: 8px;
    height: 8px;
    background: ${BRAND.coral};
    border-radius: 50%;
    animation: ${typingDots} 1.4s ease-in-out infinite;
    &:nth-of-type(2) { animation-delay: 0.2s; background: ${BRAND.peach}; }
    &:nth-of-type(3) { animation-delay: 0.4s; background: ${BRAND.navy}; }
  }
`;

const InputContainer = styled.div<{ $isDark: boolean }>`
  padding: 16px 20px 20px;
  background: ${({ $isDark }) => $isDark ? '#111d33' : '#ffffff'};
  border-top: 2px solid ${({ $isDark }) => $isDark ? BRAND.navyMuted : BRAND.peach};
`;

const InputWrapper = styled.div`
  display: flex;
  gap: 12px;
  align-items: flex-end;
`;

const TextInput = styled.textarea<{ $isDark: boolean }>`
  flex: 1;
  min-height: 46px;
  max-height: 120px;
  padding: 12px 16px;
  border-radius: 12px;
  border: 2px solid ${({ $isDark }) => $isDark ? BRAND.navyMuted : BRAND.peachLight};
  background: ${({ $isDark }) => $isDark ? BRAND.navyDeep : '#faf9f8'};
  color: ${({ $isDark }) => $isDark ? '#e8ebf3' : BRAND.navy};
  font-size: 14px;
  font-family: 'Space Grotesk', sans-serif;
  resize: none;
  outline: none;
  transition: all 0.2s ease;

  &::placeholder { color: ${({ $isDark }) => $isDark ? BRAND.navyMuted : BRAND.navyMuted}; }
  &:focus {
    border-color: ${BRAND.coral};
    background: ${({ $isDark }) => $isDark ? BRAND.navyLight : '#ffffff'};
    box-shadow: 0 0 0 4px ${BRAND.coralPale};
  }
`;

const SendButton = styled.button<{ disabled: boolean }>`
  width: 46px;
  height: 46px;
  border-radius: 12px;
  border: 2px solid ${({ disabled }) => disabled ? BRAND.peachLight : BRAND.peach};
  background: ${({ disabled }) => disabled
    ? BRAND.peachPale
    : `linear-gradient(135deg, ${BRAND.coral} 0%, ${BRAND.coralDark} 100%)`};
  cursor: ${({ disabled }) => disabled ? 'not-allowed' : 'pointer'};
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
  flex-shrink: 0;

  &:hover:not(:disabled) { 
    transform: scale(1.05); 
    box-shadow: 0 6px 20px ${BRAND.coral}66;
    border-color: ${BRAND.coral};
  }
  &:active:not(:disabled) { transform: scale(0.95); }

  svg {
    width: 20px;
    height: 20px;
    color: ${({ disabled }) => disabled ? BRAND.navyMuted : 'white'};
    transform: rotate(-45deg);
  }
`;

const WelcomeMessage = styled.div<{ $isDark: boolean }>`
  text-align: center;
  padding: 24px 20px;
  color: ${({ $isDark }) => $isDark ? BRAND.peachLight : BRAND.navyMuted};

  h4 { 
    font-size: 18px; 
    font-weight: 600; 
    color: ${({ $isDark }) => $isDark ? '#ffffff' : BRAND.navy}; 
    margin: 0 0 10px;
    font-family: 'Space Grotesk', sans-serif;
  }
  p { 
    font-size: 13px; 
    line-height: 1.6; 
    margin: 0 0 20px; 
  }
`;

const SuggestionChips = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  justify-content: center;
`;

const SuggestionChip = styled.button<{ $isDark: boolean }>`
  padding: 10px 16px;
  border-radius: 24px;
  border: 2px solid ${({ $isDark }) => $isDark ? BRAND.navyMuted : BRAND.peach};
  background: ${({ $isDark }) => $isDark ? BRAND.navyLight : BRAND.coralPale};
  color: ${({ $isDark }) => $isDark ? BRAND.peachLight : BRAND.coral};
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  font-family: 'Space Grotesk', sans-serif;

  &:hover {
    background: ${({ $isDark }) => $isDark ? BRAND.navyMuted : BRAND.coral};
    border-color: ${BRAND.coral};
    color: white;
    transform: translateY(-2px);
    box-shadow: 0 4px 12px ${BRAND.coral}4D;
  }
`;

const ErrorMessage = styled.div<{ $isDark: boolean }>`
  padding: 14px 18px;
  background: ${({ $isDark }) => $isDark ? '#2e1a18' : BRAND.coralPale};
  border: 2px solid ${BRAND.coral};
  border-radius: 12px;
  color: ${({ $isDark }) => $isDark ? BRAND.peach : BRAND.coralDark};
  font-size: 13px;
  animation: ${fadeIn} 0.3s ease;
  display: flex;
  align-items: center;
  gap: 10px;

  button {
    margin-left: auto;
    padding: 6px 14px;
    border-radius: 8px;
    border: 2px solid ${BRAND.coral};
    background: ${({ $isDark }) => $isDark ? BRAND.navyLight : 'white'};
    color: ${BRAND.coral};
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    font-family: 'Space Grotesk', sans-serif;
    transition: all 0.2s ease;
    &:hover { 
      background: ${BRAND.coral}; 
      color: white;
    }
  }
`;

// SVG Icons as components - Using Sh_DB logo colors
const AIIcon: FC = () => (
  <svg viewBox="0 0 124 149" width="24" height="29" overflow="hidden">
  <defs><clipPath id="clip0"><rect x="239" y="733" width="124" height="149"/></clipPath></defs><g clipPath="url(#clip0)" transform="translate(-239 -733)"><path d="M25.1285 98.1167C20.4225 102.912 20.1561 110.104 24.4182 115.964 24.9509 116.675 25.5725 117.385 26.1941 118.273 22.4647 120.404 18.6466 120.67 14.6509 119.605 6.39313 117.207 0.355174 109.127 0 99.9814-0.26638 93.7658 1.59828 88.0831 4.52846 82.6667 7.10347 77.9606 10.3 73.6985 14.1182 69.9692 27.8811 56.2062 40.4898 43.6864 54.2528 30.0122 54.3416 29.9234 52.1217 56.9166 51.2338 72.1003 51.2338 72.1003 32.9424 90.3029 25.1285 98.2055Z" fill="${BRAND.peach}" transform="matrix(1 0 0 1.05141 239.2 733)"/><path d="M123.6 0C123.245 2.30863 121.381 15.3613 119.516 28.0587 117.119 44.4855 108.328 59.4028 95.0977 69.5252 74.9416 84.9753 47.0605 106.286 45.0183 107.44 46.6165 96.3409 49.3691 84.2649 50.8786 73.5209L51.2338 71.9227C75.3856 47.9484 99.3598 24.1518 123.6 0Z" fill="${BRAND.coral}" transform="matrix(1 0 0 1.05141 239.2 733)"/><path d="M98.3831 141.714C85.4193 141.714 72.4554 141.892 59.4916 141.714 52.9209 141.625 47.1493 138.873 42.3545 134.344 37.2044 129.372 32.232 124.311 27.082 119.25 26.3716 118.628 26.2829 118.273 27.2596 117.651 32.9424 114.455 38.5363 111.258 44.1303 108.062 44.7519 107.706 45.1071 107.706 45.7286 108.062 63.1321 119.161 98.3831 141.714 98.2943 141.803Z" fill="${BRAND.coral}" transform="matrix(1 0 0 1.05141 239.2 733)"/></g>
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

const ResetIcon: FC = () => (
  <svg viewBox="0 0 24 24" fill="none">
    <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M3 3v5h5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

// Resize icon - expand/contract arrows
const ResizeExpandIcon: FC = () => (
  <svg viewBox="0 0 24 24" fill="none">
    <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const ResizeShrinkIcon: FC = () => (
  <svg viewBox="0 0 24 24" fill="none">
    <path d="M4 14h6v6M20 10h-6V4M14 10l7-7M3 21l7-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
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
  apiKey = DEFAULT_LLM_API_KEY,
  modelName = DEFAULT_MODEL,
  enableStreaming = true,
}) => {
  // Get theme from Superset
  const theme = useTheme();
  
  // Detect if dark mode based on colorBgBase
  const isDark = useMemo(() => {
    return theme.colorBgBase === '#000' || 
           theme.colorBgBase === '#000000' ||
           theme.colorBgBase === '#0d1526' ||
           theme.colorBgBase === '#0a1020';
  }, [theme.colorBgBase]);

  // Initialize state from localStorage
  const [isOpen, setIsOpen] = useState<boolean>(() => 
    loadFromStorage(STORAGE_KEYS.IS_OPEN(dashboardId), false)
  );
  const [messages, setMessages] = useState<Message[]>(() => {
    const stored = loadFromStorage<StoredMessage[]>(STORAGE_KEYS.MESSAGES(dashboardId), []);
    return deserializeMessages(stored);
  });
  const [chatSize, setChatSize] = useState<ChatSize>(() =>
    loadFromStorage(STORAGE_KEYS.SIZE(dashboardId), 'medium')
  );
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(true);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Get current size config
  const sizeConfig = SIZE_CONFIGS[chatSize];

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => { scrollToBottom(); }, [messages, scrollToBottom]);
  useEffect(() => { if (isOpen && inputRef.current) inputRef.current.focus(); }, [isOpen]);

  // Persist isOpen state to localStorage
  useEffect(() => {
    saveToStorage(STORAGE_KEYS.IS_OPEN(dashboardId), isOpen);
  }, [isOpen, dashboardId]);

  // Persist messages to localStorage (debounced to avoid too frequent writes)
  useEffect(() => {
    // Don't save if there are streaming messages
    if (messages.some(m => m.isStreaming)) return;
    
    const serialized = serializeMessages(messages);
    saveToStorage(STORAGE_KEYS.MESSAGES(dashboardId), serialized);
  }, [messages, dashboardId]);

  // Persist chat size to localStorage
  useEffect(() => {
    saveToStorage(STORAGE_KEYS.SIZE(dashboardId), chatSize);
  }, [chatSize, dashboardId]);

  // Cleanup on unmount
  useEffect(() => {
    return () => { abortControllerRef.current?.abort(); };
  }, []);

  const buildSystemPrompt = useCallback((): string => {
    return `Current Dashboard ID: ${dashboardId}`;
  }, [dashboardId, dashboardTitle]);

  // Cycle through chat sizes
  const handleResizeChat = useCallback(() => {
    setChatSize(currentSize => {
      const currentIndex = SIZE_ORDER.indexOf(currentSize);
      const nextIndex = (currentIndex + 1) % SIZE_ORDER.length;
      return SIZE_ORDER[nextIndex];
    });
  }, []);

  // Reset chat history
  const handleResetChat = useCallback(() => {
    // Abort any ongoing request
    abortControllerRef.current?.abort();
    
    // Clear messages
    setMessages([]);
    setInputValue('');
    setError(null);
    setIsLoading(false);
    
    // Remove from localStorage
    removeFromStorage(STORAGE_KEYS.MESSAGES(dashboardId));
  }, [dashboardId]);

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
        ...conversationHistory,
        { role: 'user', content: userMessage + "\n\n" + buildSystemPrompt() },
      ];

      abortControllerRef.current = new AbortController();

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: modelName,
          messages: requestMessages,
          temperature: 0.1,
          max_tokens: 256000,
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

  // Get the appropriate resize icon based on current size
  const getResizeIcon = () => {
    if (chatSize === 'large') {
      return <ResizeShrinkIcon />;
    }
    return <ResizeExpandIcon />;
  };

  // Get tooltip text for resize button
  const getResizeTooltip = () => {
    const currentIndex = SIZE_ORDER.indexOf(chatSize);
    const nextSize = SIZE_ORDER[(currentIndex + 1) % SIZE_ORDER.length];
    return t('Switch to %s size', nextSize);
  };

  return (
    <ChatbotContainer>
      <ChatWindow 
        isOpen={isOpen} 
        $isDark={isDark}
        $width={sizeConfig.width}
        $height={sizeConfig.height}
      >
        <ChatHeader $isDark={isDark}>
          <AvatarContainer>
            <AIIcon />
          </AvatarContainer>
          <HeaderInfo>
            <HeaderTitle>{t('Allm by Shaheen')}</HeaderTitle>
            <HeaderSubtitle>
              <ConnectionStatus connected={isConnected}>
                {isConnected ? t('Connected') : t('Disconnected')}
              </ConnectionStatus>
              {' • '}
              {t('Dashboard #%s', dashboardId)}
            </HeaderSubtitle>
          </HeaderInfo>
          <HeaderButtons>
            <ResizeButton 
              onClick={handleResizeChat} 
              aria-label={getResizeTooltip()}
              title={getResizeTooltip()}
            >
              {getResizeIcon()}
            </ResizeButton>
            <ResetButton 
              onClick={handleResetChat} 
              aria-label={t('New conversation')}
              title={t('Start new conversation')}
            >
              <ResetIcon />
            </ResetButton>
            <CloseButton onClick={() => setIsOpen(false)} aria-label={t('Close')}>
              <CloseIcon />
            </CloseButton>
          </HeaderButtons>
        </ChatHeader>

        <MessagesContainer $isDark={isDark}>
          {messages.length === 0 ? (
            <WelcomeMessage $isDark={isDark}>
              <h4>👋 {t("Hello! I'm Allm, your Dashboard Assistant")}</h4>
              <p>{t('I can help you create charts, understand your data, and navigate this dashboard. What would you like to do?')}</p>
              <SuggestionChips>
                {suggestions.map((suggestion, index) => (
                  <SuggestionChip 
                    key={index} 
                    onClick={() => handleSendMessage(suggestion)}
                    $isDark={isDark}
                  >
                    {suggestion}
                  </SuggestionChip>
                ))}
              </SuggestionChips>
            </WelcomeMessage>
          ) : (
            messages.map(message => (
              <MessageWrapper key={message.id} isUser={message.role === 'user'}>
                <MessageBubble 
                  isUser={message.role === 'user'} 
                  $isDark={isDark}
                  isStreaming={message.isStreaming}
                >
                  {message.role === 'user' ? (
                    <UserMessageContent>{message.content}</UserMessageContent>
                  ) : (
                    <ChatbotMarkdown 
                      content={message.content} 
                      isStreaming={message.isStreaming}
                    />
                  )}
                </MessageBubble>
                <MessageTime $isDark={isDark}>{formatTime(message.timestamp)}</MessageTime>
              </MessageWrapper>
            ))
          )}

          {isLoading && !messages.some(m => m.isStreaming) && (
            <MessageWrapper isUser={false}>
              <TypingIndicator $isDark={isDark}>
                <span /><span /><span />
              </TypingIndicator>
            </MessageWrapper>
          )}

          {error && (
            <ErrorMessage $isDark={isDark}>
              {error}
              <button onClick={handleRetry}>{t('Retry')}</button>
            </ErrorMessage>
          )}

          <div ref={messagesEndRef} />
        </MessagesContainer>

        <InputContainer $isDark={isDark}>
          <InputWrapper>
            <TextInput
              ref={inputRef}
              value={inputValue}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder={t('Create a chart...')}
              rows={1}
              disabled={isLoading}
              $isDark={isDark}
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
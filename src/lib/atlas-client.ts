/**
* Atlas Customer Chat Client
* 
* HTTP client + Socket.io for customer chat endpoint.
*/

import { io, Socket } from 'socket.io-client';

// === TYPES ===

export interface ChatContext {
city?: string | null;
area?: string | null;
vehicle?: string | null;
agent_id?: string | null;
}

export interface ChatRequest {
sessionId: string;
message: string;
}

export interface ChatResponse {
answer: string;
sessionId: string;
locked_context?: ChatContext;
human_mode?: boolean;
}

export interface HistoryMessage {
role: 'user' | 'atlas' | 'agent';
content: string;
}

export interface HistoryResponse {
messages: HistoryMessage[];
human_mode: boolean;
is_archived?: boolean;
}

export interface CustomerReplyEvent {
conversationId: string;
message: string;
sender: string;
}

export interface SessionStatusEvent {
conversationId: string;
status: 'archived' | 'active';
message?: string;
}

// === CONFIGURATION ===
// Use relative URLs so the chat works on whatever server it's hosted on
const BASE_URL = '/api/customer';
const SOCKET_URL = window.location.origin;

// When the backend is served via ngrok, browsers can receive an HTML "warning" page instead of JSON.
// This header is a common way to bypass that interstitial.
const NGROK_SKIP_HEADER = 'ngrok-skip-browser-warning';
const NGROK_SKIP_VALUE = 'true';

// === SESSION MANAGEMENT ===

const SESSION_STORAGE_KEY = 'chat_session_id';

function generateSessionId(): string {
return `session_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
}

let currentSessionId: string | null = null;

export function getSessionId(): string {
if (currentSessionId) {
return currentSessionId;
}

const stored = localStorage.getItem(SESSION_STORAGE_KEY);
if (stored) {
currentSessionId = stored;
console.log('[Atlas] Using existing session:', currentSessionId);
} else {
currentSessionId = generateSessionId();
localStorage.setItem(SESSION_STORAGE_KEY, currentSessionId);
console.log('[Atlas] Created new session:', currentSessionId);
}

return currentSessionId;
}

export function resetSession(): string {
currentSessionId = generateSessionId();
localStorage.setItem(SESSION_STORAGE_KEY, currentSessionId);
console.log('[Atlas] Session reset:', currentSessionId);
return currentSessionId;
}

// === SOCKET.IO ===

let socket: Socket | null = null;
let replyCallback: ((event: CustomerReplyEvent) => void) | null = null;
let socketConnected = false;
let agentTypingCallback: ((sessionId: string) => void) | null = null;

export function isSocketConnected(): boolean {
return socketConnected && socket?.connected === true;
}

let statusCallback: ((event: SessionStatusEvent) => void) | null = null;

export function connectSocket(
onReply: (event: CustomerReplyEvent) => void,
onStatusChange?: (event: SessionStatusEvent) => void,
onAgentTyping?: (sessionId: string) => void
): void {
// Ensure sessionId is initialized before connecting
const sessionId = getSessionId();

// Always update callbacks so new references are used
replyCallback = onReply;
statusCallback = onStatusChange || null;
agentTypingCallback = onAgentTyping || null;

if (socket?.connected) {
console.log('[Atlas] Socket already connected, callbacks updated');
return;
}

console.log('[Atlas] Connecting socket to', SOCKET_URL, 'for session', sessionId);

socket = io(SOCKET_URL, {
transports: ['websocket', 'polling'],
autoConnect: true,

// Many Socket.io backends identify the conversation via handshake auth/query.
// We send both keys to maximize compatibility (server can ignore what it doesn't use).
auth: { sessionId, conversationId: sessionId, ngrokSkipBrowserWarning: NGROK_SKIP_VALUE },
query: { sessionId, conversationId: sessionId, [NGROK_SKIP_HEADER]: NGROK_SKIP_VALUE },
});

replyCallback = onReply;
statusCallback = onStatusChange || null;
agentTypingCallback = onAgentTyping || null;

socket.on('connect', () => {
console.log('[Atlas] Socket connected:', socket?.id);
socketConnected = true;

// Join the session room so the server knows to send events to this client
socket?.emit('join', { sessionId, conversationId: sessionId });
console.log('[Atlas] Emitted join event for session:', sessionId);
});

socket.on('disconnect', (reason) => {
console.log('[Atlas] Socket disconnected:', reason);
socketConnected = false;
});

socket.on('connect_error', (error) => {
console.error('[Atlas] Socket connection error:', error);
socketConnected = false;
});

// Listen for agent replies - the event name from the server
socket.on('team:customer_reply', (data: CustomerReplyEvent | Record<string, unknown>) => {
console.log('[Atlas] Received team:customer_reply:', data);

// Be tolerant if backend uses different key names.
const incomingConversationId =
(data as CustomerReplyEvent).conversationId ||
(data as Record<string, unknown>).sessionId ||
(data as Record<string, unknown>).conversation_id;

const currentSession = getSessionId();

// Accept if session matches OR if no session specified (broadcast to room)
if (!incomingConversationId || incomingConversationId === currentSession) {
console.log('[Atlas] Message matches our session, forwarding to callback');
replyCallback?.({
conversationId: currentSession,
message: (data as CustomerReplyEvent).message || (data as Record<string, unknown>).content as string || '',
sender: (data as CustomerReplyEvent).sender || (data as Record<string, unknown>).agent as string || 'agent',
});
} else {
console.log(
'[Atlas] Message for different session, ignoring:',
incomingConversationId,
'vs',
currentSession
);
}
});

// Listen for session status changes (archived, etc.)
socket.on('team:session_status', (data: SessionStatusEvent | Record<string, unknown>) => {
console.log('[Atlas] Received team:session_status:', data);

const incomingConversationId =
(data as SessionStatusEvent).conversationId ||
(data as Record<string, unknown>).sessionId ||
(data as Record<string, unknown>).conversation_id;

const currentSession = getSessionId();

if (!incomingConversationId || incomingConversationId === currentSession) {
console.log('[Atlas] Status change matches our session, forwarding to callback');
statusCallback?.({
conversationId: currentSession,
status: (data as SessionStatusEvent).status || 'archived',
message: (data as SessionStatusEvent).message || (data as Record<string, unknown>).message as string,
});
}
});

// Listen for agent typing indicator
socket.on('client:agent_typing', (data: { sessionId?: string; conversationId?: string }) => {
console.log('[Atlas] Received client:agent_typing:', data);

const incomingId = data.sessionId || data.conversationId;
const currentSession = getSessionId();

if (!incomingId || incomingId === currentSession) {
console.log('[Atlas] Agent is typing in our session');
agentTypingCallback?.(currentSession);
}
});
}

export function disconnectSocket(): void {
if (socket) {
console.log('[Atlas] Disconnecting socket');
socket.disconnect();
}

socket = null;
socketConnected = false;
replyCallback = null;
statusCallback = null;
agentTypingCallback = null;
}

/**
* Emit client:end_chat event to notify the server that the customer ended the chat
*/
export function emitEndChat(): void {
const sessionId = getSessionId();

if (socket?.connected) {
console.log('[Atlas] Emitting client:end_chat for session:', sessionId);
socket.emit('client:end_chat', { sessionId, conversationId: sessionId });
} else {
console.warn('[Atlas] Cannot emit end_chat - socket not connected');
}
}

/**
* Emit client:typing event to notify the server that the customer is typing.
* Throttled externally - call this directly when you want to emit.
*/
export function emitTyping(): void {
const sessionId = getSessionId();

if (socket?.connected) {
console.log('[Atlas] Emitting client:typing for session:', sessionId);
socket.emit('client:typing', { sessionId, conversationId: sessionId });
}
}


// === API CALLS ===

export interface ContactContext {
contact_name?: string;
contact_email?: string;
contact_phone?: string;
}

export async function sendMessage(
message: string,
isFirstMessage: boolean = false, // 🔥 LÄGG TILL PARAMETER
context?: ChatContext & ContactContext
): Promise<ChatResponse> {
const sessionId = getSessionId();

console.log('[Atlas] Sending message:', { sessionId, message, isFirstMessage, context });

const body: Record<string, unknown> = {
sessionId,
message,
isFirstMessage, // 🔥 INKLUDERA I PAYLOAD
};

// --- DIN BEVARADE LOGIK FÖR CONTEXT (UPPDATERAD) ---
// Vi lägger till agent_id i kontrollen och i objektet
if (context && (context.city || context.area || context.vehicle || context.agent_id || context.contact_name || context.contact_email)) {
  const locked_context: ChatContext & ContactContext = {
    city: context.city ?? null,
    area: context.area ?? null,
    vehicle: context.vehicle ?? null,
    agent_id: context.agent_id ?? null, // 🔥 VIKTIGT: Skickar taggen till servern
  };

if (context.contact_name) locked_context.contact_name = context.contact_name;
if (context.contact_email) locked_context.contact_email = context.contact_email;
if (context.contact_phone) locked_context.contact_phone = context.contact_phone;

// Claude-style shape
body.context = { locked_context };

// Extra fallbacks för andra backends (Bevarade)
body.locked_context = locked_context;
if (locked_context.city) body.city = locked_context.city;
if (locked_context.area) body.area = locked_context.area;
if (locked_context.vehicle) body.vehicle = locked_context.vehicle;
if (locked_context.contact_name) body.contact_name = locked_context.contact_name;
if (locked_context.contact_email) body.contact_email = locked_context.contact_email;
if (locked_context.contact_phone) body.contact_phone = locked_context.contact_phone;
}

const response = await fetch(`${BASE_URL}/message`, {
method: 'POST',
headers: {
'Content-Type': 'application/json',
[NGROK_SKIP_HEADER]: NGROK_SKIP_VALUE,
},
body: JSON.stringify(body),
});

if (!response.ok) {
const errorText = await response.text();
console.error('[Atlas] API Error:', response.status, errorText);
throw new Error(`API Error ${response.status}: ${errorText}`);
}

const contentType = response.headers.get('content-type') ?? '';
if (!contentType.includes('application/json')) {
const text = await response.text();
console.error('[Atlas] API Non-JSON Response:', text.slice(0, 500));
throw new Error(`API returned non-JSON (${contentType || 'unknown content-type'})`);
}

const data = await response.json();
console.log('[Atlas] Response:', data);

// ✅ FIX: Vi hämtar locked_context och human_mode direkt från roten 'data'
// Tidigare användes 'innerData' som blev en sträng, vilket pajade synken.
return {
  answer: data.answer || (typeof data === 'string' ? data : ""),
  sessionId: data.sessionId,
  locked_context: data.locked_context, // Nu når denna data fram till AtlasChat.tsx
  human_mode: data.human_mode,
};
}

/**
* Fetch conversation history for polling in human mode
*/
export async function getHistory(): Promise<HistoryResponse> {
const sessionId = getSessionId();

console.log('[Atlas] Fetching history:', { sessionId });

const response = await fetch(`${BASE_URL}/history/${sessionId}`, {
method: 'GET',
headers: {
'Content-Type': 'application/json',
[NGROK_SKIP_HEADER]: NGROK_SKIP_VALUE,
},
});

if (!response.ok) {
const errorText = await response.text();
console.error('[Atlas] History Error:', response.status, errorText);
throw new Error(`API Error ${response.status}: ${errorText}`);
}

const contentType = response.headers.get('content-type') ?? '';
if (!contentType.includes('application/json')) {
const text = await response.text();
console.error('[Atlas] History Non-JSON Response:', text.slice(0, 500));
throw new Error(
`History returned non-JSON (${contentType || 'unknown content-type'})`
);
}

const data = await response.json();
console.log('[Atlas] History:', data);

return {
messages: data.messages || [],
human_mode: data.human_mode || false,
is_archived: data.is_archived || false,
};
}

/**
 * Hämtar alla publika kontor från backend (Atlas 4.0)
 */
export async function getPublicOffices(): Promise<any[]> {
  const response = await fetch('/api/public/offices', {
    headers: { [NGROK_SKIP_HEADER]: NGROK_SKIP_VALUE }
  });
  if (!response.ok) throw new Error('Failed to fetch offices');
  return response.json();
}
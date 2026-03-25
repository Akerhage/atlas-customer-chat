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
close_reason?: string | null;
}

export interface CustomerReplyEvent {
conversationId: string;
message: string;
sender: string;
}

export interface SessionStatusEvent {
conversationId: string;
status: 'archived' | 'active';
close_reason?: string;
message?: string;
}

export interface SessionWarningEvent {
conversationId: string;
sessionId: string;
minutesLeft: number;
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
let agentTypingCallback: ((sessionId: string, agentName: string | null) => void) | null = null;

export function isSocketConnected(): boolean {
return socketConnected && socket?.connected === true;
}

let statusCallback: ((event: SessionStatusEvent) => void) | null = null;
let warningCallback: ((event: SessionWarningEvent) => void) | null = null;

// ============================================================
// HJÄLP: Registrerar alla socket-lyssnare på ett ställe så
// att de enkelt kan tas bort och sättas om när callbacks byts.
// ============================================================
function registerSocketListeners(): void {
if (!socket) return;

// Ta bort gamla lyssnare först (förhindrar dubbla triggers)
socket.off('team:customer_reply');
socket.off('team:session_status');
socket.off('client:agent_typing');
socket.off('team:session_warning');

// Agentens svar → kunden
socket.on('team:customer_reply', (data: CustomerReplyEvent | Record<string, unknown>) => {
console.log('[Atlas] Received team:customer_reply:', data);

// Filtrera bort ekon av kundens egna meddelanden (sender='user').
// Servern emittar team:customer_reply via io.emit() (HTTP-vägen) som når
// alla sockets inkl. kundens egna kundchatt — detta skapar ett eko-dublett.
const senderValue = (data as CustomerReplyEvent).sender || (data as Record<string, unknown>).agent as string || '';
if (senderValue === 'user') {
  console.log('[Atlas] Ignoring own message echo (sender=user)');
  return;
}

const incomingConversationId =
  (data as CustomerReplyEvent).conversationId ||
  (data as Record<string, unknown>).sessionId ||
  (data as Record<string, unknown>).conversation_id;

const currentSession = getSessionId();

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

// Session-statusändringar (arkivering etc.)
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
    close_reason: (data as SessionStatusEvent).close_reason || (data as Record<string, unknown>).close_reason as string,
    message: (data as SessionStatusEvent).message || (data as Record<string, unknown>).message as string,
  });
}
});

// Agent skriver-indikator
socket.on('client:agent_typing', (data: { sessionId?: string; conversationId?: string; agentName?: string | null }) => {
console.log('[Atlas] Received client:agent_typing:', data);

const incomingId = data.sessionId || data.conversationId;
const currentSession = getSessionId();

if (!incomingId || incomingId === currentSession) {
  console.log('[Atlas] Agent is typing in our session');
  agentTypingCallback?.(currentSession, data.agentName || null);
}
});

// Inaktivitetsvarning (5 min innan auto-arkivering)
socket.on('team:session_warning', (data: SessionWarningEvent | Record<string, unknown>) => {
console.log('[Atlas] Received team:session_warning:', data);

const incomingId =
  (data as SessionWarningEvent).conversationId ||
  (data as Record<string, unknown>).sessionId as string;

const currentSession = getSessionId();

if (!incomingId || incomingId === currentSession) {
  console.log('[Atlas] Inactivity warning matches our session, forwarding to callback');
  warningCallback?.({
    conversationId: currentSession,
    sessionId: currentSession,
    minutesLeft: (data as SessionWarningEvent).minutesLeft ?? 5,
  });
}
});
}

export function connectSocket(
onReply: (event: CustomerReplyEvent) => void,
onStatusChange?: (event: SessionStatusEvent) => void,
onAgentTyping?: (sessionId: string, agentName: string | null) => void,
onWarning?: (event: SessionWarningEvent) => void
): void {
// Säkerställ att sessionId är initierat innan anslutning
const sessionId = getSessionId();

// Uppdatera alltid callbacks så nya referenser används
replyCallback = onReply;
statusCallback = onStatusChange || null;
agentTypingCallback = onAgentTyping || null;
warningCallback = onWarning || null;

// FIX: Om socketen redan är ansluten, registrera om lyssnarna med nya callbacks
// istället för att bara returnera — annars pekar lyssnarna på gamla stängda referenser.
if (socket?.connected) {
  console.log('[Atlas] Socket already connected, re-registering listeners with fresh callbacks');
  registerSocketListeners();
  return;
}

console.log('[Atlas] Connecting socket to', SOCKET_URL, 'for session', sessionId);

socket = io(SOCKET_URL, {
transports: ['websocket', 'polling'],
autoConnect: true,
auth: { sessionId, conversationId: sessionId, ngrokSkipBrowserWarning: NGROK_SKIP_VALUE },
query: { sessionId, conversationId: sessionId, [NGROK_SKIP_HEADER]: NGROK_SKIP_VALUE },
});

socket.on('connect', () => {
console.log('[Atlas] Socket connected:', socket?.id);
socketConnected = true;

// Gå med i session-rummet så servern kan skicka riktade events
socket?.emit('join', { sessionId, conversationId: sessionId });
console.log('[Atlas] Emitted join event for session:', sessionId);

// Registrera lyssnare direkt vid anslutning (säkerställer färska callbacks)
registerSocketListeners();
});

socket.on('disconnect', (reason) => {
console.log('[Atlas] Socket disconnected:', reason);
socketConnected = false;
});

socket.on('connect_error', (error) => {
console.error('[Atlas] Socket connection error:', error);
socketConnected = false;
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
warningCallback = null;
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
name?: string;
email?: string;
phone?: string;
}

export async function sendMessage(
  message: string,
  isFirstMessage: boolean = false,
  context?: ChatContext & ContactContext
): Promise<ChatResponse> {
  const sessionId = getSessionId();

  console.log('[Atlas] Sending message:', { sessionId, message, isFirstMessage, context });

  const body: Record<string, unknown> = {
    sessionId,
    message,
    isFirstMessage,
  };

  if (context && (context.city || context.area || context.vehicle || context.agent_id || context.name || context.email || context.phone)) {
    const locked_context: any = {
      city: context.city ?? null,
      area: context.area ?? null,
      vehicle: context.vehicle ?? null,
      agent_id: context.agent_id ?? null,
    };

    if (context.name) locked_context.name = context.name;
    if (context.email) locked_context.email = context.email;
    if (context.phone) locked_context.phone = context.phone;

    body.context = { locked_context };
    body.locked_context = locked_context;
    if (locked_context.name) body.name = locked_context.name;
    if (locked_context.email) body.email = locked_context.email;
    if (locked_context.phone) body.phone = locked_context.phone;
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

return {
  answer: data.answer || (typeof data === 'string' ? data : ""),
  sessionId: data.sessionId,
  locked_context: data.locked_context,
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
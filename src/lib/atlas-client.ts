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
vehicle_choice?: string | null;
clear_vehicle?: boolean;
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
is_archived?: boolean;
close_reason?: string | null;
choices?: { label: string; value: string }[];
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

export interface PublicConfig {
ai_replies_enabled: boolean;
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
} else {
currentSessionId = generateSessionId();
localStorage.setItem(SESSION_STORAGE_KEY, currentSessionId);
}

return currentSessionId;
}

export function resetSession(): string {
currentSessionId = generateSessionId();
localStorage.setItem(SESSION_STORAGE_KEY, currentSessionId);
return currentSessionId;
}

// === SOCKET.IO ===

let socket: Socket | null = null;
let replyCallback: ((event: CustomerReplyEvent) => void) | null = null;
let socketConnected = false;
let agentTypingCallback: ((sessionId: string, agentName: string | null, isTyping: boolean) => void) | null = null;

export function isSocketConnected(): boolean {
return socketConnected && socket?.connected === true;
}

let statusCallback: ((event: SessionStatusEvent) => void) | null = null;
let warningCallback: ((event: SessionWarningEvent) => void) | null = null;
let assignmentCallback: ((agentName: string | null) => void) | null = null;

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
socket.off('team:session_assigned');

// Agentens svar → kunden
socket.on('team:customer_reply', (data: CustomerReplyEvent | Record<string, unknown>) => {
// Filtrera bort ekon av kundens egna meddelanden (sender='user').
// Servern emittar team:customer_reply via io.emit() (HTTP-vägen) som når
// alla sockets inkl. kundens egna kundchatt — detta skapar ett eko-dublett.
const senderValue = (data as CustomerReplyEvent).sender || (data as Record<string, unknown>).agent as string || '';
if (senderValue === 'user') {
  return;
}

const incomingConversationId =
  (data as CustomerReplyEvent).conversationId ||
  (data as Record<string, unknown>).sessionId ||
  (data as Record<string, unknown>).conversation_id;

const currentSession = getSessionId();

if (!incomingConversationId || incomingConversationId === currentSession) {
  replyCallback?.({
    conversationId: currentSession,
    message: (data as CustomerReplyEvent).message || (data as Record<string, unknown>).content as string || '',
    sender: (data as CustomerReplyEvent).sender || (data as Record<string, unknown>).agent as string || 'agent',
  });
}
});

// Session-statusändringar (arkivering etc.)
socket.on('team:session_status', (data: SessionStatusEvent | Record<string, unknown>) => {
const incomingConversationId =
  (data as SessionStatusEvent).conversationId ||
  (data as Record<string, unknown>).sessionId ||
  (data as Record<string, unknown>).conversation_id;

const currentSession = getSessionId();

if (!incomingConversationId || incomingConversationId === currentSession) {
  statusCallback?.({
    conversationId: currentSession,
    status: (data as SessionStatusEvent).status || 'archived',
    close_reason: (data as SessionStatusEvent).close_reason || (data as Record<string, unknown>).close_reason as string,
    message: (data as SessionStatusEvent).message || (data as Record<string, unknown>).message as string,
  });
}
});

// Agent skriver-indikator
socket.on('client:agent_typing', (data: { sessionId?: string; conversationId?: string; agentName?: string | null; isTyping?: boolean; is_typing?: boolean }) => {
const incomingId = data.sessionId || data.conversationId;
const currentSession = getSessionId();

if (!incomingId || incomingId === currentSession) {
  agentTypingCallback?.(currentSession, data.agentName || null, data.isTyping !== false && data.is_typing !== false);
}
});

// Inaktivitetsvarning (5 min innan auto-arkivering)
socket.on('team:session_warning', (data: SessionWarningEvent | Record<string, unknown>) => {
const incomingId =
  (data as SessionWarningEvent).conversationId ||
  (data as Record<string, unknown>).sessionId as string;

const currentSession = getSessionId();

if (!incomingId || incomingId === currentSession) {
  warningCallback?.({
    conversationId: currentSession,
    sessionId: currentSession,
    minutesLeft: (data as SessionWarningEvent).minutesLeft ?? 5,
  });
}
});

// Tilldelning av handläggare — server emittar team:session_assigned vid claim
socket.on('team:session_assigned', (data: { conversationId?: string; agentName?: string | null }) => {
const incomingId = data.conversationId;
if (!incomingId || incomingId === getSessionId()) assignmentCallback?.(data.agentName || null);
});
}

export function connectSocket(
onReply: (event: CustomerReplyEvent) => void,
onStatusChange?: (event: SessionStatusEvent) => void,
onAgentTyping?: (sessionId: string, agentName: string | null, isTyping: boolean) => void,
onWarning?: (event: SessionWarningEvent) => void,
onAssigned?: (agentName: string | null) => void
): void {
// Säkerställ att sessionId är initierat innan anslutning
const sessionId = getSessionId();

// Uppdatera alltid callbacks så nya referenser används
replyCallback = onReply;
statusCallback = onStatusChange || null;
agentTypingCallback = onAgentTyping || null;
warningCallback = onWarning || null;
assignmentCallback = onAssigned || null;

// Om socketen redan är ansluten, registrera om lyssnarna med nya callbacks
// istället för att bara returnera — annars pekar lyssnarna på gamla stängda referenser.
if (socket?.connected) {
  registerSocketListeners();
  return;
}

socket = io(SOCKET_URL, {
transports: ['websocket', 'polling'],
autoConnect: true,
auth: { sessionId, conversationId: sessionId, ngrokSkipBrowserWarning: NGROK_SKIP_VALUE },
query: { sessionId, conversationId: sessionId, [NGROK_SKIP_HEADER]: NGROK_SKIP_VALUE },
});

socket.on('connect', () => {
socketConnected = true;

// Gå med i session-rummet så servern kan skicka riktade events
socket?.emit('join', { sessionId, conversationId: sessionId });

// Registrera lyssnare direkt vid anslutning (säkerställer färska callbacks)
registerSocketListeners();
});

socket.on('disconnect', (reason) => {
socketConnected = false;
});

socket.on('connect_error', (error) => {
console.error('[Atlas] Socket connection error:', error);
socketConnected = false;
});
}

export function disconnectSocket(): void {
if (socket) {
socket.disconnect();
}

socket = null;
socketConnected = false;
replyCallback = null;
statusCallback = null;
agentTypingCallback = null;
warningCallback = null;
assignmentCallback = null;
}

/**
* Emit client:end_chat event to notify the server that the customer ended the chat
*/
export function emitEndChat(): void {
const sessionId = getSessionId();

if (socket?.connected) {
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

  const body: Record<string, unknown> = {
    sessionId,
    message,
    isFirstMessage,
  };

  if (context && (context.city || context.area || context.vehicle || context.vehicle_choice || context.clear_vehicle || context.agent_id || context.name || context.email || context.phone)) {
    const locked_context: any = {
      city: context.city ?? null,
      area: context.area ?? null,
      vehicle: context.vehicle ?? null,
      agent_id: context.agent_id ?? null,
    };

    if (context.vehicle_choice) locked_context.vehicle_choice = context.vehicle_choice;
    if (context.name) locked_context.name = context.name;
    if (context.email) locked_context.email = context.email;
    if (context.phone) locked_context.phone = context.phone;

    body.context = { locked_context };
    body.locked_context = locked_context;
    if (context.clear_vehicle) body.clear_vehicle = true;
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

if (response.status === 410) {
const data = await response.json().catch(() => ({}));
return {
  answer: data.answer || "",
  sessionId: data.sessionId || sessionId,
  human_mode: data.human_mode,
  is_archived: true,
  close_reason: data.close_reason || 'deleted',
};
}

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

return {
  answer: data.answer || (typeof data === 'string' ? data : ""),
  sessionId: data.sessionId,
  locked_context: data.locked_context,
  human_mode: data.human_mode,
  is_archived: data.is_archived || false,
  close_reason: data.close_reason || null,
  choices: data.choices,
};
}

/**
* Fetch conversation history for polling in human mode
*/
export async function getHistory(): Promise<HistoryResponse> {
const sessionId = getSessionId();

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

return {
messages: data.messages || [],
human_mode: data.human_mode || false,
is_archived: data.is_archived || false,
close_reason: data.close_reason || null,
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

/**
 * Hamtar publik kundchatt-konfiguration.
 * Fail-safe: om servern inte svarar antar klienten att AI-svar ar pa.
 */
export async function getPublicConfig(): Promise<PublicConfig> {
  try {
    const response = await fetch('/api/public/config', {
      headers: { [NGROK_SKIP_HEADER]: NGROK_SKIP_VALUE }
    });
    if (!response.ok) throw new Error('Failed to fetch public config');
    const data = await response.json();
    return { ai_replies_enabled: data?.ai_replies_enabled !== false };
  } catch (err) {
    console.warn('[Atlas] Kunde inte hamta publik konfiguration:', err);
    return { ai_replies_enabled: true };
  }
}

export interface CustomerTemplate {
  id: number;
  title: string;
  content: string;
  sub_group?: string | null;
}

export type ActiveVehicle = "BIL" | "MC" | "AM" | "LASTBIL" | "SLÄP";

export interface TenantConfig {
  companyName: string;
  companyLogoUrl: string | null;
  activeVehicles: ActiveVehicle[];
  quickQuestions: string[];
}

const DEFAULT_ACTIVE_VEHICLES: ActiveVehicle[] = ["BIL", "MC", "AM", "LASTBIL", "SLÄP"];
const DEFAULT_TENANT_CONFIG: TenantConfig = {
  companyName: 'Atlas',
  companyLogoUrl: null,
  activeVehicles: DEFAULT_ACTIVE_VEHICLES,
  quickQuestions: [],
};

function normalizeActiveVehicles(value: unknown): ActiveVehicle[] {
  if (!Array.isArray(value)) return DEFAULT_ACTIVE_VEHICLES;
  const valid = new Set(DEFAULT_ACTIVE_VEHICLES);
  const vehicles = value
    .map((item) => String(item || "").trim().toUpperCase())
    .filter((item): item is ActiveVehicle => valid.has(item as ActiveVehicle))
    .filter((item, index, arr) => arr.indexOf(item) === index);
  return vehicles.length ? vehicles : DEFAULT_ACTIVE_VEHICLES;
}

function normalizeTenantLogoUrl(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed;
}

export function resolveTenantAssetUrl(value: string | null | undefined): string | null {
  const trimmed = String(value || '').trim();
  if (!trimmed) return null;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (trimmed.startsWith('/') && !trimmed.startsWith('//')) {
    return `${window.location.origin}${trimmed}`;
  }
  return null;
}

export async function getTenantConfig(): Promise<TenantConfig> {
  try {
    const response = await fetch('/api/tenant-name', {
      headers: { [NGROK_SKIP_HEADER]: NGROK_SKIP_VALUE }
    });
    if (!response.ok) return DEFAULT_TENANT_CONFIG;
    const data = await response.json();
    const companyName = (typeof data?.company_name === 'string' && data.company_name.trim()) ? data.company_name.trim() : 'Atlas';
    return {
      companyName,
      companyLogoUrl: normalizeTenantLogoUrl(data?.company_logo_url),
      activeVehicles: normalizeActiveVehicles(data?.active_vehicles),
      quickQuestions: Array.isArray(data?.quick_questions)
        ? data.quick_questions.map((q: unknown) => String(q || "").trim()).filter(Boolean)
        : [],
    };
  } catch {
    return DEFAULT_TENANT_CONFIG;
  }
}

export async function getTenantName(): Promise<string> {
  return (await getTenantConfig()).companyName;
}

/**
 * Hämtar mailmallar med group_name='KUNDCHATT' för snabbsvars-listan i kundchatten.
 * Returnerar tom lista vid fel så att (i)-ikonen kan döljas utan att krascha UI.
 */
export async function getCustomerTemplates(): Promise<CustomerTemplate[]> {
  try {
    const response = await fetch('/api/public/templates/kundchatt', {
      headers: { [NGROK_SKIP_HEADER]: NGROK_SKIP_VALUE }
    });
    if (!response.ok) return [];
    const data = await response.json();
    return Array.isArray(data) ? data : [];
  } catch (err) {
    console.warn('[Atlas] Kunde inte hämta kundchatt-mallar:', err);
    return [];
  }
}

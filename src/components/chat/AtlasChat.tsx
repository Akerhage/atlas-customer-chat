declare global {
interface Window {
selectedCity: string | null;
selectedVehicle: "BIL" | "MC" | "AM" | null;
}
}

// 2. INITIALISERA GLOBALT (FÖRE IMPORTS)
if (typeof window !== 'undefined') {
window.selectedCity = null;
window.selectedVehicle = null;
}
import { useState, useRef, useEffect, useCallback } from "react";
import { ChatHeader } from "./ChatHeader";
import { ChatBubble } from "./ChatBubble";
import { ChatInput } from "./ChatInput";
import { TypingIndicator } from "./TypingIndicator";
import { WelcomeMessage } from "./WelcomeMessage";
import { EndSessionDialog } from "./EndSessionDialog";
import { NameInputDialog, type ContactInfo } from "./NameInputDialog";
import { ContextIndicator } from "./ContextIndicator";
import { HumanModeIndicator } from "./HumanModeIndicator";
import {
sendMessage,
resetSession,
getHistory,
connectSocket,
disconnectSocket,
getSessionId,
emitEndChat,
type ChatContext,
type HistoryMessage,
type CustomerReplyEvent,
type SessionStatusEvent,
} from "@/lib/atlas-client";
import { toast } from "sonner";

interface ChatMessage {
id: string;
role: 'user' | 'assistant';
content: string;
timestamp: Date;
}

// Convert history role to our internal role
function mapHistoryRole(role: HistoryMessage['role']): 'user' | 'assistant' {
return role === 'user' ? 'user' : 'assistant';
}

function splitCityArea(label: string): Pick<ChatContext, 'city' | 'area'> {
const normalized = label.trim();
const enDashParts = normalized.split(' – ');
if (enDashParts.length === 2) {
return { city: enDashParts[0].trim(), area: enDashParts[1].trim() };
}

const hyphenParts = normalized.split(' - ');
if (hyphenParts.length === 2) {
return { city: hyphenParts[0].trim(), area: hyphenParts[1].trim() };
}

return { city: normalized, area: null };
}

const normalizeForAgent = (label: string): string => {
if (!label || label === "Centralsupport") return "centralsupport";

return label
.toLowerCase()
.replace(/å|ä/g, 'a')  // å, ä -> a
.replace(/ö/g, 'o')    // ö -> o
.replace(/\s*[–-]\s*/g, '_') // " – " eller " - " -> _
.replace(/\s+/g, '_')  // Mellanslag -> _
.trim();
};

export function AtlasChat() {
const [messages, setMessages] = useState<ChatMessage[]>([]);
const [isTyping, setIsTyping] = useState(false);
const [isDark, setIsDark] = useState(true);
const [showEndDialog, setShowEndDialog] = useState(false);
const [showNameDialog, setShowNameDialog] = useState(false);
const [humanMode, setHumanMode] = useState(false);
const [agentName, setAgentName] = useState<string | null>(null);
const [isArchived, setIsArchived] = useState(false);
const [closedByAgent, setClosedByAgent] = useState(false);
const [customerName, setCustomerName] = useState<string | null>(null);
const [customerEmail, setCustomerEmail] = useState<string | null>(null);
const [customerPhone, setCustomerPhone] = useState<string | null>(null);
const [archivedMessage, setArchivedMessage] = useState<string | null>(null);
const [context, setContext] = useState<ChatContext>({
city: null,
area: null,
vehicle: null,
});
// Separate state for selection UI (before first message is sent)
const [selectedVehicle, setSelectedVehicle] = useState<"BIL" | "MC" | "AM" | null>(null);
const [selectedCity, setSelectedCity] = useState<string | null>(null);

// 🔥 FIX: Synka isDark med HTML-elementet (Gör popup-rutor mörka)
useEffect(() => {
if (isDark) {
document.documentElement.classList.add('dark');
} else {
document.documentElement.classList.remove('dark');
}
}, [isDark]);

useEffect(() => {
// @ts-ignore
window.selectedCity = selectedCity;
// @ts-ignore
window.selectedVehicle = selectedVehicle;
}, [selectedCity, selectedVehicle]);

// Keep context in sync with selections so it can be sent even for manual input
const handleVehicleChange = (vehicle: "BIL" | "MC" | "AM" | null) => {
setSelectedVehicle(vehicle);
setContext((prev) => ({ ...prev, vehicle }));
};

const handleCityChange = (locationLabel: string | null) => {
setSelectedCity(locationLabel);
setContext((prev) => {
if (!locationLabel) return { ...prev, city: null, area: null };
const { city, area } = splitCityArea(locationLabel);
return { ...prev, city, area };
});
};
const messagesEndRef = useRef<HTMLDivElement>(null);
const scrollContainerRef = useRef<HTMLDivElement>(null);
const lastMessageCountRef = useRef<number>(0);

const generateMessageId = () => `msg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

const scrollToBottom = useCallback(() => {
messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
}, []);

useEffect(() => {
scrollToBottom();
}, [messages, isTyping, scrollToBottom]);

// Socket.io connection for real-time agent replies
const handleAgentReply = useCallback((event: CustomerReplyEvent) => {
console.log('[AtlasChat] Received agent reply via socket:', event);

// Store the agent name when we receive a reply
if (event.sender && event.sender !== 'agent') {
setAgentName(event.sender);
}

const agentMessage: ChatMessage = {
id: generateMessageId(),
role: 'assistant',
content: event.message,
timestamp: new Date(),
};

setMessages((prev) => [...prev, agentMessage]);
lastMessageCountRef.current += 1;
setIsTyping(false);
}, []);

// Handle session status changes (archived, etc.)
const handleSessionStatus = useCallback((event: SessionStatusEvent) => {
console.log('[AtlasChat] Received session status via socket:', event);

if (event.status === 'archived') {
setIsArchived(true);
setArchivedMessage(event.message || 'Chatten är avslutad av handläggaren.');
setIsTyping(false);
setClosedByAgent(true);
// Show the end dialog when agent archives
if (messages.length > 0) {
setShowEndDialog(true);
}
}
}, [messages.length]);

// Handle agent typing indicator
const handleAgentTyping = useCallback(() => {
console.log('[AtlasChat] Agent is typing...');
setIsTyping(true);
// Auto-clear after 3 seconds (agent stopped typing or sent message)
setTimeout(() => setIsTyping(false), 3000);
}, []);

// Connect socket on mount, disconnect on unmount
useEffect(() => {
console.log('[AtlasChat] Initializing socket connection...');
connectSocket(handleAgentReply, handleSessionStatus, handleAgentTyping);

return () => {
console.log('[AtlasChat] Cleaning up socket connection...');
disconnectSocket();
};
}, [handleAgentReply, handleSessionStatus, handleAgentTyping]);

// Polling for human mode - fetch history and sync messages
const pollHistory = useCallback(async () => {
try {
const history = await getHistory();

// Update human mode and archived state
setHumanMode(history.human_mode);

// Check if session is archived (persistent state from backend)
if (history.is_archived) {
setIsArchived(true);
setArchivedMessage('Chatten är avslutad av handläggaren.');
}

// Always sync messages from server - compare by content, not just count
const serverMsgCount = history.messages.length;

if (serverMsgCount !== lastMessageCountRef.current) {
console.log(`[AtlasChat] Message count changed: ${lastMessageCountRef.current} -> ${serverMsgCount}, syncing...`);

// Convert history messages to our format, preserving existing timestamps
setMessages((prevMessages) => {
const newMessages: ChatMessage[] = history.messages.map((msg, index) => {
// Try to find existing message by matching content and role
const existingMsg = prevMessages.find(
(prev, prevIndex) => 
prev.content === msg.content && 
prev.role === mapHistoryRole(msg.role) &&
prevIndex === index
);

return {
id: existingMsg?.id || `history_${index}_${Date.now()}`,
role: mapHistoryRole(msg.role),
content: msg.content,
// Preserve existing timestamp or use current time for new messages
timestamp: existingMsg?.timestamp || new Date(),
};
});

return newMessages;
});

lastMessageCountRef.current = serverMsgCount;

// Stop typing indicator if we got a new message
setIsTyping(false);
}
} catch (error) {
console.error('[AtlasChat] Polling error:', error);
// Don't show error toast for polling failures - silent retry
}
}, []);

// Hydrate initial state from backend once on mount.
// This ensures we detect human_mode even if /message doesn't include it,
// and it also restores any existing conversation on refresh.
useEffect(() => {
pollHistory();
}, [pollHistory]);

// Lightweight polling fallback for human mode only.
// Socket.io is the primary channel, but this catches missed events (network glitches, reconnects).
useEffect(() => {
if (!humanMode || isArchived) return;

const pollInterval = setInterval(() => {
console.log('[AtlasChat] Human mode fallback poll...');
pollHistory();
}, 5000); // Poll every 5 seconds in human mode

return () => clearInterval(pollInterval);
}, [humanMode, isArchived, pollHistory]);


const handleSendMessage = async (content: string, contextData?: { vehicle: string; city: string }) => {
// 1. Bygg context: Prioritera data från snabbknapp (contextData), annars använd sidans val
let messageContext: ChatContext;

if (contextData) {
// Snabbvalet skickade med specifik stad/fordon - ANVÄND DET
messageContext = { 
vehicle: contextData.vehicle as "BIL" | "MC" | "AM" | null, 
...splitCityArea(contextData.city) 
};
} else {
// Använd nuvarande val från fönstret
const cityArea = selectedCity ? splitCityArea(selectedCity) : { city: null, area: null };
messageContext = {
vehicle: selectedVehicle ?? null,
city: cityArea.city,
area: cityArea.area,
};
}

// 2. Lägg till användarens meddelande i listan
const userMessage: ChatMessage = {
id: Date.now().toString(), // Förenklad ID-generering för att undvika beroendefel
role: 'user',
content,
timestamp: new Date(),
};

setMessages((prev) => [...prev, userMessage]);
setIsTyping(true);

try {
// 3. SKICKA TILL SERVER (Korrigerad: Tar bort 'false' som orsakade problem)
const response = await sendMessage(content, messages.length === 0, messageContext);

// 4. Uppdatera context OCH de visuella knapparna om servern ändrat kontext
if (response.locked_context) {
const newV = response.locked_context.vehicle as "BIL" | "MC" | "AM" | null;
const newCity = response.locked_context.city;
const newArea = response.locked_context.area;

// A) Uppdatera intern context-state (för nästa sökning)
setContext({
city: newCity ?? context.city ?? null,
area: newArea ?? context.area ?? null,
vehicle: newV ?? context.vehicle ?? null,
});

// B) SYNK TILL UI: Uppdatera fordonstyp-knappen
if (newV && newV !== selectedVehicle) {
setSelectedVehicle(newV);
window.selectedVehicle = newV; // Synka globalt window-objekt
}

// C) SYNK TILL UI: Uppdatera stads-knappen
if (newCity) {
// Vi återskapar formatet "Stad – Område" så att knappen i UI hittar rätt i CITIES-listan
const uiCityLabel = newArea ? `${newCity} – ${newArea}` : newCity;

if (uiCityLabel !== selectedCity) {
setSelectedCity(uiCityLabel);
window.selectedCity = uiCityLabel;

// UX: En diskret notis som förklarar varför knapparna ändrades
toast.info(`Vi har anpassat dina val till ${uiCityLabel} och ${newV || 'fordon'}.`, {
duration: 3000,
});
}
}
}

// 5. Hantera Human Mode
if (response.human_mode) {
setHumanMode(true);
if (!response.answer || response.answer.trim() === '') {
setIsTyping(false);
return;
}
}

// 6. Lägg till Atlas svar
if (response.answer && response.answer.trim() !== '') {
const assistantMessage: ChatMessage = {
id: (Date.now() + 1).toString(),
role: 'assistant',
content: response.answer,
timestamp: new Date(),
};
setMessages((prev) => [...prev, assistantMessage]);
}
} catch (error) {
console.error('[AtlasChat] Error sending message:', error);
if (!humanMode) {
toast.error("Kunde inte skicka meddelandet. Försök igen.");
}
} finally {
setIsTyping(false);
}
};

const handleReset = () => {
setMessages([]);
setContext({ city: null, area: null, vehicle: null });
setSelectedVehicle(null);
setSelectedCity(null);
setHumanMode(false);
setAgentName(null);
setIsArchived(false);
setClosedByAgent(false);
setArchivedMessage(null);
lastMessageCountRef.current = 0;

// Reset the session id AND ensure the socket joins the new session room.
disconnectSocket();
resetSession();
connectSocket(handleAgentReply, handleSessionStatus);
};

const handleQuickAction = (message: string, contextData?: { vehicle: string; city: string }) => {
if (contextData) {
handleVehicleChange(contextData.vehicle as "BIL" | "MC" | "AM");
handleCityChange(contextData.city);
}
handleSendMessage(message, contextData);
};

const handleEndSession = () => {
// Emit socket event to notify server that customer ended the chat
emitEndChat();
setClosedByAgent(false);

if (messages.length > 0) {
setShowEndDialog(true);
} else {
toast.success("Ärendet har avslutats. Tack för att du kontaktade oss!");
}
};

const handleConfirmEnd = () => {
setShowEndDialog(false);
toast.success("Ärendet har avslutats. Tack för att du kontaktade oss!");
handleReset();
};

const handleRequestHuman = () => {
// Show name input dialog first
setShowNameDialog(true);
};

const handleNameConfirmed = (contactInfo: ContactInfo) => {
setShowNameDialog(false);
setCustomerName(contactInfo.name);
setCustomerEmail(contactInfo.email);
setCustomerPhone(contactInfo.phone || null);

// 🔥 FIX 1: Synka huvud-staten med de definitiva valen från popupen
setSelectedCity(contactInfo.city);
setSelectedVehicle(contactInfo.vehicle);

// Optimistically enter human mode so the UI switches immediately.
setHumanMode(true);

// 🔥 FIX 2: ROUTING-LOGIK: Centralsupport -> null (Inkorg), Annat -> city/area
let routingCity: string | null = null;
let routingArea: string | null = null;

if (contactInfo.city !== "Centralsupport") {
const split = splitCityArea(contactInfo.city);
routingCity = split.city;
routingArea = split.area;
}

const targetAgentId = normalizeForAgent(contactInfo.city); // 🔥 NYTT: Skapar "goteborg_ullevi"

// Build context with customer contact info
const contextWithContact: ChatContext & { 
contact_name?: string; 
contact_email?: string; 
contact_phone?: string;
agent_id?: string; // 🔥 NYTT: Tillåt agent_id i typen
} = {
vehicle: contactInfo.vehicle,
city: routingCity,
area: routingArea,
agent_id: targetAgentId, // 🔥 NYTT: Mappar mot username i atlas.db
contact_name: contactInfo.name,
contact_email: contactInfo.email,
contact_phone: contactInfo.phone,
};

console.log('[AtlasChat] Sending human request with contact info:', contactInfo, contextWithContact);

// Send message with contact info in context
sendMessageWithContext("Jag vill prata med en människa", contextWithContact);
};

// Helper to send message with custom context including contact info
const sendMessageWithContext = async (content: string, contextWithContact: ChatContext & { contact_name?: string; contact_email?: string; contact_phone?: string }) => {
const userMessage: ChatMessage = {
id: generateMessageId(),
role: 'user',
content,
timestamp: new Date(),
};

setMessages((prev) => [...prev, userMessage]);
lastMessageCountRef.current += 1;
setIsTyping(true);

try {
// 🔥 FIX: Tog bort 'true' argumentet här för att matcha klientens funktion
const response = await sendMessage(content, false, contextWithContact);

if (response.locked_context) {
const newV = response.locked_context.vehicle as "BIL" | "MC" | "AM" | null;
const newCity = response.locked_context.city;
const newArea = response.locked_context.area;

// 1. Uppdatera backend-context (för framtida frågor)
setContext({
city: newCity ?? context.city ?? null,
area: newArea ?? context.area ?? null,
vehicle: newV ?? context.vehicle ?? null,
});

// 2. Synka Fordons-knappen visuellt
if (newV && newV !== selectedVehicle) {
setSelectedVehicle(newV);
window.selectedVehicle = newV;
}

// 3. Synka Stads-knappen visuellt (Pusslar ihop "Stad – Område")
if (newCity) {
const uiCityLabel = newArea ? `${newCity} – ${newArea}` : newCity;
if (uiCityLabel !== selectedCity) {
setSelectedCity(uiCityLabel);
window.selectedCity = uiCityLabel;
}
}
}

if (response.human_mode) {
setHumanMode(true);
if (!response.answer || response.answer.trim() === '') {
setIsTyping(false);
return;
}
}

if (response.answer && response.answer.trim() !== '') {
const assistantMessage: ChatMessage = {
id: generateMessageId(),
role: 'assistant',
content: response.answer,
timestamp: new Date(),
};
setMessages((prev) => [...prev, assistantMessage]);
lastMessageCountRef.current += 1;
}
} catch (error) {
console.error('[AtlasChat] Error sending message:', error);
} finally {
setIsTyping(false);
}
};

const handleToggleTheme = () => {
setIsDark(prev => !prev);
};

const showWelcome = messages.length === 0 && !isTyping;

return (
<div className={`flex flex-col h-full bg-chat-bg ${isDark ? 'dark' : ''}`}>
<ChatHeader 
onReset={messages.length > 0 ? handleReset : undefined}
onEndSession={handleEndSession}
onRequestHuman={handleRequestHuman}
isDark={isDark}
onToggleTheme={handleToggleTheme}
// 🔥 FIX 3: Dina två rader här
selectedCity={selectedCity}
selectedVehicle={selectedVehicle}
/>

{/* Human mode indicator */}
{humanMode && !isArchived && <HumanModeIndicator agentName={agentName} />}

{/* Archived indicator */}
{isArchived && (
<div className="bg-muted/80 border-b border-border px-4 py-3 text-center">
<div className="flex items-center justify-center gap-2 text-muted-foreground">
<svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
</svg>
<span className="font-medium">{archivedMessage || 'Chatten är avslutad av handläggaren.'}</span>
</div>
</div>
)}

{/* Messages area */}
<div ref={scrollContainerRef} className="flex-1 overflow-y-auto chat-scrollbar px-4 py-4">
{showWelcome ? (
<WelcomeMessage 
onQuickAction={handleQuickAction}
selectedVehicle={selectedVehicle}
selectedCity={selectedCity}
onVehicleChange={handleVehicleChange}
onCityChange={handleCityChange}
/>
) : (
<div className="flex flex-col gap-3">
{messages.map((message, index) => (
<ChatBubble
key={message.id}
content={message.content}
isUser={message.role === 'user'}
timestamp={message.timestamp}
isLatest={index === messages.length - 1}
/>
))}
{isTyping && <TypingIndicator />}
<div ref={messagesEndRef} />
</div>
)}
</div>
{/* Context indicator - interactive */}
<ContextIndicator 
context={context}
onUpdateContext={(updates) => {
// 1. Uppdatera Huvud-Context (Backend)
setContext(prev => ({ ...prev, ...updates }));

// 2. Uppdatera UI-State (Knapparna/ChatInput) - DETTA SAKNADES
if (updates.vehicle !== undefined) {
const v = updates.vehicle as "BIL" | "MC" | "AM" | null;
setSelectedVehicle(v); // <--- Kritiskt för att knapparna ska uppdateras
window.selectedVehicle = v;
}

if (updates.city !== undefined) {
const c = updates.city as string | null;
setSelectedCity(c); // <--- Kritiskt för att stadsvalet ska uppdateras
window.selectedCity = c;
}
}}
/>
{/* Input - disabled when archived */}
{isArchived ? (
<div className="px-4 py-4 border-t border-border bg-muted/50">
<p className="text-sm text-muted-foreground text-center">Denna konversation är avslutad.</p>
</div>
) : (
<ChatInput 
onSend={handleSendMessage} 
disabled={isTyping}
placeholder={humanMode ? "Skriv till support..." : "Skriv ett meddelande..."}
showQuickQuestions={messages.length > 0}
selectedVehicle={selectedVehicle}
onVehicleChange={handleVehicleChange} // 🔥 KOPPLA IHOP SYNK
onCityChange={handleCityChange}       // 🔥 KOPPLA IHOP SYNK
selectedCity={selectedCity}
/>
)}

{/* End Session Dialog */}
<EndSessionDialog
open={showEndDialog}
onOpenChange={setShowEndDialog}
messages={messages}
onConfirm={handleConfirmEnd}
closedByAgent={closedByAgent}
/>

{/* Name Input Dialog for Human Mode */}
<NameInputDialog
open={showNameDialog}
onOpenChange={setShowNameDialog}
onConfirm={handleNameConfirmed}
// 🔥 FIX 4: Skicka med nuvarande val som förval
defaultCity={selectedCity}
defaultVehicle={selectedVehicle}
/>
</div>
);
}
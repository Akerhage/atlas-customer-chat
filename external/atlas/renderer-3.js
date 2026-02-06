/* ═══════════════════════════════════════════════════════════════
ATLAS RENDERER v2.8 (Ngrok & Inbox Fix)
Hanterar: Chatt, Mallar (SQLite), Inkorg (SQLite) & Inställningar
═══════════════════════════════════════════════════════════════ */

// =============================================================================
// 🔒 SECURITY INTERCEPTOR (Måste ligga först i filen)
// =============================================================================
const originalFetch = window.fetch;

// Skriv över standard-fetch för att fånga 401 (Utloggad) globalt
window.fetch = async (...args) => {
try {
const response = await originalFetch(...args);

// Om servern säger "Unauthorized" (401), logga ut direkt
if (response.status === 401) {
console.warn("⛔ 401 Unauthorized detekterat - Tvingar utloggning...");
handleLogout(); 
return response;
}

return response;
} catch (err) {
throw err;
}
};

const isElectron = (typeof window.electronAPI !== 'undefined');

// ==========================================================
// === 1. NÄTVERK & MILJÖKONFIGURATION ===
// ==========================================================

// DIN NGROK-ADRESS (Uppdaterad för webb-åtkomst)
const NGROK_HOST = "https://uncongestive-roberta-unsurely.ngrok-free.dev";

// Välj URL: Localhost för Electron, Ngrok för Webb/Mobil
const SERVER_URL = isElectron ? 'http://localhost:3001' : NGROK_HOST;

console.log(`🌍 Miljö: ${isElectron ? 'ELECTRON' : 'WEBB'}`);
console.log(`🔗 Server URL: ${SERVER_URL}`);

// === 2. AUTHENTICATION & LOGIN UI ===
const loginModalHTML = `
<div id="login-modal" style="display:none; position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.85); z-index:9999; justify-content:center; align-items:center;">
<div style="background:var(--bg-secondary); padding:40px; border-radius:12px; width:350px; text-align:center; box-shadow:0 10px 30px rgba(0,0,0,0.5);">
<h2 style="margin-bottom:20px; color:var(--text-primary);">Atlas Login</h2>
<form id="login-form" style="display:flex; flex-direction:column; gap:15px;">
<input type="text" id="login-user" placeholder="Användarnamn" required style="padding:12px; border-radius:6px; border:1px solid #444; background:var(--bg-primary); color:white;">
<input type="password" id="login-pass" placeholder="Lösenord" required style="padding:12px; border-radius:6px; border:1px solid #444; background:var(--bg-primary); color:white;">
<button type="submit" style="padding:12px; border-radius:6px; border:none; background:var(--accent-color); color:white; font-weight:bold; cursor:pointer;">Logga in</button>
</form>
<p id="login-error" style="color:#ff6b6b; margin-top:15px; font-size:13px; min-height:18px;"></p>
</div>
</div>
`;

// Ladda sparad token
let authToken = localStorage.getItem('atlas_token');
let currentUser = JSON.parse(localStorage.getItem('atlas_user') || 'null');

// Headers för fetch-anrop (inkluderar Ngrok-bypass)
const fetchHeaders = {
'Authorization': `Bearer ${authToken}`,
'Content-Type': 'application/json',
'ngrok-skip-browser-warning': 'true'
};

// Hjälpfunktion: Avkoda JWT för att se utgångsdatum
function parseJwt(token) {
try {
const base64Url = token.split('.')[1];
const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
const jsonPayload = decodeURIComponent(window.atob(base64).split('').map(function(c) {
return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
}).join(''));
return JSON.parse(jsonPayload);
} catch (e) { return null; }
}

// Uppdatera Sidebar-profilen (Namn, Initial, Grön prick)
function updateProfileUI() {
const container = document.getElementById('user-profile-container');
const loginBtn = document.getElementById('login-btn-sidebar');
const nameEl = document.getElementById('current-user-name');
const initialEl = document.querySelector('.user-initial');

if (authToken && currentUser) {
// Visa profil, dölj login-knapp
if (container) container.style.display = 'flex';
if (loginBtn) loginBtn.style.display = 'none';

// Sätt namn och initial
const username = currentUser.username || 'Agent';
if (nameEl) nameEl.textContent = username.charAt(0).toUpperCase() + username.slice(1);
if (initialEl) initialEl.textContent = username.charAt(0).toUpperCase();
} else {
// Dölj profil, visa login-knapp
if (container) container.style.display = 'none';
if (loginBtn) loginBtn.style.display = 'flex';
}
}

function checkAuth() {
// 1. Finns ingen token? Visa modal.
if (!authToken) {
const modal = document.getElementById('login-modal');
if(modal) modal.style.display = 'flex';
updateProfileUI(); // Döljer profilen
return false;
}

// 2. Har token gått ut?
const decoded = parseJwt(authToken);
if (decoded && decoded.exp) {
const now = Math.floor(Date.now() / 1000);
if (decoded.exp < now) {
console.warn("⚠️ Token har gått ut. Loggar ut...");
handleLogout();
return false;
}

// Sätt timer för auto-logout
const timeUntilExpiry = (decoded.exp * 1000) - Date.now();
if (timeUntilExpiry > 0) {
setTimeout(() => {
alert("Sessionen har gått ut.");
handleLogout();
}, timeUntilExpiry);
}
}

// 3. Allt ok - Uppdatera UI
updateProfileUI();
return true;
}

function handleLogout() {
console.log("🚪 Loggar ut...");
localStorage.removeItem('atlas_token');
localStorage.removeItem('atlas_user');
// Vi laddar om sidan för att nollställa allt (socket, state, minne)
location.reload(); 
}

// === SOCKET.IO SETUP (NGROK) ===
let socket = null;

// Dummy-objekt för att förhindra krasch innan socket laddats
window.socketAPI = {
isConnected: () => false,
emit: () => console.warn("Socket not ready yet"),
on: () => {}
};

function initializeSocket() {
if (typeof io === 'undefined' || !authToken) return;

console.log("🔌 Initializing Socket.io connection...");

// ExtraHeaders låser upp Ngrok för webbsockets
socket = io(SERVER_URL, {
auth: { token: authToken },
extraHeaders: {
"ngrok-skip-browser-warning": "true"
},
reconnection: true,
reconnectionAttempts: 10
});

// Koppla upp det globala API:et
window.socketAPI = {
isConnected: () => socket && socket.connected,
emit: (event, data) => socket && socket.emit(event, data),
on: (event, cb) => socket && socket.on(event, cb)
};

socket.on('connect', () => {
console.log("🟢 Socket connected!");
updateServerStatusUI(true);
});

socket.on('disconnect', () => {
console.warn("🔴 Socket disconnected");
updateServerStatusUI(false);
});

socket.on('connect_error', (err) => {
console.error("❌ Socket Connect Error:", err.message);
if (err.message.includes("Authentication error")) {
handleLogout(); 
}
});

// Aktivera lyssnare för chatt och events
setupSocketListeners();
}

function updateServerStatusUI(connected) {
const statusEl = document.getElementById('server-status');
if (statusEl) {
statusEl.textContent = connected ? "🟢 LIVE" : "🔴 Frånkopplad";
statusEl.style.color = connected ? "#4cd137" : "#ff6b6b";
}
}

// === DYNAMISK SOCKET-LADDNING (RETRY LOGIK) ===

async function loadSocketIoScriptWithRetry(retries = 30) {
const scriptUrl = `${SERVER_URL}/socket.io/socket.io.js`;

for (let i = 0; i < retries; i++) {
try {
// Försök nå servern med HEAD-anrop (inkluderar headers för Ngrok)
const res = await fetch(scriptUrl, { 
method: 'HEAD',
headers: { 'ngrok-skip-browser-warning': 'true' }
});

if (res.ok) {
console.log("✅ Servern svarar! Laddar socket-script...");
const script = document.createElement('script');
script.src = scriptUrl;
script.onload = () => initializeSocket();
script.onerror = () => {
// Fallback till CDN om lokala scriptet failar
console.warn("⚠️ Lokalt script failade, testar CDN...");
const cdn = document.createElement('script');
cdn.src = "https://cdn.socket.io/4.7.2/socket.io.min.js";
cdn.onload = () => initializeSocket();
document.head.appendChild(cdn);
};
document.head.appendChild(script);
return;
}
} catch (err) {
// Servern startar upp... uppdatera UI
const statusEl = document.getElementById('server-status');
if (statusEl) {
statusEl.textContent = `⏳ Startar servern... (${Math.round((i/retries)*100)}%)`;
statusEl.style.color = "orange";
}
}
await new Promise(r => setTimeout(r, 1000));
}

console.error("❌ Server Timeout.");
addBubble("⚠️ Kunde inte ansluta till servern. Kontrollera att den är igång.", 'atlas');
}

// Starta laddningen
if (typeof io === 'undefined') {
loadSocketIoScriptWithRetry();
} else {
initializeSocket();
}

// ==========================================================
// SOCKET-LYSSNARE / EVENTS
// ==========================================================
function setupSocketListeners() {
if (!window.socketAPI) return;

// Svar från Atlas (Bot)
window.socketAPI.on('server:answer', (data) => {
console.log("📥 Mottog svar:", data);

// Visa svaret i chatten
addBubble(data.answer, 'atlas');

// Uppdatera sessionens state
if (State.currentSession) {
State.currentSession.add('atlas', data.answer);
State.currentSession.isFirstMsg = false;

if (data.locked_context) {
State.currentSession.context.locked_context = data.locked_context;
}
saveLocalQA(State.currentSession); 
}
});

// Versionsinfo
window.socketAPI.on('server:info', (data) => {
if (DOM.serverVersion) DOM.serverVersion.textContent = data.version;
});

// Felmeddelanden
window.socketAPI.on('server:error', (err) => {
addBubble(`⚠️ Serverfel: ${err.message}`, 'atlas');
});

// Team Uppdateringar (Inkorg/Kö)
window.socketAPI.on('team:update', (evt) => {
updateInboxBadge();

// Uppdatera Inkorgen om den är öppen
if (DOM.views.inbox && DOM.views.inbox.style.display === 'flex' && State.inboxMode === 'team') {
renderInbox();
}

// 🔥 NYTT: Uppdatera även listan i "Mina Ärenden" om den är öppen
// Detta gör att texten "Hej, jag är en levande..." syns i vänsterspalten direkt
if (DOM.views['my-tickets'] && DOM.views['my-tickets'].style.display === 'flex') {
renderMyTickets();
}
});

// ===============================
// MINI-CHAT – KUND SVARAR LIVE (FIXAD)
// ===============================
const appendCustomerMessageToMyTicketChat = (data) => {
  const conversationId = data?.conversationId || data?.sessionId || data?.conversation_id;
  const message = data?.message || data?.content;

  const detail = document.getElementById('my-ticket-detail');
  const activeId = detail?.getAttribute('data-current-id');

  // Om vi inte är inne på rätt ärende, gör inget
  if (!conversationId || conversationId !== activeId) return;

  // Om kunden avslutar chatten ska svarsrutan låsas direkt (utan att man behöver klicka om ärendet)
  const isEndMessage =
    data?.type === 'system_info' ||
    (typeof message === 'string' && message.includes('Kunden har avslutat chatten'));

  if (isEndMessage) {
    const input = document.getElementById('my-chat-input');
    const form = document.getElementById('my-chat-input-form');
    const btn = form?.querySelector('button[type="submit"]');

    if (input) {
      input.disabled = true;
      input.placeholder = 'Kunden har avslutat chatten';
      input.style.cursor = 'not-allowed';
      input.style.opacity = '0.7';
    }

    if (btn) {
      btn.disabled = true;
      btn.style.cursor = 'not-allowed';
      btn.style.opacity = '0.5';
    }
  }

  // 🔥 HÄR VAR FIXEN: Vi hämtar elementet dynamiskt istället för via DOM-cachen
  const chatContainer = document.getElementById('my-chat-scroll-area');

  if (chatContainer && message) {
    const wrapper = document.createElement('div');
    wrapper.className = 'message user'; // Kund = Vänster (Grå)

    const bubble = document.createElement('div');
    bubble.className = 'bubble';
    bubble.innerHTML = formatAtlasMessage(message);

    wrapper.appendChild(bubble);
    chatContainer.appendChild(wrapper);

    // Scrolla ner så man ser det nya meddelandet
    chatContainer.scrollTop = chatContainer.scrollHeight;
  }
};

// Standard-event
window.socketAPI.on('team:customer_reply', appendCustomerMessageToMyTicketChat);
// Bakåtkompatibilitet (server kan skicka detta i vissa flöden)
window.socketAPI.on('team:customer_message', appendCustomerMessageToMyTicketChat);

// ===============================
// KUNDEN SKRIVER (BEHÅLL DENNA!)
// ===============================
let typingTimer = null;
window.socketAPI.on('team:client_typing', (data) => {
const { sessionId } = data;

// 1. Kolla om vi har detta ärende öppet i "Mina Ärenden"
const indicator = document.getElementById(`typing-indicator-${sessionId}`);

if (indicator) {
indicator.style.display = 'block';

// Scrolla ner lite snyggt
const scrollArea = document.getElementById('my-chat-scroll-area');
if (scrollArea) scrollArea.scrollTop = scrollArea.scrollHeight;

// Dölj efter 3 sekunder om ingen ny signal kommer
if (typingTimer) clearTimeout(typingTimer);
typingTimer = setTimeout(() => {
indicator.style.display = 'none';
}, 3000);
}
});

} // 👈 HÄR ÄR SLUTET PÅ setupSocketListeners

// ==========================================================
// === 1. GLOBALA INSTÄLLNINGAR & STATE ===
// ==========================================================
let API_KEY = null;
const API_URL = `${SERVER_URL}/search_all`;

// State Containers
const State = {
currentSession: null,
inboxMode: 'team', 
templates: [],
localQA: [],
teamTickets: [],
archiveItems: []
};

// Quill Editor Instance
let quill = null;
let isLoadingTemplate = false;

// === 2. DOM ELEMENT CACHE (För prestanda) ===
const DOM = {
views: {
chat: document.getElementById('view-chat'),
templates: document.getElementById('view-templates'),
inbox: document.getElementById('view-inbox'),
'my-tickets': document.getElementById('view-my-tickets'), // NY!
archive: document.getElementById('view-archive'),
settings: document.getElementById('view-settings')
},
menuItems: document.querySelectorAll('.menu-item'),

// Chatt
chatMessages: document.getElementById('chat-messages'),
messageInput: document.getElementById('message-input'),
chatForm: document.getElementById('chat-form'),
appName: document.getElementById('app-name-display'),

// Mina ärenden – mini-chat
myTicketChatForm: document.getElementById('my-ticket-chat-form'),
myTicketChatInput: document.getElementById('my-ticket-message-input'),
myTicketChatMessages: document.getElementById('my-ticket-chat-messages'),


// Mallar
templateList: document.getElementById('template-list'),
templateSearch: document.getElementById('template-search'),
editorForm: document.getElementById('template-editor-form'),
editorPlaceholder: document.getElementById('editor-placeholder'),
inputs: {
id: document.getElementById('template-id-input'),
title: document.getElementById('template-title-input'),
group: document.getElementById('template-group-input'),
content: document.getElementById('template-content-input')
},

// Inkorg
inboxList: document.getElementById('inbox-list'),
inboxDetail: document.getElementById('inbox-detail'),
inboxPlaceholder: document.getElementById('inbox-placeholder'),
inboxQuestion: document.getElementById('inbox-question'),
inboxAnswer: document.getElementById('inbox-answer'),

// Inställningar
themeSelect: document.getElementById('theme-select'),
themeStylesheet: document.getElementById('theme-stylesheet'),
appVersion: document.getElementById('app-version-display'),
serverVersion: document.getElementById('server-version-display'),
serverStatus: document.getElementById('server-status')
};

// ==========================================================
// 3. CHATT MOTOR (Session & Logic)
// ==========================================================
class ChatSession {
constructor() {
// 🔥 FIX: Lägg till unik random-del för att undvika kollisioner
this.id = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
this.messages = [];
this.startTime = new Date();

// 👈 KRITISK FIX: HEM-vyn är ALLTID privat
this.session_type = 'private'; 

this.context = {
locked_context: {
city: null,
area: null,
vehicle: null
},
linksSentByVehicle: {
AM: false,
MC: false,
CAR: false,
INTRO: false,
RISK1: false,
RISK2: false
}
};

this.isFirstMsg = true;
}

add(role, text) {
this.messages.push({ role, text, timestamp: new Date() });
}

getContextHistory() {
return this.messages.map(m => ({ 
role: m.role, 
content: m.text 
})).slice(-10); // Skicka bara sista 10 för context window
}

getFullText() {
return this.messages.map(m => 
`${m.role === 'user' ? 'Användare' : 'Atlas'}: ${m.text}`
).join('\n\n');
}
}

// ==========================================================
// ⚠️ VIKTIGT – INTRO-BUBBLA ÄGS AV index.html
// Renderer.js får ALDRIG skapa första Atlas-meddelandet.
// isFirstMsg sätts därför till false här medvetet.
// Ändra INTE detta utan att även uppdatera index.html + server-flödet.
// ==========================================================

function initChat(skipSave = false) {
// FIX: Spara BARA om vi inte bett om att hoppa över (t.ex. vid arkivering)
if (!skipSave && State.currentSession && State.currentSession.messages.length > 0) {
saveLocalQA(State.currentSession);
}

State.currentSession = new ChatSession();

// ✅ FIX: Tog bort hårdkodad 'style'. Nu följer den temat (Space/Nebula/Light)!
// Vi använder <i> för kursiv stil för att markera att det är systeminfo.
DOM.chatMessages.innerHTML = `
<div class="message atlas">
<div class="bubble">
<h3>🔒 Privat för dig endast</h3>
<p><i>
<br>
Här kan du testa frågor mot Atlas AI utan att det loggas som kundärenden.<br>
Dessa "ärenden" loggas i Garaget sen endast för dig.
</i></p>
</div>
</div>
`;

State.currentSession.isFirstMsg = false;
console.log('[CHAT] Ny session startad (Privat):', State.currentSession.id);
}

async function handleUserMessage(text) {
if (!text.trim()) return;

// 1. UI Update (Visa användarens meddelande direkt)
State.currentSession.add('user', text);
addBubble(text, 'user');
DOM.messageInput.value = '';

// 2. Skicka via Socket.IO
if (window.socketAPI && window.socketAPI.isConnected()) {
try {
const payload = {
query: text,
sessionId: State.currentSession.id,
isFirstMessage: State.currentSession.isFirstMsg,
session_type: State.currentSession.session_type, // 👈 KRITISK FIX: Skicka typen till servern
context: State.currentSession.context
};

// Om detta är första meddelandet och vi är inloggade, tagga som "mitt"
if (State.currentSession.isFirstMsg && currentUser) {
window.socketAPI.emit('team:assign_self', { 
sessionId: State.currentSession.id, 
agentName: currentUser.username 
});
}

// Skicka iväg - svaret hanteras asynkront i 'server:answer'-lyssnaren
window.socketAPI.emit('client:message', payload);

} catch (err) {
console.error(err);
addBubble(`⚠️ Kunde inte skicka via socket: ${err.message}`, 'atlas');
}
} else {
addBubble("⚠️ Ingen anslutning till servern.", 'atlas');
console.error("Socket not connected.");
}
}

function addBubble(text, role) {
const wrapper = document.createElement('div');
wrapper.className = `message ${role}`;

const bubble = document.createElement('div');
bubble.className = 'bubble';

// Markdown-lite parsing
let html = text
.replace(/\*\*(.*?)\*\*/g, '<b>$1</b>')
.replace(/\n/g, '<br>')
.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" class="atlas-link">$1</a>');

bubble.innerHTML = html;
wrapper.appendChild(bubble);
DOM.chatMessages.appendChild(wrapper);
DOM.chatMessages.scrollTop = DOM.chatMessages.scrollHeight;
}

// ==========================================================
// 4. UNIFIED INBOX (Local + Team) - KORRIGERAD VERSION
// ==========================================================
function renderInbox() {
DOM.inboxList.innerHTML = '';

// 1. Skapa Flik-kontroller
const controls = document.createElement('div');
controls.className = 'inbox-mode-controls';
controls.innerHTML = `
<button id="tab-local" class="inbox-mode-btn ${State.inboxMode === 'local' ? 'active' : ''}">Meddelanden</button>
<button id="tab-team" class="inbox-mode-btn ${State.inboxMode === 'team' ? 'active' : ''}">Team Kö (Live)</button>
`;
DOM.inboxList.appendChild(controls);

// Klick-handlers
document.getElementById('tab-local').onclick = () => { State.inboxMode = 'local'; renderInbox(); };
document.getElementById('tab-team').onclick = () => { State.inboxMode = 'team'; renderInbox(); };

// 2. Innehållscontainer
const listContainer = document.createElement('div');
listContainer.className = 'inbox-content-list';
DOM.inboxList.appendChild(listContainer);

// 3. Rendera vald vy (Båda hämtar nu från servern, men med olika filter)
if (State.inboxMode === 'local') {
// Visa endast formulär/meddelanden
renderTeamQueue(listContainer, 'message'); 
} else {
// Visa endast live-chattar
renderTeamQueue(listContainer, 'customer');
}
}

// ============================================================================
// MINA ÄRENDEN: LISTA (Samma design som Inkorgen)
// ============================================================================
async function renderMyTickets() {
const container = document.getElementById('my-tickets-list');
if (!container) return;

container.innerHTML = '<div class="template-item-empty">Laddar dina ärenden...</div>';

try {
const res = await fetch(`${SERVER_URL}/team/my-tickets`, { headers: fetchHeaders });
if (!res.ok) throw new Error("Kunde inte hämta ärenden");

const data = await res.json();
const tickets = data.tickets || [];

container.innerHTML = '';

if (tickets.length === 0) {
container.innerHTML = `
<div class="template-item-empty" style="padding:40px; text-align:center; opacity:0.6;">
<div style="font-size:40px; margin-bottom:10px;">☕</div>
<div>Du har inga pågående ärenden.</div>
</div>`;
return;
}

// Sortera på tid (Nyast överst)
tickets.sort((a, b) => b.updated_at - a.updated_at);

tickets.forEach(t => {
const isMine = true; // Detta ÄR ju mina ärenden
const shortId = t.conversation_id.replace('session_', '').substring(0, 6);

// Rubrik Prioritera: Namn -> Ämne -> ID
let displayTitle = t.contact_name || t.subject || `Ärende #${shortId}`;

// Tid
const timeStr = new Date(t.updated_at * 1000).toLocaleTimeString('sv-SE', {
hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'numeric'
});

// Taggar & Klasser
const tagText = t.session_type === 'message' ? 'MAIL' : 'CHATT';
// Här sätter vi din egen agent-färg eftersom det är ditt ärende
const agentClass = `agent-${currentUser.username.toLowerCase().replace(/[^a-z]/g, '')}`; 

const card = document.createElement('div');
card.className = `team-ticket-card ${agentClass} mine`; // 'mine' kan användas för extra styling om man vill
card.style.cursor = 'pointer';

// Ikon: Pilen (Öppna)
const actionIcon = '➜';
const actionClass = 'btn-open';

card.innerHTML = `
<div class="ticket-row top">
<span class="ticket-title">${displayTitle}</span>
<button class="mini-action-btn ${actionClass}" title="Öppna ärende">${actionIcon}</button>
</div>

<div class="ticket-row mid">
<span class="ticket-preview">${t.last_message ? t.last_message.substring(0, 60) : '...'}</span>
</div>

<div class="ticket-row bot">
<span class="ticket-tag tag-dynamic ${agentClass}">${tagText}</span>
<span class="ticket-time">${timeStr}</span>
</div>
`;

card.onclick = () => openMyTicketDetail(t);
container.appendChild(card);
});

} catch (err) {
console.error("Mina ärenden fel:", err);
container.innerHTML = '<div class="template-item-empty" style="color:#ff6b6b">Kunde inte ladda listan.</div>';
}
}

// ============================================================================
// MINA ÄRENDEN: DETALJVY (MED FIXAD TYPING INDICATOR)
// ============================================================================
function openMyTicketDetail(ticket) {
const detail = document.getElementById('my-ticket-detail');
const placeholder = document.getElementById('my-detail-placeholder');

if (!detail || !placeholder) return;

placeholder.style.display = 'none';
detail.style.display = 'flex';
detail.setAttribute('data-current-id', ticket.conversation_id);

// Agent-färg
const currentUser = window.currentUser || { username: 'Agent' }; // Fallback
const agentClass = `agent-${currentUser.username.toLowerCase().replace(/[^a-z]/g, '')}`;
detail.className = `template-editor-container ${agentClass}`;
detail.innerHTML = ''; // Rensa

const subject = ticket.subject || `Ärende #${ticket.conversation_id.substring(0, 6)}`;
const dateStr = new Date(ticket.updated_at * 1000).toLocaleString();
const isMail = ticket.session_type === 'message';

// Kunden kan avsluta chatten utan att ärendet "arkiveras" i DB.
// Vi låser därför svarsrutan även om en systemrad finns i historiken.
const hasCustomerEnded = (ticket.messages || []).some((m) => {
  const text = String((m && (m.content || m.text)) || '');
  return (m?.role === 'system' || m?.sender === 'System') && text.includes('Kunden har avslutat chatten');
});

const isChatClosed = Boolean(ticket.is_archived) || hasCustomerEnded;

// 1. Förbered Mall-options
let templateOptions = `<option value="">📋 Välj mall att kopiera...</option>`;
if (State.templates && State.templates.length > 0) {
State.templates.forEach(t => {
templateOptions += `<option value="${t.id}">${t.title}</option>`;
});
}

// 2. Förbered Innehåll
let bodyContent = '';

if (isMail) {
// --- MAIL-LÄGE ---
const msgBody = (ticket.messages && ticket.messages.length > 0) 
? ticket.messages[0].content 
: ticket.last_message;

let senderInfo = '';
if (ticket.contact_email) {
senderInfo = `
<div class="msg-sender" style="margin-top:10px;">
✉️ ${ticket.contact_email} 
${ticket.contact_name ? `(${ticket.contact_name})` : ''}
${ticket.contact_phone ? `📞 ${ticket.contact_phone}` : ''}
</div>`;
}

bodyContent = `
<div class="detail-message-box">
<div class="msg-label">INKOMMANDE MEDDELANDE:</div>
<div class="msg-content">${formatAtlasMessage(msgBody)}</div>
${senderInfo}
</div>
`;
} else {
// --- CHATT-LÄGE ---

// A. Först bubblorna
bodyContent = `<div class="my-chat-scroll-area" id="my-chat-scroll-area">`;
const messages = ticket.messages || [];
messages.forEach(m => {
const role = m.role === 'user' ? 'user' : 'atlas'; 
bodyContent += `
<div class="message ${role}">
<div class="bubble">${formatAtlasMessage(m.text || m.content)}</div>
</div>`;
});
bodyContent += `</div>`;

// B. Sen Typing Indicator (Längst ner, ovanför input)
// Detta placerar den vid din GRÖNA PIL
bodyContent += `
<div id="typing-indicator-${ticket.conversation_id}" 
style="display:none; padding:5px 15px; font-size:12px; color:#00ff88; font-style:italic; margin-top:5px;">
✍️ Kunden skriver...
</div>`;
}

// 3. Bygg HTML
const content = document.createElement('div');
content.className = 'detail-container';

content.innerHTML = `
<div class="detail-header-top">
<div class="detail-title-box">
<h2 class="detail-subject">${subject}</h2>
<span class="detail-meta">Status: Pågående &bull; ${dateStr}</span>
</div>
</div>

<div class="detail-body" id="my-ticket-body" style="display:flex; flex-direction:column; height:100%;">
${bodyContent}
</div>

${!isMail ? `
<form id="my-chat-input-form" style="display:flex; gap:10px; padding:10px 0; border-top:1px solid rgba(255,255,255,0.1);">
<input type="text" id="my-chat-input" autocomplete="off" placeholder="${isChatClosed ? 'Kunden har avslutat chatten' : 'Skriv ett svar...'}" ${isChatClosed ? 'disabled' : ''} style="flex:1; padding:10px; border-radius:8px; border:1px solid rgba(255,255,255,0.1); background:rgba(0,0,0,${isChatClosed ? '0.4' : '0.2'}); color:${isChatClosed ? '#888' : 'white'}; ${isChatClosed ? 'cursor:not-allowed;' : ''}">
<button type="submit" class="header-button" ${isChatClosed ? 'disabled' : ''} style="padding:0 15px; ${isChatClosed ? 'opacity:0.5; cursor:not-allowed;' : ''}">Sänd</button>
</form>
` : ''}

<div class="detail-footer-toolbar" style="justify-content: space-between;">
<div class="footer-left" style="flex:1; max-width: 50%;">
<select id="quick-template-select" style="width:100%;">${templateOptions}</select>
</div>
<div class="footer-right">
${isMail ? `<button class="footer-icon-btn" id="btn-reply-mail" title="Svara med E-post">📧</button>` : ''}
<button class="footer-icon-btn" id="btn-archive-my" title="Arkivera ärende">📦</button>
<button class="footer-icon-btn danger" id="btn-delete-my" title="Ta bort permanent">❌</button>
</div>
</div>
`;

detail.appendChild(content);

// --- SCROLLA NER START ---
if (!isMail) {
const scrollArea = document.getElementById('my-chat-scroll-area');
if (scrollArea) scrollArea.scrollTop = scrollArea.scrollHeight;
}

// --- LOGIK ---

// 1. MALL-VÄLJARE
const templateSelect = document.getElementById('quick-template-select');
if (templateSelect) {
templateSelect.onchange = () => {
const tId = templateSelect.value;
if (!tId) return;

const template = State.templates.find(t => t.id == tId);
if (template) {
const tempDiv = document.createElement("div");
tempDiv.innerHTML = template.content;
const plainText = tempDiv.textContent || tempDiv.innerText || "";

if (!isMail) {
const input = document.getElementById('my-chat-input');
if (input) {
input.value = plainText;
input.focus();
}
} else {
navigator.clipboard.writeText(plainText);
const originalText = templateSelect.options[templateSelect.selectedIndex].text;
templateSelect.options[templateSelect.selectedIndex].text = "✅ Kopierat!";
setTimeout(() => {
templateSelect.options[templateSelect.selectedIndex].text = originalText;
templateSelect.value = "";
}, 2000);
}
}
};
}

// 2. CHATT-SUBMIT & AGENT TYPING (RÖDA PILEN)
if (!isMail) {
const chatForm = document.getElementById('my-chat-input-form');
const chatInput = document.getElementById('my-chat-input');

// A. Skicka "Agent skriver..."
let lastAgentTypingTime = 0;
if (chatInput) {
chatInput.addEventListener('input', () => {
const now = Date.now();
if (now - lastAgentTypingTime > 2000) {
console.log("📤 Skickar: Agent skriver..."); // DEBUG
window.socketAPI.emit('team:agent_typing', { 
sessionId: ticket.conversation_id 
});
lastAgentTypingTime = now;
}
});
}

// B. Skicka meddelande
if (chatForm) {
chatForm.onsubmit = async (e) => {
e.preventDefault();
const msg = chatInput.value.trim();
if (!msg) return;

// Skicka till server
window.socketAPI.emit('team:agent_reply', {
conversationId: ticket.conversation_id,
message: msg
});

// Optimistisk UI-uppdatering
const scrollContainer = document.getElementById('my-chat-scroll-area');
if (scrollContainer) {
const wrapper = document.createElement('div');
wrapper.className = 'message atlas'; 
const bubble = document.createElement('div');
bubble.className = 'bubble';
bubble.innerHTML = formatAtlasMessage(msg);
wrapper.appendChild(bubble);
scrollContainer.appendChild(wrapper);
scrollContainer.scrollTop = scrollContainer.scrollHeight;
}

setTimeout(() => renderMyTickets(), 300);
chatInput.value = '';
};
}
}

// 3. KNAPPAR
if (isMail) {
const mailBtn = document.getElementById('btn-reply-mail');
if(mailBtn) mailBtn.onclick = () => handleEmailReply(ticket);
}

const archiveBtn = document.getElementById('btn-archive-my');
if(archiveBtn) archiveBtn.onclick = () => {
if (isMail) archiveWithRequiredNote(ticket);
else archiveTicketFromMyTickets(ticket.conversation_id);
};

const deleteBtn = document.getElementById('btn-delete-my');
if(deleteBtn) deleteBtn.onclick = async () => {
if (await atlasConfirm('Ta bort', 'Är du säker? Detta raderar ärendet helt.')) {
await fetch(`${SERVER_URL}/api/inbox/delete`, {
method: 'POST', headers: fetchHeaders,
body: JSON.stringify({ conversationId: ticket.conversation_id })
});
renderMyTickets();
detail.style.display = 'none'; 
placeholder.style.display = 'flex';
}
};
}

// ============================================================================
// FIX: Ersättare för window.prompt (Eftersom Electron blockerar originalet)
// ============================================================================
function atlasPrompt(title, message) {
return new Promise((resolve) => {
let modal = document.getElementById('atlas-prompt-modal');
if (!modal) {
modal = document.createElement('div');
modal.id = 'atlas-prompt-modal';
modal.style.cssText = "display:none; position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.85); z-index:10000; justify-content:center; align-items:center;";
modal.innerHTML = `
<div style="background:var(--bg-secondary, #2d2d2d); padding:25px; border-radius:12px; width:400px; box-shadow:0 10px 30px rgba(0,0,0,0.5); border:1px solid var(--border-color, #444);">
<h3 id="prompt-title" style="margin-top:0; color:var(--text-primary, #fff); font-size:18px; margin-bottom:10px;"></h3>
<p id="prompt-message" style="color:var(--text-secondary, #ccc); font-size:14px; margin-bottom:15px;"></p>
<textarea id="prompt-input" style="width:100%; height:80px; margin-bottom:15px; padding:10px; border-radius:6px; border:1px solid #555; background:#1a1a1a; color:white; resize:none; font-family:inherit; font-size:14px;"></textarea>
<div style="display:flex; justify-content:flex-end; gap:10px;">
<button id="prompt-cancel" style="padding:8px 16px; border-radius:6px; border:1px solid #555; background:transparent; color:white; cursor:pointer;">Avbryt</button>
<button id="prompt-confirm" style="padding:8px 16px; border-radius:6px; border:none; background:var(--accent-color, #28a745); color:white; font-weight:bold; cursor:pointer;">Spara & Arkivera</button>
</div>
</div>
`;
document.body.appendChild(modal);
}

const titleEl = modal.querySelector('#prompt-title');
const msgEl = modal.querySelector('#prompt-message');
const inputEl = modal.querySelector('#prompt-input');
const confirmBtn = modal.querySelector('#prompt-confirm');
const cancelBtn = modal.querySelector('#prompt-cancel');

titleEl.textContent = title;
msgEl.textContent = message;
inputEl.value = ''; 
modal.style.display = 'flex';
setTimeout(() => inputEl.focus(), 50);

const close = (val) => {
modal.style.display = 'none';
confirmBtn.onclick = null;
cancelBtn.onclick = null;
resolve(val);
};

confirmBtn.onclick = () => close(inputEl.value);
cancelBtn.onclick = () => close(null);
});
}


// Ny funktion för obligatoriskt svar vid arkivering av MAIL
async function archiveWithRequiredNote(ticket) {
const note = await atlasPrompt("Arkivera ärende", "Skriv in svaret till kunden (obligatoriskt):");

if (note === null) return;
if (!note.trim()) {
alert("Du måste ange ett svar innan ärendet kan arkiveras.");
return;
}

try {
await window.socketAPI.emit('team:agent_reply', {
conversationId: ticket.conversation_id,
message: note
});

setTimeout(async () => {
await archiveTicketFromMyTickets(ticket.conversation_id);
}, 500);
} catch (err) {
alert("Kunde inte spara svaret: " + err.message);
}
}

// Hjälpfunktion för att faktiskt utföra arkiveringen mot servern
async function archiveTicketFromMyTickets(conversationId) {
try {
const res = await fetch(`${SERVER_URL}/api/inbox/archive`, {
method: 'POST',
headers: fetchHeaders,
body: JSON.stringify({ conversationId })
});

if (!res.ok) throw new Error('Kunde inte arkivera ärendet');

// Återställ UI efter lyckad arkivering
document.getElementById('my-ticket-detail').style.display = 'none';
document.getElementById('my-detail-placeholder').style.display = 'flex';
renderMyTickets();
updateInboxBadge();

} catch (err) {
console.error("Arkivfel:", err);
alert("Ett fel uppstod vid arkivering: " + err.message);
}
}

// ============================================================================
// 1. LISTAN: DÖLJ EGNA ÄRENDEN & SORTERA (Ersätter kod på rad 935)
// ============================================================================
async function renderTeamQueue(container, filterType = 'customer') {
container.innerHTML = '<div class="template-item-empty">Laddar...</div>';

try {
const res = await fetch(`${SERVER_URL}/team/inbox`, { headers: fetchHeaders });
if (!res.ok) throw new Error("Kunde inte ladda kön");

const data = await res.json();
const tickets = (data.tickets || []).filter(t => t.session_type === filterType);

container.innerHTML = '';

if (tickets.length === 0) {
container.innerHTML = `<div class="template-item-empty">Tomt i listan.</div>`;
return;
}

// SORTERING: Oplockade först, sen tid
tickets.sort((a, b) => {
const aUnclaimed = !a.owner;
const bUnclaimed = !b.owner;
if (aUnclaimed && !bUnclaimed) return -1;
if (!aUnclaimed && bUnclaimed) return 1;
return b.updated_at - a.updated_at;
});

tickets.forEach(t => {
// FILTER: Dölj mina egna ärenden (de finns i "Mina Ärenden")
if (t.owner === currentUser.username) return;

const isMine = false; 
const shortId = t.conversation_id.replace('session_', '').substring(0, 6);

// Prioritera: Namn -> Ämne -> ID
let displayTitle = t.contact_name || t.subject || `Ärende #${shortId}`;

const timeStr = new Date(t.updated_at * 1000).toLocaleTimeString('sv-SE', {
hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'numeric'
});

let tagText = '';
let styleClass = ''; 

if (!t.owner) {
tagText = t.session_type === 'message' ? 'MAIL' : 'CHATT';
styleClass = 'unclaimed'; 
} else {
tagText = t.owner.toUpperCase();
styleClass = `agent-${t.owner.toLowerCase().replace(/[^a-z]/g, '')}`;
}

const card = document.createElement('div');
card.className = `team-ticket-card ${styleClass} ${isMine ? 'mine' : ''}`;
card.style.cursor = 'pointer';

let actionIcon = '';
let actionClass = '';

if (!t.owner) {
actionIcon = '✋'; actionClass = 'btn-claim';
} else {
actionIcon = '⚡'; actionClass = 'btn-takeover';
}

card.innerHTML = `
<div class="ticket-row top">
<span class="ticket-title">${displayTitle}</span>
<button class="mini-action-btn ${actionClass}" data-action="${t.owner ? 'takeover' : 'claim'}">${actionIcon}</button>
</div>
<div class="ticket-row mid">
<span class="ticket-preview">${t.last_message ? t.last_message.substring(0, 60) : '...'}</span>
</div>
<div class="ticket-row bot">
<span class="ticket-tag tag-dynamic ${styleClass}">${tagText}</span>
<span class="ticket-time">${timeStr}</span>
</div>
`;

// Denna anropar funktionen nedanför
card.onclick = () => openInboxDetail(t);

const btn = card.querySelector('button');
if (btn) {
btn.onclick = async (e) => {
e.stopPropagation();
const action = btn.dataset.action;
let msg = action === 'takeover' ? `Ta över från ${t.owner}?` : `Plocka ärendet?`;
if (await atlasConfirm('Hantera', msg)) {
if(window.electronAPI) await window.atlasTeam.claimTicket(t.conversation_id, currentUser.username);
else await fetch(`${SERVER_URL}/team/claim`, { method: 'POST', headers: fetchHeaders, body: JSON.stringify({ conversationId: t.conversation_id, agentName: currentUser.username }) });
renderInbox(); updateInboxBadge();
}
};
}
container.appendChild(card);
});

} catch (e) {
console.error("Inbox fel:", e);
container.innerHTML = `<div class="template-item-empty">Fel vid laddning.</div>`;
}
}

// ============================================================================
// 2. DETALJVY FÖR INKORG (NU MED FULL CHATTHISTORIK)
// ============================================================================
function openInboxDetail(ticket) {
const detailView = document.getElementById('inbox-detail');
const placeholder = document.getElementById('inbox-placeholder');

if (!detailView || !placeholder) return;

placeholder.style.display = 'none';
detailView.style.display = 'flex';
detailView.setAttribute('data-current-id', ticket.conversation_id);

// Agent-klass för färgning
const agentClass = ticket.owner 
? `agent-${ticket.owner.toLowerCase().replace(/[^a-z]/g, '')}` 
: 'unclaimed';
detailView.className = `template-editor-container ${agentClass}`;

detailView.innerHTML = '';

const isMine = currentUser && ticket.owner === currentUser.username;

// --- 1. HEADER-IKON ---
let topActionBtn = '';
if (!ticket.owner) {
topActionBtn = `<button class="action-icon-btn btn-claim-lg" id="detail-claim-btn" title="Plocka ärendet">✋</button>`;
} else if (ticket.owner && !isMine) {
topActionBtn = `<button class="action-icon-btn btn-takeover-lg" id="detail-takeover-btn" title="Ta över ärendet från ${ticket.owner}">⚡</button>`;
} 

const subject = ticket.subject || `Ärende #${ticket.conversation_id.substring(0,6)}`;
const dateStr = new Date(ticket.updated_at * 1000).toLocaleString();
const ownerText = ticket.owner ? `ÄGARE: ${ticket.owner.toUpperCase()}` : 'STATUS: OPLOCKAD';

// --- 2. FÖRBERED INNEHÅLL (CHATT vs MAIL) ---
let bodyContent = '';

if (ticket.session_type === 'message') {
// --- MAIL: Visa avsändare + meddelande ---
const messageContent = ticket.messages && ticket.messages.length > 0 
? ticket.messages[0].content 
: (ticket.last_message || "(Ingen text)");

let senderInfo = '';
if (ticket.contact_email) {
senderInfo = `
<div class="msg-sender" style="margin-top:10px; padding-top:10px; border-top:1px solid rgba(255,255,255,0.1);">
✉️ ${ticket.contact_email}<br>
${ticket.contact_name ? `👤 ${ticket.contact_name}<br>` : ''}
${ticket.contact_phone ? `📞 ${ticket.contact_phone}` : ''}
</div>`;
}

bodyContent = `
<div class="detail-message-box">
<div class="msg-label">INKOMMANDE MAIL:</div>
<div class="msg-content">${formatAtlasMessage(messageContent)}</div>
${senderInfo}
</div>
`;
} else {
// --- CHATT: Visa hela historiken (FIXEN) ---
const messages = ticket.messages || [];

if (messages.length > 0) {
// Skapa en scrollbar container för bubblorna
bodyContent = `<div class="inbox-chat-history" style="flex:1; overflow-y:auto; padding-right:5px;">`;

messages.forEach(m => {
// Bestäm sida: 'user' (Vänster) eller 'atlas'/'agent' (Höger)
// I Inkorgen är vi "åskådare", så User är Vänster (Grå), Atlas/Agent är Höger (Färgad)
const roleClass = m.role === 'user' ? 'user' : 'atlas';

bodyContent += `
<div class="message ${roleClass}" style="margin-bottom:10px;">
<div class="bubble">${formatAtlasMessage(m.content || m.text)}</div>
</div>`;
});

bodyContent += `</div>`;
} else {
// Fallback om inga meddelanden finns (t.ex. gammalt data)
bodyContent = `
<div class="detail-message-box">
<div class="msg-label">SENASTE MEDDELANDE:</div>
<div class="msg-content">${formatAtlasMessage(ticket.last_message || "Ingen text")}</div>
</div>`;
}
}

// --- 3. BYGG HTML ---
const content = document.createElement('div');
content.className = 'detail-container'; 

content.innerHTML = `
<div class="detail-header-top">
<div class="detail-title-box">
<h2 class="detail-subject">${subject}</h2>
<span class="detail-meta">${ownerText} &bull; ${dateStr}</span>
</div>
<div class="detail-top-actions">${topActionBtn}</div>
</div>

<div class="detail-body" id="inbox-detail-body">
${bodyContent}
</div>

<div class="detail-footer-toolbar">
<div class="footer-right">
<button class="footer-icon-btn" id="btn-archive" title="Arkivera till Garaget">📦</button>
<button class="footer-icon-btn danger" id="btn-delete" title="Ta bort permanent">❌</button>
</div>
</div>
`;

detailView.appendChild(content);

// Scrolla ner till botten av chatten automatiskt
if (ticket.session_type !== 'message') {
const chatBody = document.querySelector('.inbox-chat-history');
if (chatBody) chatBody.scrollTop = chatBody.scrollHeight;
}

// --- 4. KOPPLA LOGIK TILL KNAPPARNA ---
const claimBtn = document.getElementById('detail-claim-btn');
const takeoverBtn = document.getElementById('detail-takeover-btn');

const handleClaim = async (action) => {
let msg = action === 'takeover' ? `Ta över från ${ticket.owner}?` : `Plocka ärendet?`;
if (await atlasConfirm('Hantera', msg)) {
try {
if(window.electronAPI) await window.atlasTeam.claimTicket(ticket.conversation_id, currentUser.username);
else await fetch(`${SERVER_URL}/team/claim`, { method: 'POST', headers: fetchHeaders, body: JSON.stringify({ conversationId: ticket.conversation_id, agentName: currentUser.username }) });
renderInbox(); 
updateInboxBadge();
const updatedTicket = {...ticket, owner: currentUser.username};
// Öppna inte detaljvyn igen här, det blir rörigt. Låt användaren gå till "Mina ärenden".
// Men om du vill att den ska stanna kvar: openInboxDetail(updatedTicket);
// Bättre UX: 
detailView.style.display = 'none';
placeholder.style.display = 'flex';
// Byt flik till "Mina ärenden" automatiskt? Kanske överkurs just nu.
} catch(err) { alert("Fel: " + err.message); }
}
};

if (claimBtn) claimBtn.onclick = () => handleClaim('claim');
if (takeoverBtn) takeoverBtn.onclick = () => handleClaim('takeover');

document.getElementById('btn-archive').onclick = async () => {
if (await atlasConfirm('Arkivera', 'Flytta till Garaget?')) {
await fetch(`${SERVER_URL}/api/inbox/archive`, { method: 'POST', headers: fetchHeaders, body: JSON.stringify({ conversationId: ticket.conversation_id }) });
renderInbox(); 
detailView.style.display = 'none'; 
placeholder.style.display = 'flex';
}
};

document.getElementById('btn-delete').onclick = async () => {
if (await atlasConfirm('Ta bort', 'Är du säker? Detta raderar ärendet permanent.')) {
try {
if (window.electronAPI) await window.electronAPI.deleteQA(ticket.id);
else await fetch(`${SERVER_URL}/api/inbox/delete`, { method: 'POST', headers: fetchHeaders, body: JSON.stringify({ conversationId: ticket.conversation_id }) });
renderInbox(); 
detailView.style.display = 'none'; 
placeholder.style.display = 'flex';
} catch (err) { alert("Fel: " + err.message); }
}
};
}

/* ===============================================================
   RENDER ARCHIVE (GARAGET) - UPPDATERAD MED NAMN & NY DESIGN
   =============================================================== */
async function renderArchive(applyFilters = false) {
    const container = document.getElementById('archive-list');
    if (!container) return;

    // 1. Hämta data (om vi inte bara ska filtrera befintlig data i minnet)
    if (!applyFilters) {
        container.innerHTML = '<div class="template-item-empty">Laddar arkiv...</div>';
        State.archiveItems = []; // Töm gammalt minne

        // A. Hämta Serverns Arkiv
        try {
            const res = await fetch(`${SERVER_URL}/api/archive`, { headers: fetchHeaders });
            if (res.ok) {
                const data = await res.json();
                if (data.archive) State.archiveItems.push(...data.archive);
            }
        } catch (err) {
            console.error("Server-arkiv fel:", err);
        }

        // B. Hämta Lokalt Arkiv (Electron)
        if (window.electronAPI) {
            try {
                const localAll = await window.electronAPI.loadQAHistory();
                const localArchived = localAll.filter(item => item.is_archived === 1);
                localArchived.forEach(x => x._isLocal = true);
                State.archiveItems.push(...localArchived);
            } catch (err) { console.error("Lokalt arkiv fel:", err); }
        }

        // C. Uppdatera dropdowns
        populateArchiveDropdowns();
    }

    // 2. Läs filter
    const typeVal = document.getElementById('filter-type')?.value || 'all';
    const agentVal = document.getElementById('filter-agent')?.value || 'all';
    const vehicleVal = document.getElementById('filter-vehicle')?.value || 'all';
    const cityVal = document.getElementById('filter-city')?.value || 'all';
    const dateStart = document.getElementById('filter-date-start')?.value;
    const dateEnd = document.getElementById('filter-date-end')?.value;

    // 3. Filtrera
    let filtered = State.archiveItems.filter(item => {
        const itemType = item.session_type === 'message' ? 'mail' : 'chat';
        if (typeVal !== 'all' && itemType !== typeVal) return false;
        if (agentVal !== 'all' && item.owner !== agentVal) return false;
        if (vehicleVal !== 'all' && item.vehicle !== vehicleVal) return false;
        if (cityVal !== 'all' && item.city !== cityVal) return false;
        if (dateStart || dateEnd) {
            const itemDate = new Date(item.timestamp).setHours(0, 0, 0, 0);
            if (dateStart && itemDate < new Date(dateStart).setHours(0, 0, 0, 0)) return false;
            if (dateEnd && itemDate > new Date(dateEnd).setHours(0, 0, 0, 0)) return false;
        }
        return true;
    });

    // 4. Sortera och rendera
    filtered.sort((a, b) => b.timestamp - a.timestamp);
    container.innerHTML = '';

    if (filtered.length === 0) {
        container.innerHTML = '<div class="template-item-empty">Inga ärenden matchade filtret.</div>';
        return;
    }

    filtered.forEach(item => {
        const el = document.createElement('div');
        
        // Styla om till samma kort-design som Inkorgen
        const isMail = item.session_type === 'message';
        const isLocal = item._isLocal === true;
        
        // Agent-färg (om det finns en ägare)
        let styleClass = '';
        if (isLocal) {
            styleClass = 'mine'; // Lokala privata
        } else if (item.owner) {
            styleClass = `agent-${item.owner.toLowerCase().replace(/[^a-z]/g, '')}`;
        } else {
            styleClass = isMail ? 'unclaimed' : 'unclaimed'; // Fallback
        }

        el.className = `team-ticket-card archive-card ${styleClass}`;
        el.style.cursor = 'pointer';

        // Fixa display-texter
        let typeLabel = item.owner ? item.owner.toUpperCase() : (isMail ? 'MAIL' : 'TEAM');
        if (isLocal) typeLabel = 'PRIVAT';

        const shortId = (item.conversation_id || item.id || "").toString().replace('session_', '').substring(0, 6);
        
        // 🔥 HÄR HÄMTAR VI NAMNET! (Samma logik som Mina Ärenden)
        const displayTitle = item.contact_name || item.subject || item.question || `Ärende #${shortId}`;

        const timeStr = new Date(item.timestamp).toLocaleDateString() + ' ' + 
                        new Date(item.timestamp).toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' });

        // Ikon
        const actionIcon = '📂'; 

        // Bygg HTML (Matchar renderTeamQueue layout)
        el.innerHTML = `
            <div class="ticket-row top">
                <span class="ticket-title">${displayTitle.substring(0, 35)}${displayTitle.length > 35 ? '...' : ''}</span>
                <span class="mini-action-icon" style="opacity:0.5; font-size:12px;">${actionIcon}</span>
            </div>

            <div class="ticket-row mid">
                <span class="ticket-preview">${item.question ? item.question.substring(0, 60) : 'Klicka för att läsa...'}</span>
            </div>

            <div class="ticket-row bot">
                <span class="ticket-tag tag-dynamic ${styleClass}">${typeLabel}</span>
                <span class="ticket-time">${timeStr}</span>
            </div>
        `;

        // --- ON CLICK LOGIK (Öppna detaljvy) ---
        el.onclick = () => {
            document.getElementById('archive-placeholder').style.display = 'none';
            const detail = document.getElementById('archive-detail');
            const content = document.getElementById('archive-content');

            detail.style.display = 'flex';
            content.innerHTML = '';

            // Sätt färg på detaljvyn också
            const agentClass = item.owner ? `agent-${item.owner.toLowerCase().replace(/[^a-z]/g, '')}` : '';
            detail.className = `template-editor-container ${agentClass}`;

            // 1. JSON PARSING & BUBBLOR
            try {
                const messages = JSON.parse(item.answer);

                if (Array.isArray(messages)) {
                    messages.forEach(m => {
                        // Justera roller för historiken
                        let roleClass = 'atlas';
                        if (m.role === 'agent' || m.role === 'atlas' || m.sender === 'Patric' || m.sender === 'Oskar' || m.sender === 'Nathalie' || m.sender === 'Jessica') roleClass = 'user'; // Höger (Agent)
                        if (m.role === 'user') roleClass = 'atlas'; // Vänster (Kund)

                        // Om det är "System", gör den centrerad/speciell
                        if (m.role === 'system' || m.sender === 'System') {
                             const sysDiv = document.createElement('div');
                             sysDiv.style.textAlign = 'center';
                             sysDiv.style.margin = '10px 0';
                             sysDiv.style.fontSize = '12px';
                             sysDiv.style.opacity = '0.7';
                             sysDiv.innerText = m.content;
                             content.appendChild(sysDiv);
                             return;
                        }

                        const wrapper = document.createElement('div');
                        wrapper.className = `message ${roleClass}`;
                        const bubble = document.createElement('div');
                        bubble.className = 'bubble';
                        bubble.innerHTML = (typeof formatAtlasMessage === 'function')
                            ? formatAtlasMessage(m.content)
                            : m.content;

                        wrapper.appendChild(bubble);
                        content.appendChild(wrapper);
                    });
                } else {
                    throw new Error("Ej array");
                }
            } catch (e) {
                // Fallback för vanlig text (t.ex. gamla mail eller felaktig JSON)
                content.innerHTML = `<div style="padding:15px; line-height:1.6; white-space: pre-wrap;">${
                    (typeof formatAtlasMessage === 'function') ? formatAtlasMessage(item.answer) : item.answer
                }</div>`;
            }

            // Scrolla ner
            content.scrollTop = content.scrollHeight;

            // 3. KNAPPAR I ARKIVET (ENDAST RADERA)
            // Vi ser till att dölja den gamla Återuppta-knappen helt
            const restoreBtn = document.getElementById('unarchive-qa-btn');
            if (restoreBtn) restoreBtn.style.display = 'none';

            // Hitta knapp-containern
            let headerControls = document.querySelector('#archive-detail .editor-buttons');
            if (!headerControls && restoreBtn && restoreBtn.parentNode) {
                headerControls = restoreBtn.parentNode;
            }

            // Rensa gamla dynamiska knappar
            const oldDelBtn = document.getElementById('dynamic-delete-btn');
            if (oldDelBtn) oldDelBtn.remove();

            if (headerControls) {
                const deleteBtn = document.createElement('button');
                deleteBtn.id = 'dynamic-delete-btn';
                deleteBtn.innerText = "🗑️ Radera permanent";
                deleteBtn.className = 'header-button';
                deleteBtn.style.background = "#dc3545";

                deleteBtn.onclick = async () => {
                    const confirm = await atlasConfirm("Radera permanent", "Är du säker? Detta går inte att ångra.");
                    if (confirm) {
                        try {
                            if (isLocal && isElectron) {
                                await window.electronAPI.deleteQA(item.id);
                            } else {
                                await fetch(`${SERVER_URL}/api/inbox/delete`, {
                                    method: 'POST',
                                    headers: fetchHeaders,
                                    body: JSON.stringify({ conversationId: item.conversation_id })
                                });
                            }
                            renderArchive(false);
                            detail.style.display = 'none';
                            document.getElementById('archive-placeholder').style.display = 'flex';
                        } catch (err) {
                            alert("Fel vid radering: " + err.message);
                        }
                    }
                };
                headerControls.appendChild(deleteBtn);
            }

        }; // Slut på onclick

        container.appendChild(el);
    });
}

// === LÄGG IN DENNA DIREKT HÄR EFTER ===
function populateArchiveDropdowns() {
const agents = new Set();
const cities = new Set();

State.archiveItems.forEach(item => {
if(item.owner) agents.add(item.owner);
if(item.city) cities.add(item.city);
});

const agentSel = document.getElementById('filter-agent');
const citySel = document.getElementById('filter-city');

// Fyll Agent-listan (om den är tom)
if(agentSel && agentSel.options.length <= 1) {
agents.forEach(a => agentSel.innerHTML += `<option value="${a}">${a}</option>`);
}

// Fyll Stad-listan (om den är tom)
if(citySel && citySel.options.length <= 1) {
cities.forEach(c => citySel.innerHTML += `<option value="${c}">${c}</option>`);
}
}

async function loadTemplates() {
try {
if (isElectron) {
State.templates = await window.electronAPI.loadTemplates() || [];
} else {
const res = await fetch(`${SERVER_URL}/api/templates`, { headers: fetchHeaders });
if (!res.ok) throw new Error("Kunde inte hämta mallar");
State.templates = await res.json();
}
renderTemplates(State.templates);
} catch (err) {
console.error("Mall-fel:", err);
}
}

// ==========================================================
// 5. MALL-HANTERARE (KORRIGERAD)
// ==========================================================
function renderTemplates(list) {
DOM.templateList.innerHTML = '';
if (list.length === 0) {
DOM.templateList.innerHTML = '<div class="template-item-empty">Inga mallar hittades.</div>';
return;
}
const groups = {};
list.forEach(t => {
const g = t.group_name || 'Övrigt';
if (!groups[g]) groups[g] = [];
groups[g].push(t);
});
Object.keys(groups).sort().forEach(gName => {
const header = document.createElement('div');
header.className = 'template-group-header';
header.innerHTML = `<div class="group-header-content"><span class="group-arrow">▶</span><span class="group-name">${gName}</span></div><span class="group-count">${groups[gName].length}</span>`;
const content = document.createElement('div');
content.className = 'template-group-content';
groups[gName].forEach(t => {
const item = document.createElement('div');
item.className = 'template-item';
item.innerHTML = `<span class="template-title">${t.title}</span>`;

// Vi använder en explicit funktionsreferens här
item.onclick = () => {
if (typeof openTemplateEditor === 'function') {
openTemplateEditor(t);
} else {
console.error("Kritiskt fel: openTemplateEditor saknas fortfarande i scope!");
}
};

content.appendChild(item);
});
header.onclick = () => {
content.classList.toggle('expanded');
header.querySelector('.group-arrow').classList.toggle('expanded');
};
DOM.templateList.appendChild(header);
DOM.templateList.appendChild(content);
});
}

function openTemplateEditor(t) {
console.log("📂 Öppnar mall:", t.title);
isLoadingTemplate = true;

DOM.editorPlaceholder.style.display = 'none';
DOM.editorForm.style.display = 'flex';

DOM.inputs.id.value = t.id;
DOM.inputs.title.value = t.title;
DOM.inputs.group.value = t.group_name || ''; 

if (quill) {
quill.root.innerHTML = t.content; 
}

const deleteBtn = document.getElementById('delete-template-btn');
if(deleteBtn) deleteBtn.style.display = 'block';

const saveBtn = DOM.editorForm.querySelector('button[type="submit"]');
if (saveBtn) {
saveBtn.disabled = true; 
saveBtn.innerText = "Spara mall";
}

setTimeout(() => {
isLoadingTemplate = false;
}, 50);
}

function switchView(viewId) {
// 1. Dölj alla vyer
Object.values(DOM.views).forEach(v => {
if (v) v.style.display = 'none';
});

// 2. Visa den valda vyn
if (DOM.views[viewId]) {
DOM.views[viewId].style.display = 'flex';
}

// 3. Uppdatera menyn
DOM.menuItems.forEach(item => {
item.classList.toggle('active', item.dataset.view === viewId);
});

// 🔥 FIX: Dölj badge OMEDELBART (inte asynkront)
if (viewId === 'inbox') {
const badge = document.getElementById('badge-inbox');
if (badge) badge.style.setProperty('display', 'none', 'important');
renderInbox();
} 
else if (viewId === 'my-tickets') {
const badge = document.getElementById('badge-my-tickets');
if (badge) badge.style.setProperty('display', 'none', 'important');
renderMyTickets();
}
else if (viewId === 'archive') {
renderArchive();
}
}


// Universell funktion för Atlas-modalen
function atlasConfirm(title, message) {
return new Promise((resolve) => {
const modal = document.getElementById('atlas-modal');
const titleEl = document.getElementById('modal-title');
const messageEl = document.getElementById('modal-message');
const confirmBtn = document.getElementById('modal-confirm');
const cancelBtn = document.getElementById('modal-cancel');

titleEl.innerText = title;
messageEl.innerText = message;
modal.style.display = 'flex';

confirmBtn.onclick = () => {
modal.style.display = 'none';
resolve(true);
};

cancelBtn.onclick = () => {
modal.style.display = 'none';
resolve(false);
};
});
}

function changeTheme(themeName) {
DOM.themeStylesheet.href = `./assets/themes/${themeName}/${themeName}.css`;
localStorage.setItem('atlas-theme', themeName);
}

// ============================================================================
// FIX 1: BADGE-HANTERING (Tvingar bort 0:or med !important)
// ============================================================================

async function updateInboxBadge() {
if (!authToken) return;
const inboxBadge = document.getElementById('badge-inbox');
const myBadge = document.getElementById('badge-my-tickets');

try {
const res = await fetch(`${SERVER_URL}/team/inbox`, { headers: fetchHeaders });
const data = await res.json();
const tickets = data.tickets || [];

// Oplockade ärenden (Röd badge)
const unassignedCount = tickets.filter(t => !t.owner).length;
if (inboxBadge) {
inboxBadge.textContent = unassignedCount;
// 🔥 FIX: Använd setProperty med 'important' för att överskrida CSS
if (unassignedCount > 0) {
inboxBadge.style.setProperty('display', 'flex', 'important');
} else {
inboxBadge.style.setProperty('display', 'none', 'important');
}
}

// Mina ärenden (Blå badge)
const myCount = tickets.filter(t => t.owner === currentUser.username).length;
if (myBadge) {
myBadge.textContent = myCount;
// 🔥 FIX: Samma fix här
if (myCount > 0) {
myBadge.style.setProperty('display', 'flex', 'important');
} else {
myBadge.style.setProperty('display', 'none', 'important');
}
}
} catch (err) { 
console.error("Badge-error:", err); 
}
}

document.addEventListener('DOMContentLoaded', async () => {
console.log("🚀 Atlas Renderer 2.5 Loaded (Final Context Fix)");

// =====================================
// 1. App Info & API Key (FIXAD)
// =====================================
if (window.electronAPI) {
const info = await window.electronAPI.getAppInfo();

API_KEY = info.CLIENT_API_KEY;

if (DOM.appName) DOM.appName.textContent = info.APP_NAME;
if (DOM.appVersion) DOM.appVersion.textContent = info.ATLAS_VERSION;

const sVer =
info.SERVER_VERSION && info.SERVER_VERSION !== 'Väntar...'
? info.SERVER_VERSION
: 'Väntar...';

if (DOM.serverVersion) DOM.serverVersion.textContent = sVer;
}

// =====================================
// 2. Badges (Inkorg + Mina ärenden)
// =====================================
updateInboxBadge();

setInterval(() => {
if (!authToken) return;
updateInboxBadge();
}, 10000);

// =====================================
// 3. Init Quill & Globala lyssnare
// =====================================
if (typeof Quill !== 'undefined') {
quill = new Quill('#quill-editor', {
theme: 'snow',
placeholder: 'Skriv mallens innehåll här...'
});

quill.on('text-change', (delta, oldDelta, source) => {
if (isLoadingTemplate) return;
if (source === 'user') {
const saveBtn = DOM.editorForm.querySelector('button[type="submit"]');
if (saveBtn) saveBtn.disabled = false;
}
});
}

// Titel + Grupp
[DOM.inputs.title, DOM.inputs.group].forEach(input => {
input.addEventListener('input', () => {
if (isLoadingTemplate) return;
const saveBtn = DOM.editorForm.querySelector('button[type="submit"]');
if (saveBtn) saveBtn.disabled = false;
});
});

// =====================================
// 4. Init State
// =====================================
initChat();
await loadTemplates();

// =====================================
// 5. Tema
// =====================================
const savedTheme = localStorage.getItem('atlas-theme');
if (savedTheme) {
DOM.themeSelect.value = savedTheme;
changeTheme(savedTheme);
}

// =====================================
// 6. EVENT LISTENERS
// =====================================

// Meny
DOM.menuItems.forEach(item => {
item.addEventListener('click', () => switchView(item.dataset.view));
});

// Skicka meddelande
DOM.chatForm.addEventListener('submit', (e) => {
e.preventDefault();
handleUserMessage(DOM.messageInput.value);
});

// ==================================================
// MINI-CHAT – AGENT SKICKAR SVAR TILL KUND
// ==================================================

if (DOM.myTicketChatForm) {
DOM.myTicketChatForm.addEventListener('submit', (e) => {
e.preventDefault();

const message = DOM.myTicketChatInput.value.trim();
if (!message) return;

const detail = document.getElementById('my-ticket-detail');
const conversationId = detail?.getAttribute('data-current-id');

if (!conversationId) {
console.warn('⚠️ Ingen aktiv conversationId i mini-chat');
return;
}

// Skicka till servern
window.socketAPI.emit('team:agent_reply', {
conversationId,
message
});

// VIKTIGT: Vi renderar INGET här. Vi litar på att servern skickar tillbaka
// meddelandet via socket-lyssnaren (team:customer_reply).
// Det är det som tar bort dubbletten.

// Töm input
DOM.myTicketChatInput.value = '';
});
}


// Sök mallar
DOM.templateSearch.addEventListener('input', (e) => {
const term = e.target.value.toLowerCase();
const filtered = State.templates.filter(t =>
t.title.toLowerCase().includes(term) ||
(t.group_name && t.group_name.toLowerCase().includes(term))
);

renderTemplates(filtered);

if (term.length > 0) {
document
.querySelectorAll('.template-group-content')
.forEach(el => el.classList.add('expanded'));
}
});

// Byt tema
DOM.themeSelect.addEventListener('change', (e) =>
changeTheme(e.target.value)
);

// Ny chatt (Header-knappen)
const headerNewChat = document.getElementById('new-chat-btn-header');
if (headerNewChat) {
// VIKTIGT: Kloning tar bort eventuella gamla "spök-lyssnare" vid omstart
const newBtn = headerNewChat.cloneNode(true);
headerNewChat.parentNode.replaceChild(newBtn, headerNewChat);

newBtn.addEventListener('click', async () => {
// Dubbelklick-skydd
if (newBtn.disabled) return;
newBtn.disabled = true;

const confirmed = await atlasConfirm(
'Ny chatt',
'Vill du starta en ny chatt och rensa historiken?'
);

if (confirmed) {
// 1. Arkivera manuellt till Garaget
if (State.currentSession && State.currentSession.messages.length > 0) {
console.log("💾 Arkiverar till Garaget...");
// true = Sätt is_archived = 1
await saveLocalQA(State.currentSession, true);
}

// 2. Starta ny session MEN SPARA INTE IGEN (skicka true)
initChat(true); 

// 3. Uppdatera vyn om vi står i garaget
if (DOM.views.archive && DOM.views.archive.style.display === 'flex') {
renderArchive();
}
}

// Släpp knappen fri igen
setTimeout(() => { newBtn.disabled = false; }, 500);
});
}

// =====================================
// Spara mall, radera mall, genvägar,
// arkivera, auth, logout osv
// =====================================
});

// "Skapa ny mall" knappen
document.getElementById('new-template-btn').addEventListener('click', () => {
DOM.editorPlaceholder.style.display = 'none';
DOM.editorForm.style.display = 'flex';
DOM.inputs.id.value = '';
DOM.inputs.title.value = '';
DOM.inputs.group.value = '';
quill.root.innerHTML = '';
document.getElementById('delete-template-btn').style.display = 'none';

const saveBtn = DOM.editorForm.querySelector('button[type="submit"]');
if (saveBtn) {
saveBtn.disabled = true;
saveBtn.innerText = "Spara mall";
}
});

// --- HYBRID: Spara mall ---
DOM.editorForm.addEventListener('submit', async (e) => {
e.preventDefault();

const saveBtn = DOM.editorForm.querySelector('button[type="submit"]');
const originalText = "Spara mall";

saveBtn.innerText = "Sparar...";
saveBtn.disabled = true;

const newTemplate = {
id: DOM.inputs.id.value || `tpl_${Date.now()}`,
title: DOM.inputs.title.value,
group_name: DOM.inputs.group.value || 'Övrigt',
content: quill.root.innerHTML
};

const existingIdx = State.templates.findIndex(t => t.id === newTemplate.id);
if (existingIdx > -1) State.templates[existingIdx] = newTemplate;
else State.templates.push(newTemplate);

try {
if (isElectron) {
await window.electronAPI.saveTemplates([newTemplate]);
} else {
const res = await fetch(`${SERVER_URL}/api/templates/save`, {
method: 'POST',
headers: fetchHeaders,
body: JSON.stringify(newTemplate)
});
if (!res.ok) throw new Error("Servern nekade sparning (Auth?)");
}

await loadTemplates();

saveBtn.innerText = "Sparat! ✅";
setTimeout(() => {
saveBtn.innerText = originalText;
saveBtn.disabled = false;
}, 1500);

if (quill) quill.focus();

} catch (err) {
console.error("Fel vid sparning:", err);
alert("Kunde inte spara mallen: " + err.message);
saveBtn.innerText = originalText;
saveBtn.disabled = false;
}
});

// --- HYBRID: Radera mall ---
const delBtn = document.getElementById('delete-template-btn');
if (delBtn) {
delBtn.addEventListener('click', async () => {
const id = DOM.inputs.id.value;
if (!id) return;

const confirmed = await atlasConfirm('Radera mall', 'Vill du ta bort denna mall permanent?');
if (confirmed) {
try {
if (isElectron) {
await window.electronAPI.deleteTemplate(id);
} else {
const res = await fetch(`${SERVER_URL}/api/templates/delete/${id}`, {
method: 'DELETE',
headers: fetchHeaders
});
if (!res.ok) throw new Error("Kunde inte radera mallen via webben");
}

State.templates = State.templates.filter(t => t.id !== id);
renderTemplates(State.templates);
DOM.editorForm.style.display = 'none';
DOM.editorPlaceholder.style.display = 'flex';
} catch (err) {
console.error("Fel vid borttagning:", err);
alert("Kunde inte ta bort mallen: " + err.message);
}
}
});
}

// ========================================================
// 🎹 TANGENTBORDSGENVÄGAR (STEG 2)
// ========================================================
document.addEventListener('keydown', (e) => {

// 1. NY CHATT: Ctrl + P
if (e.ctrlKey && !e.altKey && (e.key === 'p' || e.key === 'P')) {
e.preventDefault();
const newChatBtn = document.getElementById('new-chat-btn-header');
if (newChatBtn) newChatBtn.click();
}

// 2. FÖLJDFRÅGA: Ctrl + Alt + P
if (e.ctrlKey && e.altKey && (e.key === 'p' || e.key === 'P')) {
e.preventDefault();
const input = document.getElementById('message-input');
if (input) input.focus();
}

// 3. BYT TEMA: Ctrl + Alt + T
if (e.ctrlKey && e.altKey && (e.key === 't' || e.key === 'T')) {
e.preventDefault();
const select = document.getElementById('theme-select');
if (select) {
let newIndex = select.selectedIndex + 1;
if (newIndex >= select.options.length) newIndex = 0;
select.selectedIndex = newIndex;
changeTheme(select.value);
}
}

// 4. SPARA MALL: Ctrl + S
if (e.ctrlKey && (e.key === 's' || e.key === 'S')) {
const templateView = document.getElementById('view-templates');
if (templateView && templateView.style.display !== 'none') {
e.preventDefault();
const saveBtn = document.querySelector('.save-button');
if (saveBtn && !saveBtn.disabled) saveBtn.click();
}
}
});

// Globala Genvägar (Urklipp)
if (window.electronAPI) {
window.electronAPI.onProcessClipboard((text, shouldClear) => {
console.log("📋 Klistrar in från globalt kommando...");
if (shouldClear) initChat();
switchView('chat');
handleUserMessage(text);
});
}

const archiveQaBtn = document.getElementById('archive-qa-btn');
if (archiveQaBtn) {
archiveQaBtn.onclick = async () => {

const currentId = DOM.inboxQuestion.getAttribute('data-current-id');
if (!currentId) {
alert("Inget ärende valt");
return;
}

const confirmed = await atlasConfirm(
'Arkivera',
'Vill du flytta detta ärende till arkivet?'
);

if (confirmed) {
try {
if (isElectron) {
await window.electronAPI.updateQAArchivedStatus(currentId, 1);
} else {
const res = await fetch(`${SERVER_URL}/api/inbox/archive`, {
method: 'POST',
headers: fetchHeaders,
body: JSON.stringify({ conversationId: currentId })
});

if (!res.ok) {
throw new Error('Kunde inte arkivera ärendet');
}
}

DOM.inboxDetail.style.display = 'none';
DOM.inboxPlaceholder.style.display = 'flex';
renderInbox();

} catch (err) {
console.error("Arkivfel:", err);
}
}
};
}

// Arkivera-knapp specifikt för vyn "Mina ärenden"
const myArchiveBtn = document.getElementById('my-archive-btn');
if (myArchiveBtn) {
myArchiveBtn.onclick = async () => {
// Vi hämtar ID:t från attributet vi satte när vi öppnade detaljvyn
const currentId = document.getElementById('my-ticket-detail').getAttribute('data-current-id');

if (!currentId) {
alert("Inget ärende valt");
return;
}

const confirmed = await atlasConfirm('Arkivera', 'Vill du flytta detta ärende till Garaget?');
if (confirmed) {

try {
if (isElectron) {
// Electron via IPC
await window.electronAPI.updateQAArchivedStatus(currentId, 1);
} else {
// Webb – archive-endpoint
const res = await fetch(`${SERVER_URL}/api/inbox/archive`, {
method: 'POST',
headers: fetchHeaders,
body: JSON.stringify({ conversationId: currentId })
});

if (!res.ok) {
throw new Error('Kunde inte arkivera ärendet');
}
}

// Uppdatera vyn
document.getElementById('my-ticket-detail').style.display = 'none';
document.getElementById('my-detail-placeholder').style.display = 'flex';
renderMyTickets();
updateInboxBadge();

} catch (err) {
console.error("Kunde inte arkivera från Mina ärenden:", err);
}

}   // STÄNGER: if (confirmed)
};    // STÄNGER: myArchiveBtn.onclick
}       // STÄNGER: if (myArchiveBtn)


// === AUTH INITIALIZATION ===
document.body.insertAdjacentHTML('beforeend', loginModalHTML);
checkAuth();

// Hantera Login Submit
const loginForm = document.getElementById('login-form');
if (loginForm) {
loginForm.addEventListener('submit', async (e) => {
e.preventDefault();
const user = document.getElementById('login-user').value;
const pass = document.getElementById('login-pass').value;
const errElem = document.getElementById('login-error');
const btn = loginForm.querySelector('button');

btn.disabled = true;
btn.innerText = "Loggar in...";
errElem.textContent = "";

try {
const res = await fetch(`${SERVER_URL}/api/auth/login`, {
method: 'POST',
headers: { 'Content-Type': 'application/json' },
body: JSON.stringify({ username: user, password: pass })
});

const data = await res.json();

if (!res.ok) throw new Error(data.error || 'Inloggning misslyckades');

// Spara Token
localStorage.setItem('atlas_token', data.token);
localStorage.setItem('atlas_user', JSON.stringify(data.user));

// Ladda om för att starta socket med ny token
location.reload();

} catch (err) {
errElem.textContent = err.message;
btn.disabled = false;
btn.innerText = "Logga in";
}
});
}

// =============================================================================
// 7. KOPPLA LOGOUT & LOGIN KNAPPAR (SIDOMENYN)
// =============================================================================

// Vänta på att allt laddat klart
document.addEventListener('DOMContentLoaded', () => {

// 1. Koppla den nya SVG-knappen för utloggning
const sidebarLogoutBtn = document.getElementById('logout-btn');
if (sidebarLogoutBtn) {
sidebarLogoutBtn.addEventListener('click', (e) => {
e.preventDefault();
// Ingen confirm behövs egentligen då vi bara laddar om, men känns tryggt
if (confirm("Vill du logga ut?")) {
handleLogout();
}
});
}

// 2. Koppla "Logga in"-knappen (visas bara om man är utloggad)
const sidebarLoginBtn = document.getElementById('login-btn-sidebar');
if (sidebarLoginBtn) {
sidebarLoginBtn.addEventListener('click', () => {
const modal = document.getElementById('login-modal');
if (modal) modal.style.display = 'flex';
});
}

// 3. Koppla Filter-knappar för Arkivet (Garaget)
const applyFilterBtn = document.getElementById('apply-filters-btn');
if (applyFilterBtn) {
applyFilterBtn.addEventListener('click', () => {
renderArchive(true); // true = Använd cachad data, filtrera bara
});
}

const resetFilterBtn = document.getElementById('reset-filters-btn');
if (resetFilterBtn) {
resetFilterBtn.addEventListener('click', () => {
// Nollställ alla inputs till default
const idsToReset = [
'filter-type',
'filter-agent',
'filter-vehicle',
'filter-city'
];

idsToReset.forEach(id => {
const el = document.getElementById(id);
if (el) el.value = 'all';
});

// Töm datumfält
const dateStart = document.getElementById('filter-date-start');
const dateEnd = document.getElementById('filter-date-end');
if (dateStart) dateStart.value = '';
if (dateEnd) dateEnd.value = '';

// Rendera om listan (visar allt igen)
renderArchive(true);
});
}

});

// Hjälpfunktion för att formatera text (fetstil, radbrytningar, länkar)
function formatAtlasMessage(text) {
if (!text) return "";
return text
.replace(/\*\*(.*?)\*\*/g, '<b>$1</b>')
.replace(/\n/g, '<br>')
.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" class="atlas-link">$1</a>');
}
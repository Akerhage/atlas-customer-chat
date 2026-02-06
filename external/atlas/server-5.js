// =============================================================================
// ATLAS V2.0 SERVER - CONFIGURATION & DEPENDENCIES
// =============================================================================

console.log("🚀 server.js bootar");
const SERVER_VERSION = "2.6.0"; // Definiera versionen här
const express = require('express');
const crypto = require('crypto');
const http = require('http');
const { Server } = require("socket.io");
const cors = require('cors');

// === AUTH DEPENDENCIES ===
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret_key_change_in_prod';

// HUMAN MODE TRIGGERS & RESPONSES
const HUMAN_TRIGGERS = [
"prata med människa",
"kundtjänst",
"jag vill ha personal",
"människa"
];
const HUMAN_RESPONSE_TEXT = "Jag kopplar dig till en mänsklig kollega.";

// DATABASE & ENGINE IMPORTS
const { 
getUserByUsername, 
createUser,
getAllTemplates, 
getContextRow, 
upsertContextRow,
getV2State,    
setHumanMode,  
claimTicket,
getTeamInbox,
getAgentTickets,
updateTicketFlags

} = require('./db');

const { runLegacyFlow } = require('./legacy_engine');


// ==================================================
// 🔁 GEMENSAM CHAT HANDLER (SOCKET + CUSTOMER CHAT)
// ==================================================
async function handleChatMessage({
query,
sessionId,
isFirstMessage,
session_type,
providedContext
}) {
console.log(`[CHAT] Message received:`, query);

if (!query || !sessionId) {
return { answer: "", sessionId };
}

// --- ZOMBIE KILLER ---
const v2State = await getV2State(sessionId);
if (v2State && v2State.is_archived === 1) {
console.log(`💀 [ZOMBIE] Session ${sessionId} är arkiverad. Nekar meddelande.`);
return {
answer: "Denna chatt är avslutad. Vänligen ladda om sidan eller starta en ny konversation för att få hjälp.",
sessionId
};
}

// ==================================================================
// 🛠️ 1. HÄMTA KONTEXT & SPARA NAMN (DIREKT)
// ==================================================================

// Hämta befintlig data
let storedContext = await getContextRow(sessionId);

let contextData = {
messages: [],
locked_context: { city: null, area: null, vehicle: null },
linksSentByVehicle: { AM: false, MC: false, CAR: false, INTRO: false, RISK1: false, RISK2: false }
};

if (storedContext?.context_data) {
contextData = storedContext.context_data;
// Säkra upp strukturen
if (!contextData.messages) contextData.messages = [];
if (!contextData.locked_context) contextData.locked_context = { city: null, area: null, vehicle: null };
if (!contextData.linksSentByVehicle) contextData.linksSentByVehicle = { AM: false, MC: false, CAR: false, INTRO: false, RISK1: false, RISK2: false };
}

// 🔥 FIXEN: Spara namnet från frontend INNAN vi kollar triggers
if (providedContext?.locked_context) {
contextData.locked_context = {
...contextData.locked_context,
...providedContext.locked_context
};
console.log('🎯 [CONTEXT PRE-SAVE] Sparar namn innan trigger-check:', providedContext.locked_context);

// Spara direkt till DB
await upsertContextRow({
conversation_id: sessionId,
last_message_id: (storedContext?.last_message_id || 0),
context_data: contextData,
updated_at: Math.floor(Date.now() / 1000)
});
}

// ==================================================================
// 🔥 2. TRIGGER CHECK (HUMAN MODE)
// ==================================================================
const lowerQuery = query.toLowerCase();
const triggers = (typeof HUMAN_TRIGGERS !== 'undefined') ? HUMAN_TRIGGERS : ["människa", "support", "prata med"];
const isHumanTrigger = triggers.some(phrase => lowerQuery.includes(phrase));

if (isHumanTrigger) {
console.log(`🚨 [HUMAN-MODE] TVINGANDE TRIGGER HITTAD (HTTP): "${query}" för session ${sessionId}`);

// Säkra session i DB
const { db } = require('./db');
await new Promise((resolve) => {
db.run(
`INSERT INTO chat_v2_state (conversation_id, session_type, human_mode, updated_at)
 VALUES (?, 'customer', 0, ?)
 ON CONFLICT(conversation_id) DO NOTHING`,
[sessionId, Math.floor(Date.now() / 1000)],
() => resolve()
);
});

// Spara meddelandet
contextData.messages.push({ role: 'user', content: query });
await upsertContextRow({
conversation_id: sessionId,
last_message_id: contextData.messages.length,
context_data: contextData,
updated_at: Math.floor(Date.now() / 1000)
});

// Aktivera human mode
await setHumanMode(sessionId, 'customer');

// Notifiera agenter
if (typeof io !== 'undefined') {
io.emit('team:update', { type: 'human_mode_triggered', sessionId });
}

// Sätt flaggor (stad/fordon)
if (isFirstMessage) {
const flags = {
vehicle: contextData.locked_context?.vehicle || null,
office: contextData.locked_context?.city || null
};
if (flags.vehicle || flags.office) {
await updateTicketFlags(sessionId, flags);
}
}

// Returnera standardsvar och AVBRYT här
return {
answer: typeof HUMAN_RESPONSE_TEXT !== 'undefined' ? HUMAN_RESPONSE_TEXT : "Jag kopplar in en mänsklig kollega direkt.",
sessionId
};
}

// ==================================================================
// 🤖 3. AI-LOGIK (Körs bara om ingen trigger hittades)
// ==================================================================

// Säkra session om den saknas
if (!v2State) {
const { db } = require('./db');
await new Promise((resolve) => {
db.run(
`INSERT INTO chat_v2_state (conversation_id, session_type, human_mode, updated_at)
 VALUES (?, 'customer', 0, ?)
 ON CONFLICT(conversation_id) DO NOTHING`,
[sessionId, Math.floor(Date.now() / 1000)],
() => resolve()
);
});
}

// Lägg till användarens fråga i historiken
contextData.messages.push({ role: 'user', content: query });

// Förbered data för motorn
const ragContext = {
locked_context: contextData.locked_context,
linksSentByVehicle: contextData.linksSentByVehicle
};

const templates = await getAllTemplates(); 

// Kör Legacy Engine
const result = await runLegacyFlow(
{ query, sessionId, isFirstMessage, sessionContext: contextData.messages },
ragContext,
templates
);

// Hantera svaret från motorn
if (result?.new_context) {
// Uppdatera variabler
if (result.new_context.locked_context) contextData.locked_context = result.new_context.locked_context;
if (result.new_context.linksSentByVehicle) contextData.linksSentByVehicle = result.new_context.linksSentByVehicle;

// Spara botens svar
const responseText = typeof result.response_payload === 'string' 
? result.response_payload 
: result.response_payload?.answer || "";

contextData.messages.push({ role: 'atlas', content: responseText });

// Spara allt till DB
await upsertContextRow({
conversation_id: sessionId,
last_message_id: contextData.messages.length,
context_data: contextData,
updated_at: Math.floor(Date.now() / 1000)
});
}

// Returnera AI-svaret
return {
answer: result?.response_payload || "",
sessionId
};
}


// STATE MANAGEMENT HELPERS
function mergeContext(prev, next) {
if (!next || typeof next !== 'object') return prev;

return {
messages: Array.isArray(next.messages) ? next.messages : prev.messages,
locked_context: next.locked_context ?? prev.locked_context,
linksSentByVehicle: next.linksSentByVehicle ?? prev.linksSentByVehicle
};
}

function assertValidContext(ctx, source = 'unknown') {
if (!ctx) {
console.warn(`⚠️ [STATE] Tom context från ${source}`);
return;
}

if (!Array.isArray(ctx.messages)) {
console.warn(`⚠️ [STATE] messages saknas eller är fel typ (${source})`);
}

if (!ctx.locked_context) {
console.warn(`⚠️ [STATE] locked_context saknas (${source})`);
}

if (!ctx.linksSentByVehicle) {
console.warn(`⚠️ [STATE] linksSentByVehicle saknas (${source})`);
}
}

// TEMPLATE CACHE MANAGEMENT
let cachedTemplates = null;
let templatesLoadedAt = 0;
const TEMPLATE_TTL = 60 * 1000;

async function getTemplatesCached() {
const now = Date.now();
if (!cachedTemplates || now - templatesLoadedAt > TEMPLATE_TTL) {
cachedTemplates = await getAllTemplates();
templatesLoadedAt = now;
}
return cachedTemplates;
}

// EXPRESS & MIDDLEWARE SETUP
const app = express();

// Raw Body Parser (för HMAC-validering)
app.use(express.json({
verify: (req, res, buf) => {
req.rawBody = buf;
}
}));

// CORS Configuration (Web/Ngrok Support)
app.use(cors({
origin: '*',
methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
allowedHeaders: ['Content-Type', 'Authorization', 'ngrok-skip-browser-warning']
}));

// Request Logger Middleware
app.use((req, res, next) => {
res.setHeader('ngrok-skip-browser-warning', 'true');

// Ignorera loggar för Inbox OCH History-polling
const isPolling = req.url === '/team/inbox' || req.url.includes('/api/customer/history');

if (!isPolling) {
console.log("🔥 INCOMING:", req.method, req.url);
}
next();
});

// SOCKET.IO SERVER SETUP
const httpServer = http.createServer(app);
const io = new Server(httpServer, {
cors: { 
origin: "*", 
methods: ["GET", "POST"],
allowedHeaders: ["ngrok-skip-browser-warning"],
credentials: true 
}
});

// Static Files & Socket.io Client Library
app.use(express.static('Renderer'));
app.use('/socket.io', express.static(require('path').join(__dirname, 'node_modules/socket.io/client-dist')));

app.get('/', (req, res) => {
res.sendFile(__dirname + '/Renderer/index.html');
});

// =============================================================================
// AUTHENTICATION ENDPOINTS
// =============================================================================

// POST /api/auth/login - User Login
app.post('/api/auth/login', async (req, res) => {
const { username, password } = req.body;

try {
const user = await getUserByUsername(username);
if (!user) {
return res.status(401).json({ error: "Ogiltigt användarnamn eller lösenord" });
}

const validPass = await bcrypt.compare(password, user.password_hash);
if (!validPass) {
return res.status(401).json({ error: "Ogiltigt användarnamn eller lösenord" });
}

// Skapa Token (Giltig 24h)
const token = jwt.sign(
{ id: user.id, username: user.username, role: user.role }, 
JWT_SECRET, 
{ expiresIn: '14d' }
);

res.json({ 
token, 
user: { id: user.id, username: user.username, role: user.role } 
});

} catch (err) {
console.error("Login error:", err);
res.status(500).json({ error: "Serverfel vid inloggning" });
}
});

// POST /api/auth/seed - Create Initial User (Development Only)
app.post('/api/auth/seed', async (req, res) => {
try {
const { username, password } = req.body;
// Endast tillåtet om inga användare finns (säkerhetsspärr kan läggas till)
const hash = await bcrypt.hash(password, 10);
await createUser(username, hash);
res.json({ message: "User created" });
} catch (err) {
res.status(500).json({ error: err.message });
}
});

// -------------------------------------------------------------------------
// ENDPOINT: // POST /api/team/reply - Send Reply via HTTP (For Scripts/Tests)
// -------------------------------------------------------------------------
app.post('/api/team/reply', authenticateToken, async (req, res) => {
try {
const { conversationId, message, role } = req.body;
const agentName = req.user.username; 

if (!conversationId || !message) {
return res.status(400).json({ error: "Missing conversationId or message" });
}

console.log(`💬 [API REPLY] ${agentName} svarar på ${conversationId}`);

// 1. Hämta befintlig kontext
const stored = await getContextRow(conversationId);

let contextData = stored?.context_data ?? { 
messages: [], 
locked_context: {},
linksSentByVehicle: {}
};

// 2. Lägg till svaret
contextData.messages.push({
role: role || 'agent', // Kan överskridas av scriptet om man vill simulera annat
content: message,
sender: agentName
});

// 3. Spara till DB
await upsertContextRow({
conversation_id: conversationId,
last_message_id: (stored?.last_message_id || 0) + 1,
context_data: contextData,
updated_at: Math.floor(Date.now() / 1000)
});

// 4. Notifiera via Socket (så att din UI uppdateras om du tittar)
if (typeof io !== 'undefined') {
io.emit('team:customer_reply', { conversationId, message });
}

// (Valfritt) Skicka till LHC om du använder det
// await sendToLHC(conversationId, message);

res.json({ status: 'success', saved_message: message });

} catch (err) {
console.error("❌ API Reply Error:", err);
res.status(500).json({ error: "Database error" });
}
});

// =============================================================================
// 5. SOCKET.IO HANTERARE (REAL-TIME CHAT)
// =============================================================================
// Middleware: Autentisering & Loggning
io.use((socket, next) => {
const token = socket.handshake.auth.token;

if (!token) {
return next(new Error("Authentication error: No token provided"));
}

jwt.verify(token, JWT_SECRET, (err, decoded) => {
if (err) {
return next(new Error("Authentication error: Invalid token"));
}
// VIKTIGT: Vi sparar user på socketen för loggning/access, 
// men vi skickar ALDRIG in detta i legacy_engine.
socket.user = decoded; 
next();
});
});

// Huvudanslutning
io.on('connection', (socket) => {
console.log(`🔌 Client connected: ${socket.id} (User: ${socket.user.username})`);

// Skicka serverinfo vid anslutning
socket.emit('server:info', { version: SERVER_VERSION });

// Event: test:echo (För debugging)
socket.on('test:echo', (data) => {
socket.emit('test:echo_response', { received: data, serverTime: Date.now() });
});

// ⌨️ KUNDEN SKRIVER (TYPING INDICATOR)
socket.on('client:typing', (payload) => {
const { sessionId } = payload;
// Skicka vidare till alla agenter att denna session skriver
io.emit('team:client_typing', { sessionId });
});

// 👇 NYTT: AGENT SKRIVER (SKICKA TILL KUND)
socket.on('team:agent_typing', (payload) => {
const { sessionId } = payload;
// Skicka vidare signalen till frontend (Loveable/AtlasChat)
io.emit('client:agent_typing', { sessionId });
});

// ==================================================================
// 💬 CLIENT:MESSAGE - HUVUDHANTERARE FÖR CHATT
// ==================================================================
socket.on('client:message', async (payload) => {
console.log(`[SOCKET] Message from ${socket.id}:`, payload.query);

try {
// 🔥 STEG 1: PLOCKA UT DATA (INKLUSIVE CONTEXT/NAMN)
// Vi hämtar 'context' här för att fånga namnet om frontend skickar det
const { query, sessionId, isFirstMessage, session_type, context } = payload;

if (!query || !sessionId) return;

// ==================================================================
// 🛠️ STEG 2: SPARA NAMN/CONTEXT DIREKT (INNAN TRIGGERS)
// Detta garanterar att "Anna Andersson" sparas även om hon triggar "Människa" direkt
// ==================================================================
if (context?.locked_context) {
console.log('🎯 [SOCKET PRE-SAVE] Sparar namn/context från socket:', context.locked_context);

// Hämta nuvarande state för att inte skriva över fel saker
let tempStored = await getContextRow(sessionId);
let tempCtx = tempStored?.context_data || { 
messages: [], 
locked_context: { city: null, area: null, vehicle: null } 
};

// Slå ihop nytt context med gammalt
tempCtx.locked_context = {
...tempCtx.locked_context,
...context.locked_context
};

// Spara omedelbart till DB
await upsertContextRow({
conversation_id: sessionId,
last_message_id: (tempStored?.last_message_id || 0),
context_data: tempCtx,
updated_at: Math.floor(Date.now() / 1000)
});
}

// ==================================================================
// 🛑 STEG 3: SÄKERHETSSPÄRRAR & TRIGGERS
// ==================================================================

// Human Mode Interceptor
const lowerQuery = query.toLowerCase();

// Skydda Hem-vyn (Privata sessioner får aldrig trigga Human Mode)
const isPrivate = session_type === 'private';

// Vi kollar triggers ENDAST om det INTE är en privat session.
const isTrigger = !isPrivate && HUMAN_TRIGGERS.some(phrase => lowerQuery.includes(phrase));

// --- 🚨 TRIGGER HITTAD (KUND VILL PRATA MED MÄNNISKA) ---
if (isTrigger) {
console.log(`[HUMAN-MODE] Trigger detected for ${sessionId}`);

// Hämta context igen (nu inkl. namnet vi nyss sparade!)
let storedContext = await getContextRow(sessionId);
let contextData = (storedContext && storedContext.context_data) 
? storedContext.context_data 
: { variables: {}, messages: [] };

// Lägg till meddelandet i historiken
contextData.messages.push({ role: 'user', content: query });

await upsertContextRow({
conversation_id: sessionId,
last_message_id: (storedContext?.last_message_id || 0) + 1,
context_data: contextData,
updated_at: Math.floor(Date.now() / 1000)
});

// Aktivera läget och meddela teamet
await setHumanMode(sessionId, 'customer');
io.emit('team:update', { type: 'human_mode_triggered', sessionId });
return; // Avbryt här, skicka inte till AI
}

// ==================================================================
// 🛡️ STEG 4: SESSION TYPE MANAGEMENT
// ==================================================================
const v2State = await getV2State(sessionId);

// Om detta är första meddelandet OCH session_type saknas...
// (Här fortsätter din befintliga kod för session_type logic)
if (isFirstMessage && (!v2State.session_type || v2State.session_type === 'customer')) {
const incomingType = payload.session_type || 'private';

// Uppdatera i databasen

const { db } = require('./db');
await new Promise((resolve, reject) => {
db.run(
`INSERT INTO chat_v2_state (conversation_id, session_type, human_mode, updated_at)
VALUES (?, ?, 0, ?)
ON CONFLICT(conversation_id) DO UPDATE SET session_type = excluded.session_type`,
[sessionId, incomingType, Math.floor(Date.now() / 1000)],
(err) => (err ? reject(err) : resolve())
);
});

console.log(`✅ [SESSION-TYPE] Satte ${sessionId} till '${incomingType}'`);
v2State.session_type = incomingType;
}

// HUMAN MODE CHECK (nu med korrekt session_type)
if (v2State?.human_mode === 1 && v2State.session_type === 'customer') {
console.log(`[HUMAN-MODE] Bot tyst (kundärende) för ${sessionId}`);
io.emit('team:update', { type: 'client_typing', sessionId });
return;
}

/* --- FIX: Hämta fullständig kontext (inkl. variabler för RAG) --- */
const now = Math.floor(Date.now() / 1000);
let storedContext = await getContextRow(sessionId);

// ✅ Tre toppnivå-nycklar istället för variables-wrapper
let contextData = { 
messages: [], 
locked_context: { city: null, area: null, vehicle: null },
linksSentByVehicle: { AM: false, MC: false, CAR: false, INTRO: false, RISK1: false, RISK2: false }
};

if (storedContext && storedContext.context_data) {
contextData = storedContext.context_data;
// Säkerställ att alla nycklar finns
if (!contextData.messages) contextData.messages = [];
if (!contextData.locked_context) contextData.locked_context = { city: null, area: null, vehicle: null };
if (!contextData.linksSentByVehicle) contextData.linksSentByVehicle = { AM: false, MC: false, CAR: false, INTRO: false, RISK1: false, RISK2: false };
}


// Skicka endast RAG-variabler (inte messages)
const ragContext = {
locked_context: contextData.locked_context,
linksSentByVehicle: contextData.linksSentByVehicle
};

console.log("------------------------------------------");
console.log("RAG INPUT (Ska innehålla locked_context + linksSentByVehicle):", JSON.stringify(ragContext));
console.log("------------------------------------------");

contextData.messages.push({ role: 'user', content: query });
const templates = await getTemplatesCached();

// 3. Kör motorn
const result = await runLegacyFlow(
{ query, sessionId, isFirstMessage, sessionContext: contextData.messages },
ragContext,
templates
);

// ✅ DEBUG: Logga RAW result
console.log("🔍 [DEBUG] runLegacyFlow result:", JSON.stringify({
has_response_payload: !!result.response_payload,
has_new_context: !!result.new_context,
response_type: typeof result.response_payload,
first_100_chars: typeof result.response_payload === 'string' 
? result.response_payload.substring(0, 100)
: JSON.stringify(result.response_payload).substring(0, 100)
}));

/* --- SÄKERHETSKONTROLL --- */
if (result.new_context?.locked_context) {
console.log("✅ MOTORN RETURNERADE STATE:", JSON.stringify(result.new_context.locked_context));
} else {
console.log("⚠️ VARNING: Motorn returnerade inget locked_context!");
}

/* --- UPPDATERA VARIABLER 1/2: SÄKRAD RAG-ÅTERFÖRING --- */
// ✅ 26/12 Synka ALLA fält från motorn OBS SKALL FINNAS ÄVEN LÄNGRE NER, TA INTE BORT!
assertValidContext(result.new_context, 'ragSync');
contextData = mergeContext(contextData, result.new_context);

// ------------------------------------------------------------------
// 🎯 METADATA-FLAGGOR – sätts ENDAST vid första kundmeddelandet 27/12
// ------------------------------------------------------------------
if (
isFirstMessage === true &&
v2State.session_type === 'customer'
) {
const flags = {
vehicle: contextData.locked_context?.vehicle || null,
office: contextData.locked_context?.city || null
// topic används inte nu – medvetet tom
};

// Sätt endast flaggor som faktiskt finns
const hasAnyFlag = Object.values(flags).some(v => v !== null);

if (hasAnyFlag) {
console.log('🏷️ [TICKET FLAGS] Sätter initial metadata:', flags);
await updateTicketFlags(sessionId, flags);
}
}

console.log("------------------------------------------");
console.log("📥 EFTER SYNK:", JSON.stringify({
locked_context: contextData.locked_context,
messages_count: contextData.messages.length
}));
console.log("------------------------------------------");

// Extrahera svaret säkert
let responseText = (typeof result.response_payload === 'string')
? result.response_payload
: (result.response_payload?.answer || "Inget svar tillgängligt");

// DEBUG: Verifiera att vi har ett svar
console.log("🔍 [DEBUG] responseText extracted:", responseText.substring(0, 100));

contextData.messages.push({ role: 'atlas', content: responseText });

// 4. SPARA TILL DATABAS (V2-struktur)
await upsertContextRow({
conversation_id: sessionId,
last_message_id: (storedContext?.last_message_id || 0) + 1,
context_data: contextData,
updated_at: Math.floor(Date.now() / 1000)
});

console.log("📤 [SOCKET] Skickar svar till klient:", {
answer_length: responseText.length,
sessionId: sessionId,
has_locked_context: !!contextData.locked_context
});

socket.emit('server:answer', {
answer: responseText,
sessionId: sessionId,
locked_context: contextData.locked_context
});

console.log("✅ [SOCKET] Svar skickat!");

// 🔒 KRITISK GUARD: Endast kundärenden får trigga Team Inbox
if (v2State.session_type === 'customer') {

// 1. 🔥 NYTT: Skicka meddelandet direkt till Agentens öppna chattfönster
// Detta gör att bubblan dyker upp direkt hos Patric!
io.emit('team:customer_reply', {
conversationId: sessionId,
message: query,
sender: 'user', // Anger att det är kundens färg (grå)
timestamp: Date.now()
});

// 2. Uppdatera listor och badges
io.emit('team:update', { type: 'new_message', sessionId });
}

} catch (err) {
console.error("❌ Socket Error:", err);
}
}); // 👈 SLUT på socket.on('client:message')

// ==================================================
// 🧑‍💼 AGENT → CUSTOMER (MINI-CHAT LIVE)
// ==================================================
socket.on('team:agent_reply', async (payload) => {
try {
const { conversationId, message } = payload;
if (!conversationId || !message) return;

console.log(`💬 [AGENT REPLY] ${conversationId}: ${message}`);

const stored = await getContextRow(conversationId);
let contextData = stored?.context_data ?? { messages: [], locked_context: {} };

contextData.messages.push({ role: 'agent', content: message });

await upsertContextRow({
conversation_id: conversationId,
last_message_id: (stored?.last_message_id || 0) + 1,
context_data: contextData,
updated_at: Math.floor(Date.now() / 1000)
});

// Hämta agentens namn från socket-sessionen (fallback till 'Support' om det saknas)
const agentName = socket.user?.username || 'Support';

// 🔥 SKICKA TILL FRONTEND DIREKT
io.emit('team:customer_reply', {
conversationId,
message,
sender: agentName, // <--- Nu skickar vi "Patric" eller "Nathalie"
timestamp: Date.now()
});

// 🛡️ LHC-sync (fångar fel så det inte stoppar din chatt)
try {
await sendToLHC(conversationId, message);
} catch (lhcErr) {
console.warn("⚠️ LHC Sync misslyckades, men meddelandet är skickat till frontend.");
}

} catch (err) {
console.error('❌ [AGENT REPLY ERROR]', err);
}
});

// ==================================================
// 🚪 KUNDEN AVSLUTAR CHATTEN
// ==================================================
socket.on('client:end_chat', async (payload) => {
// Säkra upp så vi hittar ID oavsett vad frontend kallar det
const sessionId = payload.sessionId || payload.conversationId;

if (!sessionId) return; // Avbryt om ID saknas helt
console.log(`[CHAT] Customer ended session ${sessionId}`);

// 1. Lägg till systemmeddelande i DB
const stored = await getContextRow(sessionId);
let contextData = stored?.context_data || { messages: [] };

contextData.messages.push({
role: 'system', // Ny roll för systemhändelser
content: '⚠️ Kunden har avslutat chatten.',
timestamp: Date.now()
});

await upsertContextRow({
conversation_id: sessionId,
last_message_id: (stored?.last_message_id || 0) + 1,
context_data: contextData,
updated_at: Math.floor(Date.now() / 1000)
});

// 2. Meddela Agenten direkt (så texten dyker upp i chattfönstret)
io.emit('team:customer_reply', {
conversationId: sessionId,
message: '⚠️ Kunden har avslutat chatten.', // Texten agenten ser
sender: 'System',
type: 'system_info'
});
});

socket.on('disconnect', () => {
console.log('🔌 Disconnected:', socket.id);
});

}); // 👈 Detta är slutet på io.on('connection')

// sendToLHC - Skickar kopia till LiveHelperChat (om konfigurerad)
async function sendToLHC(chatId, message, retries = 3) {
if (!message) return;

// Om du har kvar "temp_secret" i .env så avbryter vi här direkt
if (process.env.LHC_WEBHOOK_SECRET === 'temp_secret_12345' || !process.env.LHC_API_URL) {
return; 
}

const messageText = typeof message === 'string' ? message : (message?.answer || 'Inget svar');
const url = `${process.env.LHC_API_URL}/restapi/v2/chat/sendmessage/${chatId}`;
const auth = Buffer.from(`${process.env.LHC_API_USER}:${process.env.LHC_API_KEY}`).toString('base64');

for (let attempt = 1; attempt <= retries; attempt++) {
try {
const response = await fetch(url, {
method: 'POST',
headers: { 'Authorization': `Basic ${auth}`, 'Content-Type': 'application/json' },
body: JSON.stringify({ msg: messageText })
});
if (response.ok) return;
} catch (err) {
if (attempt === retries) console.log(`[LHC] Kunde inte nå externa LHC för ${chatId}`);
else await new Promise(r => setTimeout(r, 1000 * attempt));
}
}
}

// -------------------------------------------------------------------------
// AUTH MIDDLEWARE (TEAM) - HÅRDAD
// -------------------------------------------------------------------------

// JWT Token Verification for Team Routes
function authenticateToken(req, res, next) {
const authHeader = req.headers['authorization'];
const token = authHeader && authHeader.split(' ')[1]; // Format: "Bearer TOKEN"

if (token == null) return res.status(401).json({ error: 'Auth required' });

jwt.verify(token, JWT_SECRET, (err, user) => {
if (err) return res.status(403).json({ error: 'Invalid token' });
req.user = user; // Nu vet vi vem som anropar!
next();
});
}

// -------------------------------------------------------------------------
// // HMAC Signature Verification (Webhook Security)
// -------------------------------------------------------------------------
const SIGNATURE_HEADER = 'x-signature';

function verifyHmac(req) {
const signature = req.headers[SIGNATURE_HEADER];
if (!signature) return false;

const secret = process.env.LHC_WEBHOOK_SECRET;
if (!secret) return false;

const computed = crypto
.createHmac('sha256', secret)
.update(req.rawBody)
.digest('hex');

try {
return crypto.timingSafeEqual(
Buffer.from(signature, 'hex'),
Buffer.from(computed, 'hex')
);
} catch {
return false;
}
}

// =============================================================================
// CLIENT API ENDPOINTS
// =============================================================================

// -------------------------------------------------------------------------
// ENDPOINT: // POST /search_all - Renderer Client Search (Requires API Key)
// -------------------------------------------------------------------------
app.post('/search_all', async (req, res) => {
console.log("🧪 /search_all HIT", req.body);
const clientKey = req.headers['x-api-key'];
if (clientKey !== process.env.CLIENT_API_KEY) {
return res.status(401).json({ error: 'Ogiltig API-nyckel' });
}
try {
const { query, sessionId, isFirstMessage } = req.body;
if (!query || !query.trim()) return res.status(400).json({ error: 'Tom fråga' });
if (!sessionId) return res.status(400).json({ error: 'sessionId saknas' });

const now = Math.floor(Date.now() / 1000);
const TTL_SECONDS = 60 * 60 * 24 * 30;

let storedContext = await getContextRow(sessionId);

let contextData = { 
messages: [], 
locked_context: { city: null, area: null, vehicle: null },
linksSentByVehicle: { AM: false, MC: false, CAR: false, INTRO: false, RISK1: false, RISK2: false }
};

let lastMessageId = 0;

if (!storedContext || storedContext.updated_at < now - TTL_SECONDS) {
console.log(`[SESSION] Ny/Reset: ${sessionId}`);
} else {
if (storedContext.context_data) {
contextData = storedContext.context_data;
// Säkerställ att alla nycklar finns
if (!contextData.messages) contextData.messages = [];
if (!contextData.locked_context) contextData.locked_context = { city: null, area: null, vehicle: null };
if (!contextData.linksSentByVehicle) contextData.linksSentByVehicle = { AM: false, MC: false, CAR: false, INTRO: false, RISK1: false, RISK2: false };
}
lastMessageId = storedContext.last_message_id || 0;
}

// 1. Lägg till USER query i historiken
contextData.messages.push({ role: 'user', content: query });

const templates = await getTemplatesCached();

// 2. Kör legacy flow 26/12
const result = await runLegacyFlow(
{ query, sessionId, isFirstMessage, sessionContext: contextData.messages }, 
contextData,  // ✅ HELA OBJEKTET
templates
);

// 3. EXTRAHERA SVARET TILL TEXT (Kritisk fix för "text.replace error")
let responseText = "";
if (typeof result.response_payload === 'string') {
responseText = result.response_payload;
} else if (result.response_payload && result.response_payload.answer) {
responseText = result.response_payload.answer;
} else {
responseText = JSON.stringify(result.response_payload);
}

// 4. Lägg till ATLAS svar i historiken
contextData.messages.push({ role: 'atlas', content: responseText });

/* --- UPPDATERA VARIABLER: 2/2 SÄKRAD RAG-ÅTERFÖRING --- */
assertValidContext(result.new_context, 'ragSync');
contextData = mergeContext(contextData, result.new_context);


// 5. Spara state
await upsertContextRow({
conversation_id: sessionId,
last_message_id: lastMessageId + 1,
context_data: contextData,
updated_at: now
});

// 6. Skicka rent svar till frontend
res.json({
answer: responseText,
sessionId: sessionId,
locked_context: contextData.locked_context,  // ✅ RÄTT!
context: result.response_payload?.context || []
});

} catch (err) {
console.error("❌ /search_all ERROR", err);
res.status(500).json({ error: "Internal Server Error" });
}
});

// =============================================================================
// TEAM MANAGEMENT ENDPOINTS
// =============================================================================
// -------------------------------------------------------------------------
// ENDPOINT: // GET /team/inbox - Fetch Unclaimed Tickets (Human Mode)
// -------------------------------------------------------------------------
// SYFTE:
// - Visa alla ärenden som:
//   • är i human_mode = 1
//   • INTE är claimade (owner IS NULL)
// - Inboxen är READ-ONLY och får ALDRIG innehålla claim-logik
//
// ⚠️ RÖR-INTE-VARNING TILL LLM:
// - Lägg INTE till session_type-filter här
// - Lägg INTE till owner != NULL
// - Inboxen ska visa "vad som väntar", inget annat
// -------------------------------------------------------------------------
app.get('/team/inbox', authenticateToken, async (req, res) => {
try {
const { db } = require('./db');

// 1. Hämta alla ärenden som är human_mode = 1 och inte arkiverade
const tickets = await new Promise((resolve, reject) => {
db.all(`
SELECT conversation_id, session_type, human_mode, owner, updated_at 
FROM chat_v2_state 
WHERE human_mode = 1 AND (is_archived IS NULL OR is_archived = 0)
ORDER BY updated_at DESC
`, [], (err, rows) => err ? reject(err) : resolve(rows));
});

// 2. Koppla på Rubrik, Namn, E-post från context_store
const ticketsWithData = await Promise.all(
tickets.map(async (t) => {
const stored = await getContextRow(t.conversation_id);
const ctx = stored?.context_data || {};
const locked = ctx.locked_context || {};
const messages = ctx.messages || [];

// Hitta sista meddelandet för preview
let lastMsg = "Ingen text";
if (messages.length > 0) {
const lastUserMsg = [...messages].reverse().find(m => m.role === 'user');
if (lastUserMsg) lastMsg = lastUserMsg.content;
else lastMsg = messages[messages.length - 1].content;
}

return {
...t,
messages, // Behövs för chatt-vyn
last_message: lastMsg,
// Extrahera formulärdata
subject: locked.subject || null,
contact_email: locked.email || null,
contact_phone: locked.phone || null,
contact_name: locked.name || null
};
})
);

res.json({ tickets: ticketsWithData });

} catch (err) {
console.error("[TEAM] Inbox error:", err);
res.status(500).json({ error: "Database error" });
}
});

// -------------------------------------------------------------------------
// ENDPOINT: // POST /team/claim - Claim Ticket (Atomic Operation)
// -------------------------------------------------------------------------
// SYFTE:
// - Försöka ta ägarskap på ett ärende
// - DB-state EFTER operationen är den enda sanningen
// - BLOCKERA privata sessioner från att plockas
//
// 🔒 SÄKERHET:
// - Atomisk WHERE-clause: endast olåsta ärenden kan claimas
// - Validerar session_type: privata ärenden nekas direkt
// - Returnerar 409 (Conflict) om redan plockat
// -------------------------------------------------------------------------
app.post('/team/claim', async (req, res) => {
try {
// 1. Hämta data från body (main.js skickar conversationId & agentName)
const { conversationId, agentName } = req.body;

if (!conversationId) {
return res.status(400).json({ error: "Missing conversationId" });
}

// 2. Bestäm vem som plockar ärendet
// Prioritera namnet som skickades med (från Electron), annars fallback
const finalAgentName = agentName || (req.user ? req.user.username : 'Agent');

console.log(`[TEAM] Försöker claima ${conversationId} som ${finalAgentName}...`);

// 3. Importera din fixade funktion från db.js
const { claimTicket, getV2State } = require('./db');

// 4. Kontrollera sessionstyp (Säkerhet)
const preState = await getV2State(conversationId);
if (preState?.session_type === 'private') {
return res.status(403).json({ 
error: "Kan inte plocka privata sessioner",
session_type: 'private'
});
}

// 5. Kör claimTicket (som vi vet fungerar och tillåter övertagande)
await claimTicket(conversationId, finalAgentName);

// 6. Hämta nya statusen för att bekräfta
const postState = await getV2State(conversationId);

if (postState?.owner === finalAgentName) {
console.log(`[TEAM] ✅ ${finalAgentName} tog ärendet ${conversationId}`);

// Meddela alla klienter att ärendet är plockat
if (typeof io !== 'undefined') {
io.emit('team:update', {
type: 'ticket_claimed',
sessionId: conversationId,
owner: finalAgentName
});
}

return res.json({
status: "success",
owner: finalAgentName,
session_type: postState.session_type
});
} else {
throw new Error("Ägarskapet uppdaterades inte korrekt i databasen.");
}

} catch (err) {
console.error("❌ Claim error:", err);
// Skicka 500 så main.js fattar att det gick fel
res.status(500).json({ error: "Failed to claim ticket" });
}
});

// -------------------------------------------------------------------------
// ENDPOINT: // GET /team/my-tickets - Fetch Agent's Claimed Tickets
// SYFTE: Hämta ärenden som ägs av den inloggade agenten
// -------------------------------------------------------------------------
app.get('/team/my-tickets', authenticateToken, async (req, res) => {
try {
// Säkra agent-namn
const agentName = req.teamUser || (req.user ? req.user.username : null);

if (!agentName) {
return res.status(400).json({ error: "Agent identity missing" });
}

// 1. Hämta agentens ärenden
const tickets = await getAgentTickets(agentName);

// 2. Koppla på meddelandehistorik OCH NAMN
const ticketsWithMessages = await Promise.all(
tickets.map(async (t) => {
const stored = await getContextRow(t.conversation_id);
const ctx = stored?.context_data || {};
const messages = ctx.messages || [];
const locked = ctx.locked_context || {};

return {
	...t,
	messages,
	last_message: messages.length > 0 ? messages[messages.length - 1].content : "Ingen text",
	// 🔥 NYTT: Skicka med kontaktinfo så frontend kan visa "Anna Andersson"
	contact_name: locked.name || null,
	contact_email: locked.email || null,
	contact_phone: locked.phone || null,
	subject: locked.subject || null
};
})
);

res.json({ tickets: ticketsWithMessages });

} catch (err) {
console.error("[TEAM] My Tickets error:", err);
res.status(500).json({ error: "Database error" });
}
});

// =============================================================================
// TEMPLATE MANAGEMENT ENDPOINTS
// =============================================================================

// -------------------------------------------------------------------------
// ENDPOINT: // GET /api/templates - Fetch All Templates (For Electron IPC)
// -------------------------------------------------------------------------
app.get('/api/templates', async (req, res) => {
try {
const templates = await getTemplatesCached();
res.json(templates);
} catch (err) {
console.error("[TEMPLATES] Load error:", err);
res.status(500).json({ error: "Database error" });
}
});

// -------------------------------------------------------------------------
// ENDPOINT: /api/templates/save (SPARA/UPPDATERA MALL VIA WEBB)
// -------------------------------------------------------------------------
app.post('/api/templates/save', authenticateToken, (req, res) => {
const { id, title, content, group_name } = req.body;
const { db } = require('./db'); 

const sql = `
INSERT INTO templates (id, title, content, group_name) 
VALUES (?, ?, ?, ?)
ON CONFLICT(id) DO UPDATE SET 
title = excluded.title, 
content = excluded.content, 
group_name = excluded.group_name
`;

// Använd id från body eller skapa nytt om det saknas
const finalId = id || Date.now();

db.run(sql, [finalId, title, content, group_name], function(err) {
if (err) {
console.error("Template Save Error:", err);
return res.status(500).json({ error: "Kunde inte spara mallen" });
}

cachedTemplates = null; // Rensa cachen (om variabeln finns globalt)
res.json({ status: 'success' });
});
});

// =====================================================================
// 🌍 PUBLIC CUSTOMER CHAT ENDPOINT (NO AUTH, NO SOCKET, SAFE)
// =====================================================================
app.post("/api/customer/message", async (req, res) => {
try {
const { sessionId, message } = req.body;

if (!sessionId || !message) {
return res.status(400).json({
error: "sessionId and message are required"
});
}

const { db } = require('./db');
const now = Math.floor(Date.now() / 1000);

// 1. KONTROLLERA HUMAN MODE STATUS
const v2State = await getV2State(sessionId);

// --- 🛑 GATEKEEPER: OM HUMAN MODE ÄR PÅ ---
if (v2State && v2State.human_mode === 1) {
console.log(`🛑 [HUMAN-MODE ACTIVE] Hoppar över AI för ${sessionId}. Notifierar agent.`);

// A. Spara kundens meddelande i historiken (utan AI-svar)
let storedContext = await getContextRow(sessionId);
let contextData = (storedContext && storedContext.context_data) 
? storedContext.context_data 
: { messages: [], locked_context: { city: null, area: null, vehicle: null } };

// Säkerställ array
if (!contextData.messages) contextData.messages = [];

contextData.messages.push({ role: 'user', content: message });

await upsertContextRow({
conversation_id: sessionId,
last_message_id: (storedContext?.last_message_id || 0) + 1,
context_data: contextData,
updated_at: now
});

// B. Meddela agenten via Socket (så det plingar till i Atlas)
if (typeof io !== 'undefined') {
  // Bakåtkompatibilitet (äldre renderer-versioner kan lyssna på denna)
  io.emit('team:customer_message', {
    conversationId: sessionId,
    message: message,
    sender: 'user',
    timestamp: now,
  });

  // ✅ Standardiserat event som renderer redan lyssnar på
  io.emit('team:customer_reply', {
    conversationId: sessionId,
    message: message,
    sender: 'user',
    timestamp: now,
  });

  // Uppdatera listan så ärendet hoppar upp
  io.emit('team:update', { type: 'new_message', sessionId });
}

// C. Svara klienten att det är mottaget (inget AI-svar)
return res.json({ 
success: true, 
status: 'forwarded_to_agent', 
human_mode: true 
});
}

// --- 🤖 OM INTE HUMAN MODE: KÖR AI SOM VANLIGT ---

// 2. Kolla snabbt om det finns historik sedan tidigare
const stored = await getContextRow(sessionId);

// Vi kollar djupt i objektet för att vara säkra
const hasHistory = stored && 
stored.context_data && 
stored.context_data.messages && 
stored.context_data.messages.length > 0;

// 3. Skicka till chat-hanteraren (AI)
const response = await handleChatMessage({
query: message,
sessionId,
isFirstMessage: !hasHistory, // ✅ TRUE endast om historik saknas
session_type: "customer",    // ⚠️ KRITISK – styr inbox, routing, human_mode
providedContext: req.body.context
});

res.json(response);

} catch (err) {
console.error("❌ Customer chat endpoint error:", err);
res.status(500).json({
error: "Internal server error"
});
}
});

// =====================================================================
// 📥 GET HISTORY (För Loveable Pollning)
// =====================================================================
app.get("/api/customer/history/:sessionId", async (req, res) => {
try {
const { sessionId } = req.params;
const stored = await getContextRow(sessionId);
const state = await getV2State(sessionId);

// Säkerställ att vi alltid returnerar en array
const messages = stored?.context_data?.messages || [];

res.json({
success: true,
history: messages,   // För Loveable/Framtida bruk
messages: messages,  // För din nuvarande renderer.js rad 343
human_mode: state?.human_mode === 1
});
} catch (err) {
console.error("❌ History API Error:", err);
res.status(500).json({ error: "Internt serverfel" });
}
});

// =====================================================================
// 📨 CUSTOMER MESSAGE FORM (NO CHAT, NO SOCKET, INBOX ONLY)
// =====================================================================
app.post("/api/customer/message-form", async (req, res) => {
try {
const { name, email, phone, subject, message } = req.body;

if (!name || !email || !message) {
return res.status(400).json({
error: "name, email and message are required"
});
}

// Skapa ett unikt ärende-id
const conversationId = crypto.randomUUID();

const now = Math.floor(Date.now() / 1000);

// Spara som nytt ärende i chat_v2_state (meddelande, ej chatt)
const { db } = require("./db");

await new Promise((resolve, reject) => {
db.run(
`
INSERT INTO chat_v2_state (
conversation_id,
session_type,
human_mode,
updated_at
) VALUES (?, 'message', 1, ?)
`,
[conversationId, now],
err => (err ? reject(err) : resolve())
);
});

// Spara själva meddelandet i context_store
await upsertContextRow({
conversation_id: conversationId,
last_message_id: 1,
context_data: {
messages: [
{
role: "user",
content: message
}
],
locked_context: {
name,
email,
phone,
subject
}
},
updated_at: now
});

// 🔔 Uppdatera inbox i realtid
io.emit("team:update", {
type: "new_message",
sessionId: conversationId
});

res.json({
success: true,
sessionId: conversationId
});

} catch (err) {
console.error("❌ Message form error:", err);
res.status(500).json({
error: "Internal server error"
});
}
});


// =============================================================================
// INBOX MANAGEMENT ENDPOINTS
// =============================================================================

// -------------------------------------------------------------------------
// ENDPOINT: /api/inbox/delete (RADERA FRÅGA VIA WEBB)
// -------------------------------------------------------------------------
app.post('/api/inbox/delete', authenticateToken, (req, res) => {
const { conversationId } = req.body;
const { db } = require('./db');

db.serialize(() => {
// 1. Ta bort från context_store
db.run(`DELETE FROM context_store WHERE conversation_id = ?`, [conversationId]);

// 2. Ta bort från chat_v2_state (och skicka svar när detta är klart)
db.run(`DELETE FROM chat_v2_state WHERE conversation_id = ?`, [conversationId], function(err) {
if (err) {
console.error("Delete Error:", err);
return res.status(500).json({ error: "Kunde inte radera ärendet" });
}

// Skicka socket-event om io är definierat
if (typeof io !== 'undefined') {
io.emit('team:update', { type: 'inbox_cleared', sessionId: conversationId });
}

res.json({ status: 'success' });
});
});
});

// -------------------------------------------------------------------------
// ENDPOINT: /api/inbox/archive (ARKIVERA UTAN ATT RADERA)
// -------------------------------------------------------------------------
app.post('/api/inbox/archive', authenticateToken, (req, res) => {
const { conversationId } = req.body;

if (!conversationId) {
return res.status(400).json({ error: "Missing conversationId" });
}

const { db } = require('./db');
const now = Math.floor(Date.now() / 1000);

// 🔥 FIX: Sätter is_archived = 1 i BÅDE chat_v2_state OCH local_qa_history
db.serialize(() => {
// 1. Uppdatera chat_v2_state (om ärendet finns där)
db.run(`
UPDATE chat_v2_state 
SET is_archived = 1, 
updated_at = ?
WHERE conversation_id = ?
`, [now, conversationId], function(err) {
if (err) {
console.error("Archive Error (chat_v2_state):", err);
return res.status(500).json({ error: "Kunde inte arkivera ärendet" });
}

const stateChanges = this.changes;

// 2. Uppdatera local_qa_history (om ärendet finns där)
db.run(`
UPDATE local_qa_history 
SET is_archived = 1
WHERE id = ?
`, [conversationId], function(err) {
if (err) {
console.error("Archive Error (local_qa_history):", err);
// Fortsätt ändå - det kanske bara fanns i en tabell
}

const historyChanges = this.changes;

// 3. Verifiera att minst EN rad påverkades
if (stateChanges === 0 && historyChanges === 0) {
console.warn(`⚠️ Archive: Ingen rad påverkades för ${conversationId}`);
return res.status(404).json({ 
error: "Ärendet hittades inte i databasen",
conversationId 
});
}

// 4. Success - meddela teamet OCH kunden
console.log(`✅ Arkiverade ${conversationId} (state: ${stateChanges}, history: ${historyChanges})`);

if (typeof io !== 'undefined') {
// A. Meddela alla AGENTER (Uppdatera Atlas dashboard)
io.emit('team:update', { 
type: 'ticket_archived', 
sessionId: conversationId 
});

// B. 🔥 NYTT: Meddela KUNDEN (Lovable) att chatten är avslutad
// Detta gör att Lovable låser inmatningsfältet.
io.emit('team:session_status', {
conversationId: conversationId,
status: 'archived',
message: 'Handläggaren har avslutat denna konversation.'
});
}

res.json({ 
status: 'success',
changes: stateChanges + historyChanges
});
});
});
});
});

// -------------------------------------------------------------------------
// ENDPOINT: /api/archive (KORRIGERAD: CALLBACK ISTÄLLET FÖR AWAIT)
//(Uppgraderad med Metadata för Filter)
// -------------------------------------------------------------------------
app.get('/api/archive', authenticateToken, (req, res) => {
const { db } = require('./db'); 

// Vi hämtar data och JOINAR för att få metadata
const sql = `
SELECT 
s.conversation_id,
s.updated_at,
s.owner,
s.session_type,  -- <--- VIKTIG: Skiljer på Chatt och Mail
c.context_data
FROM chat_v2_state s
LEFT JOIN context_store c ON s.conversation_id = c.conversation_id
WHERE s.is_archived = 1
ORDER BY s.updated_at DESC
LIMIT 500
`;

db.all(sql, [], (err, rows) => {
if (err) {
console.error("Archive DB Error:", err);
return res.status(500).json({ error: "Kunde inte ladda arkivet" });
}

const cleanRows = rows.map(row => {
let ctx = {};
try { ctx = JSON.parse(row.context_data); } catch(e) {}
const locked = ctx.locked_context || {};

// Hitta kundens fråga/meddelande
let question = "Inget meddelande";
if (ctx.messages && ctx.messages.length > 0) {
// För mail är det ofta det första meddelandet
const firstUser = ctx.messages.find(m => m.role === 'user');
if (firstUser) question = firstUser.content;
} else if (locked.subject) {
question = locked.subject; // Fallback för mail
}

return {
conversation_id: row.conversation_id,
timestamp: row.updated_at * 1000,
owner: row.owner,
session_type: row.session_type, // 'message' eller 'customer'
question: question,
answer: ctx.messages ? JSON.stringify(ctx.messages) : "[]",

// Metadata för filter
city: locked.city || null,
vehicle: locked.vehicle || null,
subject: locked.subject || null
};
});

res.json({ archive: cleanRows });
});
});

// -------------------------------------------------------------------------
// ENDPOINT: WEBHOOK (LHC) – KORRIGERAD ENLIGT TCD
// -------------------------------------------------------------------------
app.post('/webhook/lhc-chat', async (req, res) => {
try {
// 1. HMAC
if (!verifyHmac(req)) {
console.warn("⛔ HMAC verification failed");
return res.status(403).send("Forbidden");
}

const { chat_id, id: incomingId, msg, type: ingestType } = req.body;

// 2. TCD Modul 3: Explicit Ingest Check (MJUKARE VALIDERING)
if (!ingestType || (ingestType !== 'chat' && ingestType !== 'mail')) {
console.error(`[WEBHOOK] Okänd eller saknad ingest-typ: "${ingestType}". Avbryter enligt TCD Sektion 3.`);
return res.status(400).json({ 
error: 'Invalid or missing ingest type',
received: ingestType 
});
}

// Validering
if (!chat_id || !incomingId || !msg) {
return res.json({});
}

// 3. Idempotens
const stored = await getContextRow(chat_id);
const lastMessageId = stored?.last_message_id ?? 0;
if (incomingId <= lastMessageId) {
return res.json({});
}

// 4. Human-Mode Interceptor
const v2State = await getV2State(chat_id);

// A) Redan i Human Mode?
if (v2State && v2State.human_mode === 1) {
console.log(`[HUMAN-MODE] ${chat_id} aktiv. Tyst passivitet från bot.`);
return res.json({}); // Boten gör inget, människa har kontrollen
}

// B) Triggas Human Mode nu?
const lowerMsg = msg.toLowerCase();
const isTrigger = HUMAN_TRIGGERS.some(phrase => lowerMsg.includes(phrase));

if (isTrigger) {
console.log(`[HUMAN-MODE] Aktiveras för ${chat_id}`);

// 1. Spara meddelandet i historiken så att det syns i din Team-kö
let storedContext = await getContextRow(chat_id);
let contextData = (storedContext && storedContext.context_data) 
? storedContext.context_data 
: { variables: {}, messages: [] };

contextData.messages.push({ role: 'user', content: msg });

await upsertContextRow({
conversation_id: chat_id,
last_message_id: incomingId,
context_data: contextData,
updated_at: Math.floor(Date.now() / 1000)
});

// 2. Aktivera mänskligt läge
await setHumanMode(chat_id, 'customer');

// 3. Skicka bekräftelse till kunden i LHC
await sendToLHC(chat_id, HUMAN_RESPONSE_TEXT);

// 4. Meddela din Electron-app i realtid
io.emit('team:update', { type: 'human_mode_triggered', sessionId: chat_id });

return res.json({}); 
}

// 5. RAG Engine
const now = Math.floor(Date.now() / 1000);
const TTL_SECONDS = 60 * 60 * 24 * 30;

// Extrahera ENBART variablerna (RAG-minnet) från den lagrade kontexten
let ragVariables = {};

// ✅ Använd hela context_data
if (stored && stored.context_data && (now - stored.updated_at) <= TTL_SECONDS) {
ragVariables = stored.context_data;
}

const templates = await getTemplatesCached();

const result = await runLegacyFlow(
{ query: msg, sessionId: chat_id, isFirstMessage: false },
ragVariables, // <--- NU skickas rätt objekt in (city, vehicle etc.)
templates
);

// 6. Hantera Svar
if (result.response_payload === "ESKALERA") {
// Tystnad vid eskalering
return res.json({});
}

// Skapa ett objekt som håller både minne (variables) och historik (messages)
// ✅ 26/12 Bygg från motorn + gamla meddelanden
const updatedContextData = {
messages: (stored && stored.context_data && stored.context_data.messages) ? stored.context_data.messages : [],
locked_context: result.new_context?.locked_context || ragVariables?.locked_context || { city: null, area: null, vehicle: null },
linksSentByVehicle: result.new_context?.linksSentByVehicle || ragVariables?.linksSentByVehicle || { AM: false, MC: false, CAR: false, INTRO: false, RISK1: false, RISK2: false }
};

// Lägg till det aktuella meddelandet från kunden och Atlas svar i historiken
updatedContextData.messages.push({ role: 'user', content: msg });
updatedContextData.messages.push({ role: 'atlas', content: result.response_payload });

// Spara ALLT till databasen
await upsertContextRow({
conversation_id: chat_id,
last_message_id: incomingId,
context_data: updatedContextData, 
updated_at: now
});

// 👇 NY LOGIK: Sätt session_type till 'bot' om human_mode inte är aktivt
if (!v2State || v2State.human_mode !== 1) {
const { db } = require('./db');
await new Promise((resolve) => {
db.run(
`INSERT INTO chat_v2_state (conversation_id, session_type, human_mode, updated_at)
VALUES (?, 'bot', 0, ?)
ON CONFLICT(conversation_id) DO UPDATE SET session_type = 'bot'`,
[chat_id, now],
() => resolve()
);
});
}

// TCD Modul 2: Skicka svar via REST API (MED SÄKER TEXTEXTRAKTION)
await sendToLHC(chat_id, result.response_payload);

// NYTT: Meddela teamet om webhook-trafik
io.emit('team:update', { type: 'webhook_event', sessionId: chat_id });

// Kvittera webhook
res.json({});

} catch (err) {
console.error("Webhook error:", err);
res.status(500).send("Server Error");
}
});

// =============================================================================
// 📅 AUTOMATISK MÅNADSEXPORT (CSV)
// =============================================================================
const fs = require('fs');
const path = require('path');

function runMonthlyExport() {
const today = new Date();
// Kör bara om det är den 1:a i månaden
if (today.getDate() !== 1) return; 

const lastMonth = new Date();
lastMonth.setMonth(lastMonth.getMonth() - 1);
const yyyy = lastMonth.getFullYear();
const mm = String(lastMonth.getMonth() + 1).padStart(2, '0');

const filename = `atlas_archive_${yyyy}_${mm}.csv`;
// Skapar exports-mappen i samma mapp som server.js
const exportDir = path.join(__dirname, 'exports');
const exportPath = path.join(exportDir, filename);

// Skapa mapp om den inte finns
if (!fs.existsSync(exportDir)) {
fs.mkdirSync(exportDir);
}

// Kolla om filen redan finns (så vi inte skriver över/dubblerar)
if (fs.existsSync(exportPath)) return;

console.log(`[EXPORT] Påbörjar månadsexport för ${yyyy}-${mm}...`);

const { db } = require('./db');

// Hämta förra månadens arkiverade ärenden från chat_v2_state
db.all(`
SELECT 
s.conversation_id, 
s.owner, 
s.updated_at,
c.context_data
FROM chat_v2_state s
LEFT JOIN context_store c ON s.conversation_id = c.conversation_id
WHERE s.is_archived = 1 
`, [], (err, rows) => {
if (err) return console.error("Export Error:", err);
if (!rows || rows.length === 0) return;

// Skapa CSV-header (Excel-kompatibel semikolon-separator)
let csvContent = "ID;Datum;Agent;Stad;Fordon;Ämne;Antal_Meddelanden\n";

rows.forEach(row => {
const date = new Date(row.updated_at * 1000).toISOString().split('T')[0];
let ctx = {};
try { ctx = JSON.parse(row.context_data); } catch(e) {}

const locked = ctx.locked_context || {};
const msgs = ctx.messages || [];

// Plocka ut data säkert
const city = locked.city || "Okänd";
const vehicle = locked.vehicle || "Okänd";
const subject = locked.subject || "Inget ämne";
const agent = row.owner || "Ingen";

// Bygg raden
csvContent += `${row.conversation_id};${date};${agent};${city};${vehicle};${subject};${msgs.length}\n`;
});

// Skriv filen
fs.writeFileSync(exportPath, csvContent, 'utf8');
console.log(`[EXPORT] ✅ Sparad till ${exportPath}`);
});
}

// Kör kollen 5 sekunder efter serverstart
setTimeout(runMonthlyExport, 5000);

// Kör kollen en gång per dygn (86400000 ms) för att fånga datumskiften om servern står på
setInterval(runMonthlyExport, 86400000);

// START
const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => {
// Denna sträng läses av main.js för att extrahera versionsnumret
console.log(`✅ Atlas V2.0 Server running on port ${PORT} (v${SERVER_VERSION})`);
});
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

const atlasWindow = window as Window & { __atlasExternalLinkHandlerBound?: boolean };

if (!atlasWindow.__atlasExternalLinkHandlerBound) {
atlasWindow.__atlasExternalLinkHandlerBound = true;
document.addEventListener('click', (event) => {
const anchor = event.target instanceof Element ? event.target.closest('a[href]') : null;
if (!anchor) return;

const rawHref = anchor.getAttribute('href') || '';
if (!rawHref || rawHref.startsWith('#') || /^atlas:\/\/ticket\//i.test(rawHref)) return;
if (anchor.hasAttribute('download')) return;

let url;
try {
url = new URL(rawHref, window.location.href);
} catch (_) {
return;
}

if (!/^https?:$/i.test(url.protocol)) return;

event.preventDefault();
event.stopPropagation();
window.open(url.href, '_blank', 'noopener,noreferrer');
}, true);
}

createRoot(document.getElementById("root")!).render(<App />);

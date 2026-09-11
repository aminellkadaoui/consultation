export function normalizeDigits(value) {
  return String(value).replace(/[٠-٩]/g,c=>String(c.charCodeAt(0)-1632)).replace(/[۰-۹]/g,c=>String(c.charCodeAt(0)-1776));
}
export function normalizeWhatsapp(value) { return normalizeDigits(value).replace(/[\s().-]/g,'').replace(/^00/,'+'); }
export function validWhatsapp(value) { return /^\+[1-9]\d{7,14}$/.test(normalizeWhatsapp(value)); }
export function normalizeInstagram(value) {
  const input=String(value).trim();
  if (/^https?:\/\//i.test(input)) {
    try { const u=new URL(input);if (!['instagram.com','www.instagram.com'].includes(u.hostname)) return '';const segments=u.pathname.split('/').filter(Boolean);if(segments.length!==1||['p','reel','reels','stories','explore','direct','accounts'].includes(segments[0].toLowerCase()))return '';return segments[0]; } catch {return '';}
  }
  return input.replace(/^@/,'');
}
export function validInstagram(value) { return /^[A-Za-z0-9._]{1,30}$/.test(normalizeInstagram(value)); }
export function safeUrl(value,relative=false) {
  if(!value)return '';
  const text=String(value).trim();
  if(relative && !text.includes(':') && !text.startsWith('//') && !text.includes('\\')) return text;
  try {const u=new URL(text);return u.protocol==='https:'&&!u.username&&!u.password?u.href:'';}catch{return '';}
}
export function mediaSource(value) {
  const safe=safeUrl(value);if(!safe)return null;
  const u=new URL(safe);let id='';
  if(['youtube.com','www.youtube.com','m.youtube.com','youtube-nocookie.com','www.youtube-nocookie.com'].includes(u.hostname)) id=u.searchParams.get('v')||u.pathname.match(/^\/(?:embed|shorts)\/([^/]+)/)?.[1]||'';
  if(u.hostname==='youtu.be')id=u.pathname.slice(1).split('/')[0];
  if(/^[\w-]{11}$/.test(id))return {type:'iframe',src:'https://www.youtube-nocookie.com/embed/'+id+'?rel=0'};
  if(['vimeo.com','www.vimeo.com','player.vimeo.com'].includes(u.hostname)) {
    const match=u.pathname.match(/(?:\/video)?\/(\d+)(?:\/([a-zA-Z0-9]+))?/);if(match)return {type:'iframe',src:'https://player.vimeo.com/video/'+match[1]+(match[2]?'?h='+match[2]:(u.searchParams.has('h')?'?h='+encodeURIComponent(u.searchParams.get('h')):''))};
  }
  if(/\.(mp4|webm|ogg)$/i.test(u.pathname))return {type:'video',src:safe};
  return {type:'link',src:safe};
}

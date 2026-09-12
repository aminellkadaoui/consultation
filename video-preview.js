import {mediaSource,safeUrl} from './public-utils.js';
// The actual play icon and thumbnail-to-player interaction from index (2).html.
// URLs come only from consultation settings, never the reference's video IDs/config.
const PLAY = '<div class="play"><svg viewBox="0 0 68 48"><path class="bg" d="M66.52,7.74c-0.78-2.93-2.49-5.41-5.42-6.19C55.79,.13,34,0,34,0S12.21,.13,6.9,1.55C3.97,2.33,2.27,4.81,1.48,7.74C0.06,13.05,0,24,0,24s0.06,10.95,1.48,16.26c0.78,2.93,2.49,5.41,5.42,6.19C12.21,47.87,34,48,34,48s21.79-0.13,27.1-1.55c2.93-0.78,4.64-3.26,5.42-6.19C67.94,34.95,68,24,68,24S67.94,13.05,66.52,7.74z"/><path d="M45,24 27,14 27,34" fill="#fff"/></svg></div>';
export function makeHeroMedia(url,title,poster,makeMedia){
  const source=mediaSource(url);
  if(!source)return null;
  const youtube=source.type==='iframe'&&new URL(source.src).hostname==='www.youtube-nocookie.com';
  const id=youtube?new URL(source.src).pathname.split('/').pop():'';
  const suppliedPoster=safeUrl(poster,true);
  const thumbnail=suppliedPoster||(youtube?'https://i.ytimg.com/vi_webp/'+id+'/maxresdefault.webp':'');
  if(!thumbnail||source.type==='link')return makeMedia(url,title,poster);
  const button=document.createElement('button');
  button.type='button';button.className='ratio wide video-preview';button.setAttribute('aria-label',title);
  const image=document.createElement('img');image.className='thumb';image.alt='';image.loading='lazy';image.src=thumbnail;
  // PLAY is the static SVG literal copied above; no customer/admin HTML is interpolated.
  const icon=document.createElement('span');icon.innerHTML=PLAY;icon.setAttribute('aria-hidden','true');
  button.append(image,icon);
  image.addEventListener('error',()=>{
    if(youtube&&!suppliedPoster){image.src='https://i.ytimg.com/vi/'+id+'/hqdefault.jpg';image.addEventListener('error',()=>image.remove(),{once:true});}
    else image.remove();
  },{once:true});
  button.addEventListener('click',()=>{
    const player=makeMedia(url,title,poster);if(!player)return;
    if(source.type==='iframe'){
      const embed=new URL(source.src);embed.searchParams.set('autoplay','1');embed.searchParams.set('playsinline','1');
      player.src=embed.href;player.allow='autoplay; fullscreen; picture-in-picture; encrypted-media';
    }
    button.replaceWith(player);player.focus();
    if(source.type==='video')player.play().catch(()=>{});
  },{once:true});
  return button;
}

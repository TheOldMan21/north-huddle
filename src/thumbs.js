/* ===================== North Huddle: news thumbnails ===================== */
// ESPN stories carry their own photo; for other sources /api/thumb finds the article's preview image.
function newsThumb(n){
  if(n.image&&!/teamlogos|logo/i.test(n.image)) return n.image;
  if(n.url&&/^https?:\/\//.test(n.url)) return "/api/thumb?u="+encodeURIComponent(n.url);
  return "";
}
const _newsItemTH=newsItem;
newsItem=function(n){
  const h=_newsItemTH(n), src=newsThumb(n); if(!src) return h;
  const img=`<img class="nthumb" src="${esc(src)}" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer" onerror="this.closest('.news-item')?.classList.remove('nt');this.remove()">`;
  return h.replace('class="news-item"','class="news-item nt"').replace(/(<\/a>|<\/div>)\s*$/, img+"$1");
};

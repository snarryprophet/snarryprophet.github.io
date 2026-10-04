/* The Weekly Snarry Prophet – shared code */

/* ▼▼▼ SETTINGS – the only things you normally need to change ▼▼▼ */
var CONFIG = {
  // Published CSV link of the "Archive" sheet (File → Share → Publish to web → Archive → CSV)
  CSV_URL: "https://docs.google.com/spreadsheets/d/e/2PACX-1vQlSMDPK4W2cFu4fQuNibWAva2bgpJNpODrDvonAanTH2aULkECtySdK-X8X1vhuC1FBr8MSCaZTBFn/pub?gid=1855533287&single=true&output=csv",
  WEEKS_PER_PAGE: 4,     // weekly editions shown per page on the front page
  SEARCH_PAGE_SIZE: 25,  // results shown before "Show more"

  // Front-page picture (leave HERO_IMAGE empty "" to hide it)
  HERO_IMAGE: "cover.jpg",
  HERO_CAPTION: "",           // optional caption under the picture, e.g. "Art by …"
  HERO_NEWSPAPER_LOOK: true,  // true = black & white "printed" look in the paper colours, false = original colours

  // Sidebar box under the picture. Add more places by copying a { … } line.
  FRIENDS_TITLE: "Friends of the Prophet",
  FRIENDS: [
    { name: "House of Snarry", text: "The Discord server for Snarry fans. Come say hi!", url: "https://discord.gg/23w8WCkuPn", button: "Join the server" }
  ]
};
/* ▲▲▲ end of settings ▲▲▲ */

var SP = (function(){
  var MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
  var RATING = {"General":["G","--g"],"Teen":["T","--t"],"Mature":["M","--m"],"Explicit":["E","--e"],"Not Rated":["?","--nr"]};

  function esc(s){ return String(s == null ? "" : s).replace(/[&<>"']/g,function(c){return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c];}); }
  function safeUrl(u){ u = String(u||"").trim(); return /^https?:\/\//i.test(u) ? u : ""; }
  function num(v){ var n = parseInt(String(v||"").replace(/[^\d]/g,""),10); return isNaN(n) ? 0 : n; }

  // Load the sheet → array of clean row objects (example row and empty rows removed)
  function load(done, fail){
    Papa.parse(CONFIG.CSV_URL + "&t=" + Date.now(), {
      download:true, header:true, skipEmptyLines:true,
      complete:function(res){
        var rows = [];
        res.data.forEach(function(raw){
          var r = {}; for(var k in raw) r[String(k).trim()] = String(raw[k] == null ? "" : raw[k]).trim();
          if(r.Title && !/^EXAMPLE/i.test(r.Title)) rows.push(r);
        });
        done(rows);
      },
      error:function(){ if(fail) fail(); }
    });
  }

  // Edition helpers. The Week column holds either
  //   "2026-10-04"  = the Sunday edition date; it covers the week Sunday 27 Sep – Saturday 3 Oct
  //   "2026-W40"    = older ISO week format (Monday – Sunday), still understood
  function addDays(d, n){ var x = new Date(d); x.setUTCDate(x.getUTCDate()+n); return x; }
  function parts(w){
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(w||"");
    if(m){ var ed = new Date(Date.UTC(+m[1],+m[2]-1,+m[3])); return { kind:"date", edition:ed, from:addDays(ed,-7), to:addDays(ed,-1) }; }
    m = /^(\d{4})-W(\d{1,2})$/.exec(w||"");
    if(m){
      var jan4 = new Date(Date.UTC(+m[1],0,4));
      var mon = addDays(jan4, -((jan4.getUTCDay()+6)%7) + (+m[2]-1)*7);
      return { kind:"iso", week:+m[2], edition:mon, from:mon, to:addDays(mon,6) };
    }
    return null;
  }
  function fmtDay(d, year){ return d.getUTCDate()+" "+MONTHS[d.getUTCMonth()].slice(0,3)+(year?" "+d.getUTCFullYear():""); }
  function weekStart(w){ var p = parts(w); return p ? p.from : null; }
  function weekRange(w){
    var p = parts(w); if(!p) return "";
    return fmtDay(p.from, p.from.getUTCFullYear()!==p.to.getUTCFullYear()) + " – " + fmtDay(p.to, true);
  }
  // "4 October 2026" (or "Week 40" for the old format)
  function weekLabel(w){
    var p = parts(w); if(!p) return w || "";
    return p.kind === "iso" ? "Week "+p.week : p.edition.getUTCDate()+" "+MONTHS[p.edition.getUTCMonth()]+" "+p.edition.getUTCFullYear();
  }
  // "4 October 2026 edition" / "Week 40" – used in search results and dropdowns
  function editionName(w){ var p = parts(w); return p && p.kind === "date" ? weekLabel(w)+" edition" : weekLabel(w)+(p ? " ("+w.slice(0,4)+")" : ""); }
  function monthLabel(w){ var p = parts(w); return p ? MONTHS[p.edition.getUTCMonth()]+" "+p.edition.getUTCFullYear() : "Undated"; }

  // Today's date in Prague, as "2026-10-04"
  function todayPrague(){
    try { return new Date().toLocaleDateString("en-CA", { timeZone:"Europe/Prague" }); }
    catch(e){ var d = new Date(); return d.getFullYear()+"-"+("0"+(d.getMonth()+1)).slice(-2)+"-"+("0"+d.getDate()).slice(-2); }
  }
  // An edition dated in the future (e.g. next Sunday) is still "at the printers" and is not shown on the front page yet
  function isUpcoming(w){ var p = parts(w); return !!(p && p.kind === "date" && w > todayPrague()); }

  // One article in the paper
  function item(r, opt){
    opt = opt || {};
    var rt = RATING[r.Rating], url = safeUrl(r.Link), t = esc(r.Title), chips = [];
    if(opt.showKind && r.Type) chips.push('<span class="chip kind">'+esc(r.Type)+'</span>');
    var ongoing = r.Type === "WIP Update" || /^(WIP|Series)/i.test(r.Status);
    if(r.Chapters && ongoing) chips.push('<span class="chip">Ch. '+esc(r.Chapters)+'</span>');
    if(r.Words) chips.push('<span class="chip">'+num(r.Words).toLocaleString("en")+' words</span>');
    if(r.Status && r.Type!=="Art") chips.push('<span class="chip">'+esc(r.Status)+'</span>');
    if(opt.showLength && r.Length) chips.push('<span class="chip">'+esc(r.Length)+'</span>');
    if(r.Setting) chips.push('<span class="chip">'+esc(r.Setting)+'</span>');
    if(r.Platform && r.Platform!=="AO3") chips.push('<span class="chip">'+esc(r.Platform)+'</span>');
    var w = r["Archive Warnings"];
    if(w && !/^No Archive Warnings/i.test(w)) chips.push('<span class="chip warn">'+esc(w)+'</span>');
    if(opt.showTags) (r["Tags (comma-separated)"]||"").split(",").forEach(function(tag){ tag = tag.trim(); if(tag) chips.push('<span class="chip">'+esc(tag)+'</span>'); });

    if(opt.oneLine){
      // Everything in one row: rating · title · by author · chips (wraps only on narrow screens)
      return '<article class="item line'+(rt?' rated':'')+'"><div class="row">'+
        (rt ? '<span class="rating" style="background:var('+rt[1]+')" title="'+esc(r.Rating)+'">'+rt[0]+'</span>' : '')+
        '<h3>'+(url ? '<a href="'+esc(url)+'" target="_blank" rel="noopener">'+t+'</a>' : t)+'</h3>'+
        (r["Author / Artist"] ? '<span class="by">by '+esc(r["Author / Artist"])+'</span>' : '')+
        chips.join("")+'</div>'+
        (r.Notes ? '<p class="notes">'+esc(r.Notes)+'</p>' : '')+
        '</article>';
    }

    return '<article class="item"><div class="top">'+
      (rt ? '<div class="rating" style="background:var('+rt[1]+')" title="'+esc(r.Rating)+'">'+rt[0]+'</div>' : '')+
      '<div><h3>'+(url ? '<a href="'+esc(url)+'" target="_blank" rel="noopener">'+t+'</a>' : t)+'</h3>'+
      (r["Author / Artist"] ? '<div class="by">by '+esc(r["Author / Artist"])+'</div>' : '')+'</div></div>'+
      (chips.length ? '<div class="chips">'+chips.join("")+'</div>' : '')+
      (r.Notes ? '<p class="notes">'+esc(r.Notes)+'</p>' : '')+
      (opt.showAdded && r.Added ? '<div class="added">Added '+esc(r.Added)+(r.Week?' · '+esc(editionName(r.Week)):'')+'</div>' : '')+
      '</article>';
  }

  // Sidebar "Friends of the Prophet" box
  function friends(){
    var list = (CONFIG.FRIENDS || []).filter(function(f){ return f && f.name; });
    if(!list.length) return "";
    return '<div class="rubric">'+esc(CONFIG.FRIENDS_TITLE || "Friends of the Prophet")+'</div>'+
      list.map(function(f){
        var url = safeUrl(f.url);
        return '<div class="friend"><div class="fname">'+esc(f.name)+'</div>'+
          (f.text ? '<p>'+esc(f.text)+'</p>' : '')+
          (url ? '<a class="fbtn" href="'+esc(url)+'" target="_blank" rel="noopener">'+esc(f.button || "Visit")+' →</a>' : '')+
          '</div>';
      }).join("");
  }

  function isEditorial(r){ return /^Editorial$/i.test(r.Type || ""); }

  // Today's date in the masthead
  function todayLine(){
    var d = new Date(), days = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
    return days[d.getDay()]+", "+d.getDate()+" "+MONTHS[d.getMonth()]+" "+d.getFullYear();
  }
  document.addEventListener("DOMContentLoaded", function(){
    var el = document.getElementById("today"); if(el) el.textContent = todayLine();
  });

  return { load:load, esc:esc, num:num, item:item, friends:friends, isEditorial:isEditorial, weekStart:weekStart, weekRange:weekRange, weekLabel:weekLabel, editionName:editionName, monthLabel:monthLabel, isUpcoming:isUpcoming };
})();

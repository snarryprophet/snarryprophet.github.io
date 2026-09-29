/* The Weekly Snarry Prophet – shared code */

/* ▼▼▼ SETTINGS – the only things you normally need to change ▼▼▼ */
var CONFIG = {
  // Published CSV link of the "Archive" sheet (File → Share → Publish to web → Archive → CSV)
  CSV_URL: "https://docs.google.com/spreadsheets/d/e/2PACX-1vQlSMDPK4W2cFu4fQuNibWAva2bgpJNpODrDvonAanTH2aULkECtySdK-X8X1vhuC1FBr8MSCaZTBFn/pub?gid=1855533287&single=true&output=csv",
  WEEKS_PER_PAGE: 4,     // weekly editions shown per page on the front page
  SEARCH_PAGE_SIZE: 25   // results shown before "Show more"
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

  // ISO week helpers: "2026-W40"
  function weekStart(w){
    var m = /^(\d{4})-W(\d{1,2})$/.exec(w||""); if(!m) return null;
    var jan4 = new Date(Date.UTC(+m[1],0,4));
    var d = new Date(jan4); d.setUTCDate(jan4.getUTCDate() - ((jan4.getUTCDay()+6)%7) + (+m[2]-1)*7);
    return d;
  }
  function fmtDay(d, year){ return d.getUTCDate()+" "+MONTHS[d.getUTCMonth()].slice(0,3)+(year?" "+d.getUTCFullYear():""); }
  function weekRange(w){
    var s = weekStart(w); if(!s) return "";
    var e = new Date(s); e.setUTCDate(s.getUTCDate()+6);
    return fmtDay(s, s.getUTCFullYear()!==e.getUTCFullYear()) + " – " + fmtDay(e, true);
  }
  function weekLabel(w){ var m = /W(\d+)/.exec(w||""); return m ? "Week "+(+m[1]) : w; }
  function monthLabel(w){ var s = weekStart(w); return s ? MONTHS[s.getUTCMonth()]+" "+s.getUTCFullYear() : "Undated"; }

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
      (opt.showAdded && r.Added ? '<div class="added">Added '+esc(r.Added)+(r.Week?' · '+esc(weekLabel(r.Week)):'')+'</div>' : '')+
      '</article>';
  }

  // Today's date in the masthead
  function todayLine(){
    var d = new Date(), days = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
    return days[d.getDay()]+", "+d.getDate()+" "+MONTHS[d.getMonth()]+" "+d.getFullYear();
  }
  document.addEventListener("DOMContentLoaded", function(){
    var el = document.getElementById("today"); if(el) el.textContent = todayLine();
  });

  return { load:load, esc:esc, num:num, item:item, weekStart:weekStart, weekRange:weekRange, weekLabel:weekLabel, monthLabel:monthLabel };
})();

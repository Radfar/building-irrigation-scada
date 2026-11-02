(() => {
"use strict";
const $ = id => document.getElementById(id);
const meta = {
 "01":{name:"Main Entrance",controller:"Python water-process simulator",protocol:"Modbus TCP",extra:["z1-frequency","z1-pump","z1-mode"]},
 "02":{name:"Courtyard",controller:"Rockwell Micro850",protocol:"EtherNet/IP",extra:[]},
 "03":{name:"Roof Garden",controller:"CODESYS SoftPLC",protocol:"OPC UA",extra:[]},
 "04":{name:"East Garden",controller:"ESP8266 IoT edge",protocol:"MQTT / Node-RED",extra:["z4-node","z4-age"]},
 "05":{name:"West Garden",controller:"BACnet device",protocol:"BACnet/IP",extra:["z5-tank","z5-pump","z5-mode"]},
 "06":{name:"Parking Landscape",controller:"Demo controller",protocol:"Demo / static HMI",extra:[]}
};
let selected="02", theme="dark";
function applyTheme(value){
 theme=value==="light"?"light":"dark"; document.body.dataset.theme=theme;
 const b=$("theme-toggle"); if(b)b.textContent=theme==="dark"?"☀ Light mode":"☾ Dark mode";
 try{localStorage.setItem("scada-theme",theme)}catch(_){}
}
function textValue(id,fallback="N/A"){
 const e=$(id); if(!e)return fallback; const v=e.textContent.trim(); return v&&v!=="--"?v:fallback;
}
function metric(label,value){return '<div class="detail-item"><span>'+label+'</span><strong>'+value+'</strong></div>'}
function zoneCategory(card){
 const badge=card.querySelector(".zone-head .status");
 const status=(badge?.textContent||"UNKNOWN").trim().toUpperCase();
 if(status==="RUNNING") return "active";
 if(["STANDBY","STOPPED","IDLE"].includes(status)) return "standby";
 return "attention";
}
function applyZoneFilter(){
 const filter=$("zone-filter-select")?.value||"all";
 const cards=[...document.querySelectorAll(".zone[data-zone]")];
 const visible=[];
 cards.forEach(card=>{
  const show=filter==="all"||zoneCategory(card)===filter;
  card.hidden=!show;
  if(show) visible.push(card);
 });
 const count=$("zone-filter-count");
 if(count) count.textContent=visible.length+" of "+cards.length+" zones";
 const empty=$("zone-filter-empty");
 if(empty) empty.hidden=visible.length>0;
 const details=$("zone-details-panel");
 if(visible.length){
  if(!visible.some(card=>card.dataset.zone===selected)) select(visible[0].dataset.zone);
  if(details) details.hidden=false;
 } else if(details) {
  details.hidden=true;
 }
}
function render(){
 const m=meta[selected], num=Number(selected), badge=$("z"+num+"-status");
 const status=badge?badge.textContent.trim():(selected==="01"?"RUNNING":"STANDBY");
 $("detail-title").textContent="Zone "+selected+" • "+m.name;
 $("detail-status").textContent=status||"UNKNOWN";
 $("detail-status").className="status "+(badge?badge.className.replace("status","").trim():"ok");
 $("detail-subtitle").textContent=m.controller+" · "+m.protocol+" · Live overview and available diagnostics";
 const vals=[
  ["Process / Communication state",status||"UNKNOWN"],
  [selected==="01"?"Tank level":"Moisture",selected==="01"?textValue("z1-tank"):textValue("z"+num+"-moisture",selected==="06"?"52%":"N/A")],
  ["Flow",textValue("z"+num+"-flow",selected==="06"?"0 L/min":"N/A")],
  ["Valve",textValue("z"+num+"-valve",selected==="06"?"0%":"N/A")]
 ];
 m.extra.forEach(id=>{
  const labels={"z1-frequency":"Pump frequency","z1-pump":"Pump state","z1-mode":"Operating mode","z4-node":"Edge node","z4-age":"Last reading","z5-tank":"Tank level","z5-pump":"Pump state","z5-mode":"Operating mode"};
  vals.push([labels[id],textValue(id)]);
 });
 $("detail-grid").innerHTML=vals.map(v=>metric(v[0],v[1])).join("");
 const controls={
  // Zones 02–04 keep their original operator controls on the zone cards.
  // Do not duplicate Start / Stop / Auto controls in the details panel.
  "02":[],
  "03":[],
  "04":[],
  "05":[["Start","z5-btn-start"],["Stop","z5-btn-stop"],["Mode","z5-btn-mode"],["Reset","z5-btn-reset"]]
 };
 const items=controls[selected]||[];
 $("detail-actions").innerHTML=items.map(([label,target])=>{
  const targetElement=$(target);
  const hidden=!!targetElement&&getComputedStyle(targetElement).display==="none";
  const disabled=!!targetElement&&(targetElement.disabled||hidden);
  return '<button type="button" '+(disabled?'disabled ':'')+(hidden?'style="display:none" ':'')+'data-proxy="'+target+'">'+label+'</button>';
 }).join("");
 $("detail-hint").textContent=items.length?
  "Commands use the existing zone-specific API and driver. Local PLC/device interlocks remain authoritative.":
  "Demonstration placeholder: no live controller connection or operator command is configured for this zone.";
 document.querySelectorAll(".zone[data-zone]").forEach(card=>{
  const active=card.dataset.zone===selected;card.classList.toggle("is-selected",active);card.setAttribute("aria-pressed",String(active));
 });
}

function select(id){if(meta[id]){selected=id;render()}}
document.addEventListener("click",e=>{
 if(e.target.closest("#theme-toggle")){applyTheme(theme==="dark"?"light":"dark");return}
 if(e.target.closest("#zone-filter-select")) return;
 const proxy=e.target.closest("[data-proxy]");
 if(proxy){const target=$(proxy.dataset.proxy);if(target&&!target.disabled)target.click();return}
 const card=e.target.closest(".zone[data-zone]");if(card)select(card.dataset.zone);
});
document.addEventListener("change",e=>{
 if(e.target.id==="zone-filter-select"){
  try{localStorage.setItem("scada-zone-filter",e.target.value)}catch(_){}
  applyZoneFilter();
 }
});
document.addEventListener("keydown",e=>{
 const card=e.target.closest?.(".zone[data-zone]");
 if(card&&(e.key==="Enter"||e.key===" ")){e.preventDefault();select(card.dataset.zone)}
});
function init(){
 let saved="dark";try{saved=localStorage.getItem("scada-theme")||"dark"}catch(_){}
 applyTheme(saved);render();
 const filter=$("zone-filter-select");
 let savedFilter="all";try{savedFilter=localStorage.getItem("scada-zone-filter")||"all"}catch(_){}
 if(filter) filter.value=savedFilter;
 applyZoneFilter();
 window.setInterval(()=>{render();applyZoneFilter()},1000);
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init);else init();
})();
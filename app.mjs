import { createDemo } from './demo-engine.mjs';
const demo=createDemo();
async function demoRequest(url,options={}){
 try{
  const data=url==='/api/session'?{nonce:'public-simulation'}:url.startsWith('/api/state?')?demo.state(new URLSearchParams(url.split('?')[1]).get('role')):demo.act(JSON.parse(options.body));
  return{ok:true,status:200,json:async()=>data};
 }catch(error){return{ok:false,status:error.message==='RESPONSE_LIMIT_REACHED'?409:400,json:async()=>({error:{code:error.message}})};}
}
const $ = (id) => document.getElementById(id);
const names = { sos:'主动 SOS', fall:'摔倒求救', active:'处理中', closed:'已关闭', accepted:'已接单', en_route:'在路上', arrived:'已到场', treating:'处理中', withdrawn:'已退出', initial:'初始通知', expanded:'已扩至 2km', escalated:'已升级并提醒拨 120', event_opened:'事件通知', location_updated:'位置更新', response_accepted:'有人接单', response_updated:'响应状态更新', first_arrival:'首人到场', event_closed:'事件关闭', event_escalated:'响应升级', phone:'家属电话', push:'系统推送', mqtt:'MQTT', pending_confirmation:'等待取消窗口', cancelled:'已取消', broker_accepted:'浏览器已模拟受理', mock_recorded:'仅记录模拟发送', pending:'等待执行', 'NO_ACTIVE_EVENT':'事件已结束', NOT_FOUND:'当前身份无权操作或查看此事件', RESPONSE_LIMIT_REACHED:'已有 3 人接单，不能再加入', EVENT_FULL:'已有 3 人接单，不能再加入', EVENT_CLOSED:'事件已关闭', NO_FRAME_TO_REPEAT:'请先发出模拟 SOS', NO_FALL_PENDING:'请先触发摔倒候选', FALL_ALREADY_PENDING:'已有摔倒候选，请先取消或推进 30 秒' };
const text = (value) => names[value] || value;
let nonce; let state; let selected; let busy = false;
function element(tag, content, className) { const node = document.createElement(tag); if (content !== undefined) node.textContent = content; if (className) node.className = className; return node; }
function button(label, action, extra = {}, className = '') { const b = element('button', label, className); b.addEventListener('click', () => act({ action, ...extra })); return b; }
function render() {
  $('clock').textContent = new Date(state.now).toLocaleString('zh-CN', { hour12:false });
  $('pending').textContent = state.pending ? `摔倒候选：${text(state.pending.state)}。仅模拟单次 30 秒窗口。` : '尚无摔倒候选';
  const list = $('events'); list.replaceChildren();
  if (!state.events.some((e) => e.event_id === selected)) selected = state.events.find((e) => e.event_id === state.selected_event_id)?.event_id || state.events[0]?.event_id;
  for (const e of state.events) { const b = element('button', undefined, 'event-item' + (e.event_id === selected ? ' active' : '')); b.append(element('strong', text(e.event_type)), element('span', `${text(e.status)} · ${e.responder_count}/3 人`), element('small', e.event_id)); b.addEventListener('click', () => { selected = e.event_id; render(); }); list.append(b); }
  if (!state.events.length) list.append(element('p', state.role === 'outsider' ? '权限检查生效：这个身份看不到事件。' : '暂无可见事件'));
  const detail = $('detail'); detail.replaceChildren(); const e = state.events.find((event) => event.event_id === selected);
  if (!e) { const empty = element('div', undefined, 'empty'); empty.append(element('h2', '等待可见事件'), element('p', '从上方发出模拟 SOS，或切换有权限的身份。')); detail.append(empty); }
  else {
    const head = element('div', undefined, 'detail-head'); head.append(element('h2', text(e.event_type)), element('span', text(e.status), 'status')); detail.append(head, element('p', `${e.event_id} · 版本 ${e.event_version}`, 'meta'), element('p', `${text(e.response_intensity)} · 当前响应 ${e.responder_count}/3 人`));
    const location = element('div', undefined, 'location'); location.append(element('strong', '事件位置'));
    if (e.location?.coordinate) { const c = e.location.coordinate; location.append(element('p', `${c.latitude.toFixed(5)}, ${c.longitude.toFixed(5)} · ${e.location.crs}`), element('p', `合成定位证据 · ${e.location.accuracy_m ? '估计误差 ' + e.location.accuracy_m + 'm' : '接单前仅展示粗略范围'}`)); }
    else location.append(element('p', '暂无有效位置。当前没有位置输入。'));
    location.append(element('p', '楼层未知，证据不足。未连接地图 SDK。')); detail.append(location);
    if (e.sensor_facts) detail.append(element('p', `传感器事实：撞击峰值 ${e.sensor_facts.impact_peak_g ?? '未知'}g，静止 ${e.sensor_facts.stillness_seconds ?? '未知'}s。仅透传事实。`, 'meta'));
    const table = element('table', undefined, 'responses'); const tr = element('tr'); for (const s of ['响应者','当前状态']) tr.append(element('th', s)); table.append(tr); for (const r of e.responses) { const row=element('tr'); row.append(element('td', '志愿者 ' + r.volunteer_id.split('_').at(-1)),element('td',text(r.status))); table.append(row); } if (!e.responses.length) { const row=element('tr'); row.append(element('td','等待志愿者接单'),element('td','尚无人接单')); table.append(row); } detail.append(table);
    const actions=element('div',undefined,'actions'); const own=e.responses.find((r)=>r.volunteer_id===state.role && r.status!=='withdrawn');
    if(e.status==='active') { if(state.role.startsWith('volunteer_')) { if(!own) actions.append(button('我要接单','accept',{ event_id:e.event_id },'primary')); else { if(own.status==='accepted') actions.append(button('我已出发','en_route',{ event_id:e.event_id },'primary')); if(['accepted','en_route'].includes(own.status)) actions.append(button('我已到场','arrived',{ event_id:e.event_id }),button('退出响应','withdraw',{event_id:e.event_id})); } } if(state.role==='family'||['arrived','treating'].includes(own?.status)) actions.append(button('关闭此事件','close',{event_id:e.event_id},'danger')); }
    if(e.status==='closed'&&(state.role==='family'||['arrived','treating'].includes(own?.status))) actions.append(button('评价：真实求救','feedback',{event_id:e.event_id,assessment:'real'}),button('评价：误报','feedback',{event_id:e.event_id,assessment:'false_alarm'}),button('评价：不确定','feedback',{event_id:e.event_id,assessment:'uncertain'}));
    detail.append(actions); if(e.response_intensity==='escalated') detail.append(element('p','强提示：必要时请由用户主动拨打 120。本演示不会拨号。'));
    if(e.responses.some((r)=>r.status==='arrived')) detail.append(element('p','已有响应者到场，其他在途人员自行决定是否返回。'));
    const timeline=element('div',undefined,'timeline'); for(const change of e.changes.slice(-8)) timeline.append(element('span',`v${change.event_version} ${text(change.kind)}`)); detail.append(timeline);
  }
  const notices=$('notices'); notices.replaceChildren(); for(const n of state.notifications.slice(-6)) notices.append(element('span',`${text(n.kind)} · 浏览器模拟通知`));
  const phone=state.deliveries.filter((d)=>d.channel==='phone'); if(phone.length) notices.append(element('span',`家属电话：${text(phone.at(-1).state)}，没有实际呼叫`)); if(!notices.childNodes.length) notices.textContent='等待事件';
}
async function refresh(){ const response=await demoRequest('/api/state?role='+encodeURIComponent($('role').value)); const data=await response.json(); if(!response.ok)throw new Error(data.error?.code||'连接失败'); state=data;render(); }
async function act(body){ if(busy)return; busy=true; document.querySelectorAll('button').forEach((b)=>b.disabled=true); try{ const r=await demoRequest('/api/action',{method:'POST',headers:{'content-type':'application/json','x-demo-nonce':nonce},body:JSON.stringify({role:$('role').value,...body})}); const data=await r.json(); if(!r.ok)throw new Error(text(data.error?.code||'操作失败')+(r.status===409?'（状态冲突，请刷新核对）':'')); if(body.action==='sos')selected=data.event_id; if(body.action==='advance')selected=null; $('message').textContent=body.action==='duplicate'?`模拟识别重复消息，事件编号保持 ${data.event_id}`:body.action==='advance'?`测试时钟已推进 ${body.seconds} 秒，正式时间配置保持不变。`:'操作已在浏览器模拟完成。'; await refresh(); }catch(error){$('message').textContent=error.message;}finally{busy=false;document.querySelectorAll('button').forEach((b)=>b.disabled=false);} }
for(const b of document.querySelectorAll('[data-action]'))b.addEventListener('click',()=>act({action:b.dataset.action,...(b.dataset.seconds?{seconds:Number(b.dataset.seconds)}:{})}));
$('role').addEventListener('change',()=>refresh().catch((e)=>$('message').textContent=e.message)); $('refresh').addEventListener('click',()=>refresh().catch((e)=>$('message').textContent=e.message));
try{const response=await demoRequest('/api/session');nonce=(await response.json()).nonce;await refresh();$('connection').textContent='浏览器模拟已就绪';}catch(error){$('connection').textContent='连接失败';$('message').textContent=error.message;}

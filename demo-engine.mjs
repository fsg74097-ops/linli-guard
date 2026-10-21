// Public illustration only. Every role, event, location and notification is
// synthetic and exists in this browser tab. This is not backend authorization.
export function createDemo() {
 const roles=['family','volunteer_1','volunteer_2','volunteer_3','volunteer_4','outsider'];
 let now=Date.UTC(2026,9,21,8),serial=0,selected,last,pending;
 const events=[],notices=[],deliveries=[];
 const fail=(code)=>{throw new Error(code);};
 const validRole=(role)=>roles.includes(role)||fail('INVALID_ROLE');
 const active=(e)=>e.responses.filter(r=>r.status!=='withdrawn');
 const allowed=(role)=>role!=='outsider';
 function change(e,kind){e.event_version++;e.changes.push({event_version:e.event_version,kind});notices.push({event_id:e.event_id,kind});}
 function open(type){
  const e={event_id:`evt_demo_${++serial}`,event_type:type,status:'active',opened:now,event_version:0,response_intensity:'initial',responses:[],feedback:[],changes:[],location:{coordinate:{latitude:31.23041,longitude:121.47371},crs:'WGS84',accuracy_m:60}};
  events.push(e);selected=e.event_id;change(e,'event_opened');return e;
 }
 function tick(){
  if(pending?.state==='pending_confirmation'&&now-pending.started>=30000){pending.state='active';pending.event_id=open('fall').event_id;}
  for(const e of events){
   if(e.status!=='active'||active(e).length)continue;
   const age=now-e.opened;
   if(age>=120000&&e.response_intensity==='initial'){
    e.response_intensity='expanded';change(e,'event_escalated');deliveries.push({event_id:e.event_id,channel:'phone',state:'mock_recorded',kind:'expanded'});
   }
   if(age>=240000&&e.response_intensity==='expanded'){e.response_intensity='escalated';change(e,'event_escalated');}
  }
 }
 function act({action,role='family',event_id,seconds,assessment}){
  validRole(role);
  if(action==='sos'){const e=open('sos');last=e.event_id;return{event_id:e.event_id};}
  if(action==='duplicate'){if(!last)fail('NO_FRAME_TO_REPEAT');return{event_id:last,duplicate:true};}
  if(action==='fall'){if(pending?.state==='pending_confirmation')fail('FALL_ALREADY_PENDING');pending={incident_id:`inc_demo_${++serial}`,started:now,state:'pending_confirmation'};return{incident_id:pending.incident_id};}
  if(action==='cancel'){if(pending?.state!=='pending_confirmation')fail('NO_FALL_PENDING');pending.state='cancelled';return{cancelled:true};}
  if(action==='advance'){if(![30,120,240].includes(seconds))fail('INVALID_ADVANCE');now+=seconds*1000;tick();return{advanced_seconds:seconds};}
  if(!['accept','en_route','arrived','withdraw','close','feedback'].includes(action))fail('UNKNOWN_ACTION');
  const e=events.find(x=>x.event_id===event_id);if(!e||!allowed(role))fail('NOT_FOUND');
  const own=e.responses.find(r=>r.volunteer_id===role&&r.status!=='withdrawn');
  if(action==='feedback'){
   if(e.status!=='closed')fail('EVENT_NOT_CLOSED');if(role!=='family'&&own?.status!=='arrived')fail('FORBIDDEN');
   if(!['real','false_alarm','uncertain'].includes(assessment))fail('INVALID_ASSESSMENT');
   const prior=e.feedback.find(f=>f.role===role);if(prior)prior.assessment=assessment;else e.feedback.push({role,assessment});return{saved:true};
  }
  if(e.status!=='active')fail('EVENT_CLOSED');
  if(action==='close'){if(role!=='family'&&own?.status!=='arrived')fail('FORBIDDEN');e.status='closed';change(e,'event_closed');}
  else{
   if(!role.startsWith('volunteer_'))fail('FORBIDDEN');
   if(action==='accept'){
    if(own)return{event_id};if(active(e).length>=3)fail('RESPONSE_LIMIT_REACHED');
    e.responses.push({volunteer_id:role,status:'accepted'});change(e,'response_accepted');
   }else{
    if(!own)fail('NO_RESPONSE');
    if(action==='withdraw'){if(own.status==='arrived')fail('INVALID_RESPONSE_STATUS');own.status='withdrawn';change(e,'response_updated');}
    else{
     if(!['accepted','en_route'].includes(own.status))fail('INVALID_RESPONSE_STATUS');
     if(action==='en_route'&&own.status!=='accepted')fail('INVALID_RESPONSE_STATUS');
     const first=action==='arrived'&&!e.responses.some(r=>r.status==='arrived');own.status=action;change(e,'response_updated');if(first)change(e,'first_arrival');
    }
   }
  }
  return{event_id};
 }
 function state(role='family'){
  validRole(role);const visible=allowed(role)?structuredClone(events):[];
  for(const e of visible){
   e.responder_count=active(e).length;
   if(role!=='family'&&!active(e).some(r=>r.volunteer_id===role)){
    e.location.coordinate={latitude:31.23,longitude:121.47};delete e.location.accuracy_m;
   }
  }
  const ids=new Set(visible.map(e=>e.event_id));
  return{role,now:new Date(now).toISOString(),events:visible,selected_event_id:selected,pending:allowed(role)?structuredClone(pending??null):null,notifications:structuredClone(notices.filter(n=>ids.has(n.event_id))),deliveries:structuredClone(deliveries.filter(n=>ids.has(n.event_id))),mode:'browser_simulation',real_send:false};
 }
 return{act,state};
}

export const visitInterval=30*60*1000;
export const usageDays=90;
const maxVisits=20_000;
const day=24*60*60*1000;

export interface Visit {
 browser:string;
 at:number;
}

export function recentVisits(visits:Visit[],now:number){
 return visits.filter(visit=>visit.at>=now-usageDays*day).slice(-maxVisits);
}

export function registerVisit(visits:Visit[],browser:string,now:number){
 const recent=recentVisits(visits,now);
 const last=recent.findLast(visit=>visit.browser===browser);
 if(last&&now-last.at<visitInterval)return recent.length===visits.length?null:recent;
 return [...recent.slice(-(maxVisits-1)),{browser,at:now}];
}

export function summarizeVisits(visits:Visit[]){
 const browsers=new Map<string,number[]>();
 for(const {browser,at} of visits){
  const times=browsers.get(browser);
  if(times)times.push(at);
  else browsers.set(browser,[at]);
 }
 return [...browsers].map(([browser,times])=>({
  code:browser.replaceAll('-','').slice(0,12).toUpperCase(),
  times:times.sort((a,b)=>b-a)
 })).sort((a,b)=>b.times[0]-a.times[0]);
}

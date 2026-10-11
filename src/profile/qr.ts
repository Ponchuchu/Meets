import {APP_URL} from '../lib/config';
export function parseProfileLink(value:string):{kind:'person'|'handle';value:string}|null{
 try{
  const u=new URL(value);let parts:string[];
  if(u.protocol==='ryadom:'||u.protocol==='meets:')parts=[u.hostname,...u.pathname.split('/').filter(Boolean)];
  else if(u.protocol==='https:'&&u.hostname===new URL(APP_URL).hostname)parts=u.pathname.split('/').filter(Boolean);
  else return null;
  if(parts.length!==2)return null;
  if(parts[0]==='person'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(parts[1]))return {kind:'person',value:parts[1]};
  if(parts[0]==='u'&&/^[a-z0-9_]{3,24}$/i.test(parts[1]))return {kind:'handle',value:parts[1]};
  return null;
 }catch{return null;}
}

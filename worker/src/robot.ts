// Служебные записи выполняются отдельным шагом от Gemini, который читает страницы.
import {readFile} from 'node:fs/promises';
const runId=process.env.ROBOT_RUN_ID;
export async function robot(path:string,method='GET',body?:unknown):Promise<unknown> {
  if(!runId)return null;
  if(!/^[0-9a-f-]{36}$/i.test(runId))throw new Error('Invalid robot run id');
  const key=process.env.SUPABASE_SECRET_KEY||process.env.SUPABASE_SERVICE_ROLE_KEY;
  if(!key||!process.env.SUPABASE_URL)throw new Error('Missing robot database configuration');
  const headers:Record<string,string>={apikey:key,'Content-Type':'application/json',Prefer:'return=minimal'};
  if(key.split('.').length===3)headers.Authorization=`Bearer ${key}`;
  const res=await fetch(`${process.env.SUPABASE_URL}/rest/v1/${path}`,{method,headers,body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(10000)});
  if(!res.ok)throw new Error(`Robot status ${res.status}`);
  const text=await res.text();return text?JSON.parse(text):null;
}
export async function cancelled():Promise<boolean> {
  if(!runId)return false;
  const rows=await robot(`robot_runs?id=eq.${runId}&select=cancel`) as {cancel:boolean}[];
  return !!rows?.[0]?.cancel;
}
export async function robotUpdate(patch:Record<string,unknown>):Promise<void>{await robot(`robot_runs?id=eq.${runId}`,'PATCH',patch);}
export async function robotLog(text:string,level='info'):Promise<void>{if(runId)await robot('robot_log','POST',{run_id:runId,text,level});}
async function main(){
  if(!runId)return;
  const action=process.argv[2];
  const covers=process.env.ROBOT_TASK==='covers';
  if(action==='start'){await robotUpdate({status:'running'});await robotLog(covers?'Генерация обложек запущена':'Поиск запущен · параметры переданы Gemini');}
  else if(action==='finish'){
    const stopped=await cancelled();const status=stopped?'cancelled':process.env.ROBOT_JOB_STATUS==='success'?'done':'failed';
    let found=0;try{found=(JSON.parse(await readFile('search.json','utf8')) as unknown[]).length;}catch{/* шаг поиска завершился с ошибкой */}
    await robotUpdate({status,...(!covers?{found}:{}),finished_at:new Date().toISOString()});await robotLog(status==='done'?(covers?'Генерация обложек завершена':`Готово · проверено ${found} событий · новые карточки в согласовании`):stopped?'Остановлено':'Запуск завершился с ошибкой. Проверь ключ Gemini и журнал GitHub Actions',status==='failed'?'error':'ok');
  }
}
if(process.argv[1]?.endsWith('robot.ts'))void main().catch(error=>{console.error(error);process.exitCode=1;});

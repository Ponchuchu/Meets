import {useQuery,useQueryClient} from '@tanstack/react-query';
import {useRobotConfig} from '../robotConfig';
import {useState} from 'react';
import {Pressable,Text,TextInput,View} from 'react-native';
import {supabase,withTimeout} from '../../data/client';
import {colors,fonts} from '../../theme';
const TOPICS=['music','standup','cinema','art','food','sport'];
const TITLE:Record<string,string>={cinema:'Кино и театр',music:'Музыка',standup:'Стендап',art:'Выставки',sport:'Спорт',games:'Игры',food:'Еда'};
const STATUS:Record<string,string>={queued:'В очереди',running:'Ищет события',done:'Готово',failed:'Ошибка',cancelled:'Остановлен'};
export function RobotPanel({live}:{live:boolean}) {
  const qc=useQueryClient();
  const {model,days,limit,topics,set}=useRobotConfig();
  const setModel=(model:string)=>set({model});const setDays=(days:string)=>set({days});const setLimit=(limit:string)=>set({limit});const [busy,setBusy]=useState(false);const [note,setNote]=useState('');
  const q=useQuery({queryKey:['admin','robot'],enabled:live,refetchInterval:5000,queryFn:async()=>{const r=await withTimeout(supabase().from('robot_runs').select('*').order('started_at',{ascending:false}).limit(5));if(r.error)throw r.error;return r.data as {id:string;status:string;found:number;queued:number}[];}});
  const current=q.data?.[0];const running=q.data?.some(r=>['queued','running'].includes(r.status));
  const logs=useQuery({queryKey:['admin','robot-log',current?.id],enabled:live&&!!current,refetchInterval:5000,queryFn:async()=>{const r=await withTimeout(supabase().from('robot_log').select('id,text,level').eq('run_id',current!.id).order('at',{ascending:false}).limit(12));if(r.error)throw r.error;return r.data as {id:number;text:string;level:string}[];}});
  const invoke=async(action:'start'|'stop'|'check')=>{
    if(busy)return;
    if(!live){setNote('Запуск доступен после входа сотрудника');return;}
    if(action==='start'&&(!topics.length||!/^(gemini|kimi|moonshot)-[a-zA-Z0-9.-]+$/.test(model)||!Number.isInteger(Number(days))||Number(days)<1||Number(days)>30||!Number.isInteger(Number(limit))||Number(limit)<1||Number(limit)>100)){setNote('Выбери темы, модель (gemini-… или kimi-…), период 1–30 дней и лимит 1–100');return;}
    setBusy(true);setNote('');try{const r=await withTimeout(supabase().functions.invoke('robot-run',{body:{action,run_id:current?.id,model,days:Number(days),limit:Number(limit),topics}}),15000);if(r.error||r.data?.error)throw new Error(r.data?.error||r.error?.message);setNote(action==='check'?'Соединение с GitHub работает':action==='stop'?'Остановится после текущего шага':'Поиск поставлен в очередь');await qc.invalidateQueries({queryKey:['admin','robot']});}catch(e){setNote(e instanceof Error?e.message:'Не удалось запустить');}finally{setBusy(false);}
  };
  const text={fontFamily:fonts.body500,color:colors.ink};const input={height:44,paddingHorizontal:12,borderRadius:12,backgroundColor:colors.card,borderWidth:1,borderColor:colors.line,color:colors.ink,fontFamily:fonts.body500};
  return <View style={{margin:16,padding:16,borderRadius:22,backgroundColor:colors.sand2,gap:12,maxWidth:560,alignSelf:'center',width:'92%'}}>
    <Text style={{fontFamily:fonts.display700,fontSize:24,color:colors.ink}}>Поиск событий ИИ</Text>
    <Text style={text}>Найденные события сначала попадут на согласование.</Text>
    <TextInput style={input} accessibilityLabel="Модель ИИ" value={model} onChangeText={setModel} autoCapitalize="none" placeholder="Модель ИИ"/>
    <View style={{flexDirection:'row',gap:10}}><View style={{flex:1,gap:6}}><Text style={text}>Дней вперёд</Text><TextInput style={input} value={days} onChangeText={setDays} keyboardType="number-pad" accessibilityLabel="Период поиска"/></View><View style={{flex:1,gap:6}}><Text style={text}>Лимит событий</Text><TextInput style={input} value={limit} onChangeText={setLimit} keyboardType="number-pad" accessibilityLabel="Лимит событий"/></View></View>
    <View style={{flexDirection:'row',gap:6,flexWrap:'wrap'}}>{TOPICS.map(t=><Pressable key={t} onPress={()=>set({topics:topics.includes(t)?topics.filter(x=>x!==t):[...topics,t]})} accessibilityRole="checkbox" accessibilityState={{checked:topics.includes(t)}} style={{padding:10,borderRadius:12,backgroundColor:topics.includes(t)?colors.ink:colors.card}}><Text style={[text,{color:topics.includes(t)?colors.paper:colors.ink}]}>{TITLE[t]}</Text></Pressable>)}</View>
    <View style={{flexDirection:'row',gap:8}}><Pressable disabled={busy||running} onPress={()=>void invoke('start')} style={{flex:1,padding:14,borderRadius:14,backgroundColor:colors.ink,opacity:running?0.4:1}}><Text style={[text,{textAlign:'center',color:colors.paper}]}>{busy?'Подожди…':'Искать сейчас'}</Text></Pressable>{running&&<Pressable onPress={()=>void invoke('stop')} style={{padding:14}}><Text style={text}>Стоп</Text></Pressable>}</View>
    <Pressable onPress={()=>void invoke('check')}><Text style={text}>Проверить подключение</Text></Pressable>
    {current&&<Text style={text}>{STATUS[current.status]} · найдено {current.found} · в очереди {current.queued}</Text>}
    {(q.isError||logs.isError)&&<Text style={text}>Не удалось загрузить журнал. Повтори подключение.</Text>}
    {!!note&&<Text style={[text,{color:colors.accentText}]} accessibilityLiveRegion="polite">{note}</Text>}
    {logs.data?.map(l=><Text key={l.id} style={[text,{fontSize:12,color:l.level==='error'?colors.accentText:colors.muted}]}>{l.text}</Text>)}
  </View>;
}

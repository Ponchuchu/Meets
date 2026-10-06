import {useQuery,useQueryClient} from '@tanstack/react-query';
import {useState} from 'react';
import {Modal,Pressable,ScrollView,Text,TextInput,View} from 'react-native';
import {create} from 'zustand';
import {persist} from 'zustand/middleware';
import {supabase,withTimeout} from '../../data/client';
import {PlacePicker} from '../../event/ui/pickers';
import {config} from '../../lib/config';
import {uid} from '../../lib/uid';
import {myId} from '../../live/auth';
import {useMyPos,setShareRules} from '../../live/location';
import {deviceStorage} from '../../state/storage';
import {colors,fonts} from '../../theme';
import {Group,Row,SettingsPage,Note} from '../../ui/v6/Settings';
interface Place {id:string;kind:string;title:string;lat:number;lon:number;auto?:boolean}
const useLocalPlaces=create<{items:Place[]}>()(persist(()=>({items:[] as Place[]}),{name:'ryadom-demo-places',storage:deviceStorage()}));
const KINDS:Record<string,string>={home:'Дом',work:'Работа',study:'Учёба',gym:'Зал',dacha:'Дача',other:'Другое'};
export default function PlacesPage(){
  const live=config.dataMode!=='demo';const qc=useQueryClient();const local=useLocalPlaces(s=>s.items);const pos=useMyPos();
  const [editing,setEditing]=useState<Place|null>(null);const [picking,setPicking]=useState(false);const [error,setError]=useState('');const [busy,setBusy]=useState(false);
  const q=useQuery({queryKey:['me','places','list'],enabled:live,queryFn:async()=>{const r=await withTimeout(supabase().from('user_places_points').select('*').eq('user_id',myId()!));if(r.error)throw r.error;return r.data as Place[];}});
  const list=live?q.data??[]:local;
  const save=async(remove=false)=>{if(!editing||busy)return;setBusy(true);setError('');try{
    if(live){const r=remove?await withTimeout(supabase().from('user_places').delete().eq('id',editing.id).eq('user_id',myId()!)):await withTimeout(supabase().from('user_places').upsert({...(editing.id?{id:editing.id}:{}),user_id:myId(),kind:editing.kind,title:editing.title.trim()||KINDS[editing.kind],point:`SRID=4326;POINT(${editing.lon} ${editing.lat})`,auto:false}));if(r.error)throw r.error;await qc.invalidateQueries({queryKey:['me','places']});}
    else useLocalPlaces.setState({items:remove?local.filter(p=>p.id!==editing.id):[...local.filter(p=>p.id!==editing.id),{...editing,id:editing.id||uid('place')}]});
    setEditing(null);await qc.invalidateQueries({queryKey:['me','stats']});
    const places=live?(await q.refetch()).data??[]:useLocalPlaces.getState().items;
    setShareRules({places:places as import('../../live/geo').Place[]});
  }catch{setError('Не удалось сохранить место. Проверь связь');}finally{setBusy(false);}};
  const text={fontFamily:fonts.body500,color:colors.ink};
  return <SettingsPage title="Мои места" sub="Добавь дом, работу или любимое место.">
    <Group>{list.map(p=><Row key={p.id} title={p.title||KINDS[p.kind]} sub={KINDS[p.kind]} onPress={()=>{setEditing(p);setError('');}}/>)}</Group>
    <Pressable style={{padding:18,borderRadius:16,backgroundColor:colors.ink}} onPress={()=>{setEditing({id:'',kind:'home',title:'',lat:pos?.lat??43.2389,lon:pos?.lon??76.8897});setError('');}}><Text style={[text,{color:colors.paper,textAlign:'center'}]}>Добавить место</Text></Pressable>
    {q.isError&&<Note>Не удалось загрузить места. Проверь связь.</Note>}
    <Note>Друзья видят только «дома» или «на работе». Точный адрес и название остаются у тебя.</Note>
    <Modal visible={!!editing} transparent animationType="slide" onRequestClose={()=>{setPicking(false);setEditing(null);}}>
      <View style={{flex:1,backgroundColor:'rgba(23,22,26,0.4)',justifyContent:'flex-end'}}>{editing&&<ScrollView style={{maxHeight:'92%',backgroundColor:colors.paper,borderTopLeftRadius:28,borderTopRightRadius:28}} contentContainerStyle={{padding:20,paddingBottom:40,gap:16}} keyboardShouldPersistTaps="handled">
        <Pressable onPress={()=>{setPicking(false);setEditing(null);}}><Text style={text}>Закрыть</Text></Pressable>
        <Text style={{fontFamily:fonts.display700,fontSize:24,color:colors.ink}}>Твоё место</Text>
        <View style={{flexDirection:'row',gap:6,flexWrap:'wrap'}}>{Object.entries(KINDS).map(([kind,title])=><Pressable key={kind} onPress={()=>setEditing({...editing,kind})} style={{padding:12,borderRadius:12,backgroundColor:editing.kind===kind?colors.ink:colors.sand}}><Text style={[text,{color:editing.kind===kind?colors.paper:colors.ink}]}>{title}</Text></Pressable>)}</View>
        <TextInput value={editing.title} onChangeText={title=>setEditing({...editing,title})} placeholder="Название для тебя" accessibilityLabel="Название места" style={[text,{padding:14,borderRadius:12,backgroundColor:colors.card}]} maxLength={80}/>
        <Pressable onPress={()=>setPicking(!picking)}><Text style={text}>{picking?'Свернуть карту':'Выбрать адрес на карте'}</Text></Pressable>
        {picking&&<PlacePicker value={{point:editing,address:editing.title,entrance:'',floor:'',apt:''}} onDone={v=>{setEditing({...editing,...v.point,title:v.address});setPicking(false);}}/>}
        {!!error&&<Text style={[text,{color:colors.accentText}]}>{error}</Text>}
        <Pressable disabled={busy} onPress={()=>void save()} style={{padding:16,borderRadius:14,backgroundColor:colors.ink}}><Text style={[text,{color:colors.paper,textAlign:'center'}]}>{busy?'Сохраняю…':'Сохранить место'}</Text></Pressable>
        {list.some(p=>p.id===editing.id)&&<Pressable onPress={()=>void save(true)}><Text style={[text,{color:colors.accentText,textAlign:'center'}]}>Удалить место</Text></Pressable>}
      </ScrollView>}</View>
    </Modal>
  </SettingsPage>;
}

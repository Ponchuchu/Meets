import {CameraView,useCameraPermissions} from 'expo-camera';
import {router} from 'expo-router';
import {useRef,useState} from 'react';
import {Pressable,Text,View} from 'react-native';
import {parseProfileLink} from '../src/profile/qr';
import {SettingsPage} from '../src/ui/v6/Settings';
import {colors,fonts} from '../src/theme';
export default function Scan(){
 const [permission,ask]=useCameraPermissions();const [error,setError]=useState('');const opening=useRef(false);
 const scanned=({data}:{data:string})=>{
  if(opening.current)return;
  const p=parseProfileLink(data);if(!p){setError('Это не QR-код профиля «рядом.»');return;}
  opening.current=true;
  router.replace(p.kind==='person'?{pathname:'/person/[id]',params:{id:p.value}}:{pathname:'/u/[handle]',params:{handle:p.value}});
 };
 return <SettingsPage title="QR друга" sub="Наведи камеру на QR-код в его профиле.">
  {permission?.granted?<View style={{height:440,borderRadius:26,overflow:'hidden',backgroundColor:colors.ink}}><CameraView style={{flex:1}} barcodeScannerSettings={{barcodeTypes:['qr']}} onBarcodeScanned={scanned}/></View>:<Pressable style={{padding:18,borderRadius:16,backgroundColor:colors.ink}} onPress={()=>void ask()}><Text style={{fontFamily:fonts.body600,color:colors.paper,textAlign:'center'}}>Разрешить камеру</Text></Pressable>}
  {!!error&&<Text style={{fontFamily:fonts.body400,color:colors.accentText}}>{error}</Text>}
 </SettingsPage>;
}

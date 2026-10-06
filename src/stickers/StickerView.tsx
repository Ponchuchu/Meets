import { Image, Text, View } from 'react-native';
import { colors, fonts } from '../theme';
import type { Sticker } from './catalog';
export function StickerView({st,size='md'}:{st:Sticker;size?:'md'|'lg'}) {
  const n=size==='lg'?150:82;
  return <View style={{width:n,height:n+24,alignItems:'center',justifyContent:'flex-end',transform:[{rotate:`${st.rot}deg`}]}}>
    <View style={{position:'absolute',width:n*0.85,height:n*0.85,borderRadius:n/2,backgroundColor:st.bg,top:n*0.12}}/>
    <View style={{width:n,height:n,overflow:'hidden'}}><Image source={require('../../assets/stickers/poses.png')} resizeMode="stretch" style={{position:'absolute',width:n*3,height:n*3,left:-(st.pose%3)*n,top:-Math.floor(st.pose/3)*n}}/></View>
    <View style={{maxWidth:n+20,paddingHorizontal:7,paddingVertical:4,marginTop:-12,borderRadius:10,backgroundColor:colors.card,borderWidth:2,borderColor:st.bg}}><Text numberOfLines={2} style={{fontFamily:fonts.display800,fontSize:size==='lg'?15:10,lineHeight:size==='lg'?18:12,textAlign:'center',color:st.fg}}>{st.label}</Text></View>
  </View>;
}

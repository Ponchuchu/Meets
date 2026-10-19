import { Image, Text, View } from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';
import { fonts } from '../theme';
import type { Sticker } from './catalog';
// Стикер — как настоящая наклейка: персонаж с белой вырубкой (в спрайте), подпись — цветная лента с белой каймой.
// Реакции (бокс, сердце…) лежат на белой подложке-наклейке. Всё статично, анимация — только по тапу (InteractiveSticker).
export function StickerView({st,size='md'}:{st:Sticker;size?:'md'|'lg'}) {
  const n=size==='lg'?150:82;
  return <View style={{width:n,height:n+24,alignItems:'center',justifyContent:'flex-end',transform:[{rotate:`${st.rot}deg`}]}}>
    {st.effect ? <View style={{width:n,height:n,alignItems:'center',justifyContent:'center'}}><View style={{position:'absolute',width:n*0.9,height:n*0.9,borderRadius:n*0.3,backgroundColor:'#FCFBF8',boxShadow:'0 6px 14px -6px rgba(23,22,26,0.35)'}}/><Svg width={n*0.82} height={n*0.82} viewBox="0 0 100 100">
      {st.effect==='punch' ? <><Path d="M21 73L24 49Q12 29 28 21Q40 11 49 21Q69 10 80 26Q86 38 78 55L73 78Z" fill="#EF4A38" stroke="#962824" strokeWidth={3}/><Path d="M20 72H74V88H20Z" fill="#FBFAF6" stroke="#962824" strokeWidth={3}/><Path d="M38 25Q32 44 44 52M50 24L51 45" fill="none" stroke="#FCA496" strokeWidth={4}/></> : st.effect==='squeak' ? <><Path d="M64 18Q89 28 69 67Q46 97 17 80Q43 63 42 45Q41 29 64 18Z" fill="#9361C7" stroke="#4F2C71" strokeWidth={3}/><Path d="M53 25L58 9L67 17L83 15L73 31L68 25Z" fill="#50944A"/><Path d="M30 77Q44 66 50 48" fill="none" stroke="#BD97E0" strokeWidth={4}/></> : st.effect==='heart' ? <Path d="M50 83Q5 57 15 31Q25 10 50 30Q75 10 85 31Q95 57 50 83Z" fill="#F47382" stroke="#B84060" strokeWidth={3}/> : <><Path d="M17 84L33 34L69 69Z" fill="#F4A342" stroke="#A35723" strokeWidth={3}/><Path d="M41 30L49 12M67 43L89 32M58 34L73 17" stroke="#9167CE" strokeWidth={5} strokeLinecap="round"/><Circle cx={26} cy={19} r={5} fill="#F47382"/><Circle cx={84} cy={56} r={5} fill="#50944A"/></>}
    </Svg></View> : <View style={{width:n,height:n,overflow:'hidden'}}><Image source={require('../../assets/stickers/poses.png')} resizeMode="stretch" style={{position:'absolute',width:n*3,height:n*3,left:-(st.pose%3)*n,top:-Math.floor(st.pose/3)*n}}/></View>}
    <View style={{maxWidth:n+20,paddingHorizontal:size==='lg'?12:8,paddingVertical:size==='lg'?5:3,marginTop:-14,borderRadius:8,backgroundColor:st.bg,borderWidth:2.5,borderColor:'#FCFBF8',transform:[{rotate:`${-st.rot*1.5}deg`}],boxShadow:'0 3px 8px -3px rgba(23,22,26,0.35)'}}><Text numberOfLines={2} maxFontSizeMultiplier={1.2} style={{fontFamily:fonts.display800,fontSize:size==='lg'?15:10,lineHeight:size==='lg'?18:12,letterSpacing:0.2,textAlign:'center',color:st.fg}}>{st.label}</Text></View>
  </View>;
}

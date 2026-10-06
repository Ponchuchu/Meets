import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { PACKS, STICKERS, stickerUnlocked, type Sticker } from './catalog';
import { StickerView } from './StickerView';
import { colors, fonts } from '../theme';
export function StickerPicker({level,onSelect}:{level:number;onSelect:(s:Sticker)=>void}) {
  const [pack,setPack]=useState(PACKS[0].id);
  return <View style={{gap:14}}>
    <View style={{flexDirection:'row',gap:6,flexWrap:'wrap'}}>{PACKS.map(p=><Pressable key={p.id} onPress={()=>setPack(p.id)} style={{padding:10,borderRadius:14,backgroundColor:pack===p.id?colors.ink:p.bg}}><Text style={{fontFamily:fonts.body600,color:pack===p.id?colors.paper:colors.ink}}>{p.title}{p.level>level?` · ур. ${p.level}`:''}</Text></Pressable>)}</View>
    <ScrollView style={{maxHeight:350}} contentContainerStyle={{flexDirection:'row',flexWrap:'wrap',justifyContent:'space-around',gap:12,padding:6}}>
      {STICKERS.filter(s=>s.pack===pack).map(s=><Pressable key={s.id} disabled={!stickerUnlocked(s,level)} onPress={()=>onSelect(s)} accessibilityRole="button" accessibilityLabel={s.label} accessibilityState={{disabled:!stickerUnlocked(s,level)}} style={{opacity:stickerUnlocked(s,level)?1:0.4}}><StickerView st={s}/></Pressable>)}
    </ScrollView>
    <Text style={{fontFamily:fonts.body400,color:colors.muted}}>51 стикер · новые коллекции на уровнях 3 и 7</Text>
  </View>;
}

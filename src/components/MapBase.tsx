// Статичная подложка карты из design/screens/MapBase.dc.html (390×844): paper / night / mono.
// Используется на старте регистрации и как карта без токена/сети.
import Svg, { Path, Rect, Text as SvgText } from 'react-native-svg';
import { fonts, mapPalettes, type MapTheme } from '../theme';

export function MapBase({ theme = 'paper', width = 390, height = 844 }: { theme?: MapTheme; width?: number | `${number}%`; height?: number | `${number}%` }) {
  const c = mapPalettes[theme];
  const label = { fontFamily: fonts.mono500, fontSize: 7.5, letterSpacing: 1.5, fill: c.label };
  const district = { fontFamily: fonts.mono600, fontSize: 10, fontWeight: '600' as const, fill: c.district };
  return (
    <Svg width={width} height={height} viewBox="0 0 390 844" preserveAspectRatio="xMidYMid slice">
      <Rect x={0} y={0} width={390} height={844} fill={c.land} />
      <Path d="M18 0V660M90 0V660M162 0V660M234 0V660M306 0V660M378 0V660M0 22H390M0 90H390M0 226H390M0 362H390M0 430H390M0 566H390" stroke={c.street} strokeWidth={2} fill="none" />
      <Rect x={282} y={432} width={50} height={86} rx={8} fill={c.park} />
      <Rect x={204} y={232} width={40} height={40} rx={8} fill={c.park} />
      <Rect x={132} y={540} width={62} height={54} rx={8} fill={c.park} />
      <Path d="M0 668 C40 652 76 680 116 662 C156 644 190 674 232 656 C272 640 310 668 350 650 C368 642 382 648 390 644 V844 H0 Z" fill={c.mountains[0]} />
      <Path d="M0 740 C50 718 92 748 142 726 C192 706 234 738 284 716 C326 698 362 724 390 708 V844 H0 Z" fill={c.mountains[1]} />
      <Path d="M0 796 C60 772 104 802 164 780 C216 762 262 792 322 768 C352 756 374 766 390 758 V844 H0 Z" fill={c.mountains[2]} />
      <Path d="M318 844 C312 790 296 740 300 690 C304 640 290 590 294 530 C298 470 280 420 286 350 C292 280 272 210 278 140 C282 80 268 40 272 0" stroke={c.water} strokeWidth={4} fill="none" strokeLinecap="round" />
      <Path d="M0 158H390M0 294H390M0 396H390M0 498H390M54 0V650M126 0V650M198 0V640M270 0V600C272 640 286 672 304 720M0 622C120 612 250 628 390 606" stroke={c.highway} strokeWidth={5} fill="none" strokeLinecap="round" />
      <SvgText x={206} y={390} {...label}>АБАЯ</SvgText>
      <SvgText x={266} y={130} {...label} transform="rotate(-90 266 130)">ДОСТЫК</SvgText>
      <SvgText x={136} y={616} {...label}>АЛЬ-ФАРАБИ</SvgText>
      <SvgText x={64} y={350} {...district} letterSpacing={5}>АЛМАЛЫ</SvgText>
      <SvgText x={292} y={214} {...district} letterSpacing={5}>МЕДЕУ</SvgText>
      <SvgText x={112} y={812} {...district} letterSpacing={6}>ИЛЕ АЛАТАУ</SvgText>
    </Svg>
  );
}

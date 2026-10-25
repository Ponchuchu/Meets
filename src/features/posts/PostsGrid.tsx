// Сетка постов в профиле (26 октября, как в Instagram): квадраты в три колонки, у карусели — значок «несколько фото»,
// у поста с событием — маленький объёмный значок события. У себя первой клеткой — «Новый пост».
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Camera, Layers, Plus } from 'lucide-react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { photo as photoSrc } from '../../data/photos';
import type { Post } from '../../live/posts';
import { colors, fonts } from '../../theme';
import { EventIcon } from '../../ui/EventIcon';

export function PostsGrid({ posts, mine, title = 'Воспоминания' }: { posts: Post[]; mine?: boolean; title?: string }) {
  if (!posts.length && !mine) return null;
  const add = () => router.push('/post/new');
  return (
    <View style={{ gap: 10 }}>
      <View style={styles.head}>
        <Text style={styles.title}>{title}</Text>
        {posts.length > 0 && <Text style={styles.n}>{posts.length}</Text>}
        <View style={{ flex: 1 }} />
        {mine && posts.length > 0 && (
          <Pressable onPress={add} style={styles.addBtn} accessibilityRole="button" accessibilityLabel="Новый пост" hitSlop={6}>
            <Plus size={18} color={colors.ink} strokeWidth={2.2} />
          </Pressable>
        )}
      </View>
      {!posts.length ? (
        <Pressable onPress={add} style={({ pressed }) => [styles.empty, pressed && { opacity: 0.8 }]} accessibilityRole="button">
          <View style={styles.emptyIcon}><Camera size={24} color={colors.ink} strokeWidth={1.9} /></View>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={styles.emptyTitle}>Выложи первое фото</Text>
            <Text style={styles.emptyText}>С вечера, похода или концерта — прикрепи событие и отметь друзей</Text>
          </View>
          <View style={styles.emptyPlus}><Plus size={20} color="#FFFFFF" strokeWidth={2.4} /></View>
        </Pressable>
      ) : (
        <View style={styles.grid}>
          {posts.slice(0, 30).map((p) => (
            <Pressable key={p.id} onPress={() => router.push({ pathname: '/post/[id]', params: { id: p.id } })} style={({ pressed }) => [styles.cell, pressed && { opacity: 0.85 }]}
              accessibilityRole="button" accessibilityLabel={`Пост${p.event ? `: ${p.event.title}` : ''}${p.caption ? `. ${p.caption.slice(0, 60)}` : ''}`}>
              <Image source={photoSrc(p.photos[0]?.url)} style={StyleSheet.absoluteFill} contentFit="cover" cachePolicy="memory-disk" recyclingKey={p.id} />
              {p.photos.length > 1 && <View style={styles.multi}><Layers size={15} color="#FFFFFF" strokeWidth={2.2} /></View>}
              {p.event && <View style={styles.ev}><EventIcon e={{ category: p.event.category as never, title: p.event.title, venueName: p.event.venue_name }} size={22} /></View>}
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 32, paddingHorizontal: 4 },
  title: { fontFamily: fonts.display700, fontSize: 19, letterSpacing: -0.3, color: colors.ink },
  n: { fontFamily: fonts.body600, fontSize: 15, color: colors.muted },
  addBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#FBFAF6', alignItems: 'center', justifyContent: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 3, borderRadius: 22, overflow: 'hidden' },
  cell: { width: '32.7%', aspectRatio: 1, backgroundColor: colors.sand, overflow: 'hidden' },
  multi: { position: 'absolute', top: 6, right: 6 },
  ev: { position: 'absolute', left: 6, bottom: 6, width: 30, height: 30, borderRadius: 15, backgroundColor: 'rgba(255,255,255,0.92)', alignItems: 'center', justifyContent: 'center' },
  empty: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 24, backgroundColor: '#FBFAF6' },
  emptyIcon: { width: 48, height: 48, borderRadius: 16, backgroundColor: colors.sand, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { fontFamily: fonts.body700, fontSize: 15.5, color: colors.ink },
  emptyText: { fontFamily: fonts.body400, fontSize: 13, lineHeight: 17, color: colors.muted },
  emptyPlus: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
});

import { useEffect, useState } from "react";
import { View, ScrollView, RefreshControl } from "react-native";
import { useRouter } from "expo-router";
import { newsApi, type NewsPost } from "@/lib/api";
import { useTheme } from "@/src/theme";
import { H2, Body, Caption } from "@/src/components/typography";
import { Card } from "@/src/components/cards";
import { EmptyState } from "@/src/components/feedback";
import { bodyFont } from "@/src/theme/typography";
import { Newspaper, ChevronRight, Megaphone } from "lucide-react-native";

function formatDate(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export default function SchoolNews() {
  const router = useRouter();
  const { colors, spacing } = useTheme();
  const [posts, setPosts] = useState<NewsPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  async function load() {
    try {
      setError(null);
      const res = await newsApi.list();
      setPosts(res.posts || []);
    } catch {
      setError("Couldn't load school news right now.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }
  useEffect(() => {
    void load();
  }, []);

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background.primary }}
      contentContainerStyle={{ padding: spacing.lg, paddingTop: 56 }}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load(); }} tintColor={colors.brand.greenLight} />
      }
    >
      <H2 style={{ marginBottom: spacing.xs }}>School News</H2>
      <Caption style={{ marginBottom: spacing.lg }}>Updates from Ykay College.</Caption>

      {!loading && error ? (
        <EmptyState icon={<Megaphone size={44} color={colors.border.strong} />} title={error} />
      ) : posts.length === 0 ? (
        <EmptyState icon={<Newspaper size={48} color={colors.border.strong} />} title="No news yet" message="School updates will appear here." />
      ) : (
        posts.map((post) => (
          <Card
            key={post.id}
            variant="default"
            padding={spacing.md}
            onPress={() => router.push({ pathname: "/news-detail", params: { slug: post.slug } })}
            style={{ marginBottom: spacing.sm }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <Caption style={{ color: colors.brand.greenLight, fontFamily: bodyFont("bold"), textTransform: "uppercase", letterSpacing: 0.8 }}>
                {post.category || "News"}
              </Caption>
              <Caption>{formatDate(post.publishedAt)}</Caption>
            </View>
            <Body tone="primary" style={{ fontFamily: bodyFont("bold"), fontSize: 16, lineHeight: 22, marginTop: 6 }}>
              {post.title}
            </Body>
            {post.excerpt ? (
              <Caption style={{ marginTop: 6, lineHeight: 18 }} numberOfLines={2}>
                {post.excerpt}
              </Caption>
            ) : null}
            <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: spacing.sm }}>
              <Caption style={{ color: colors.brand.greenLight, fontFamily: bodyFont("medium") }}>Read more</Caption>
              <ChevronRight size={14} color={colors.brand.greenLight} />
            </View>
          </Card>
        ))
      )}
    </ScrollView>
  );
}

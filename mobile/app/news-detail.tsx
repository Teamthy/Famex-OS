import { useEffect, useState } from "react";
import { View, ScrollView } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { newsApi, type NewsDetail } from "@/lib/api";
import { useTheme } from "@/src/theme";
import { Body, Caption } from "@/src/components/typography";
import { Card } from "@/src/components/cards";
import { EmptyState, Loading } from "@/src/components/feedback";
import { bodyFont } from "@/src/theme/typography";

function formatDate(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}

export default function NewsDetailScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const router = useRouter();
  const { colors, spacing } = useTheme();
  const [post, setPost] = useState<NewsDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await newsApi.get(slug);
        if (active) {
          setPost(res.post);
          setLoading(false);
        }
      } catch {
        if (active) {
          setError("This article could not be loaded.");
          setLoading(false);
        }
      }
    })();
    return () => {
      active = false;
    };
  }, [slug]);

  if (loading) return <Loading label="Loading article…" />;

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.background.primary }} contentContainerStyle={{ padding: spacing.lg, paddingTop: 56, paddingBottom: spacing.xxl }}>
      {error ? (
        <EmptyState icon={undefined} title={error} />
      ) : post ? (
        <Card variant="bordered" padding={spacing.lg}>
          <Caption style={{ color: colors.brand.greenLight, fontFamily: bodyFont("bold"), textTransform: "uppercase", letterSpacing: 0.8 }}>
            {post.category || "News"}
          </Caption>
          <Body tone="primary" style={{ fontFamily: bodyFont("bold"), fontSize: 22, lineHeight: 28, marginTop: spacing.sm }}>
            {post.title}
          </Body>
          <Caption style={{ marginTop: spacing.sm, marginBottom: spacing.md }}>{formatDate(post.publishedAt)}</Caption>
          <View style={{ height: 1, backgroundColor: colors.border.subtle, marginBottom: spacing.md }} />
          <Body tone="primary" style={{ fontSize: 15.5, lineHeight: 25 }}>
            {post.content}
          </Body>
        </Card>
      ) : null}
    </ScrollView>
  );
}

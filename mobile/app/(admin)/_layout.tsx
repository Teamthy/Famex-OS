import { Tabs } from "expo-router";
import { Home, User } from "lucide-react-native";
import { Colors } from "@/src/theme/colors";

export default function AdminLayout() {
  return (
    <Tabs screenOptions={{
      headerShown: false,
      tabBarStyle: { backgroundColor: Colors.background.elevated, borderTopColor: Colors.border.subtle, paddingBottom: 4, paddingTop: 4 },
      tabBarActiveTintColor: Colors.brand.greenLight,
      tabBarInactiveTintColor: Colors.text.muted,
      tabBarLabelStyle: { fontSize: 11, fontWeight: "600", fontFamily: "DM Sans" },
    }}>
      <Tabs.Screen name="dashboard" options={{ title: "Overview", tabBarIcon: ({ color }) => <Home size={22} color={color} /> }} />
      <Tabs.Screen name="profile" options={{ title: "Profile", tabBarIcon: ({ color }) => <User size={22} color={color} /> }} />
    </Tabs>
  );
}

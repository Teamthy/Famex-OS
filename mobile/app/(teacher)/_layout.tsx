import { Tabs } from "expo-router";
import { Home, ClipboardCheck, BookOpen, Users, User } from "lucide-react-native";
import { Colors } from "@/src/theme/colors";

export default function TeacherLayout() {
  return (
    <Tabs screenOptions={{
      headerShown: false,
      tabBarStyle: { backgroundColor: Colors.background.elevated, borderTopColor: Colors.border.subtle, paddingBottom: 4, paddingTop: 4 },
      tabBarActiveTintColor: Colors.brand.greenLight,
      tabBarInactiveTintColor: Colors.text.muted,
      tabBarLabelStyle: { fontSize: 11, fontWeight: "600", fontFamily: "DM Sans" },
    }}>
      <Tabs.Screen name="dashboard" options={{ title: "Home", tabBarIcon: ({ color }) => <Home size={22} color={color} /> }} />
      <Tabs.Screen name="attendance" options={{ title: "Attendance", tabBarIcon: ({ color }) => <ClipboardCheck size={22} color={color} /> }} />
      <Tabs.Screen name="gradebook" options={{ title: "Gradebook", tabBarIcon: ({ color }) => <BookOpen size={22} color={color} /> }} />
      <Tabs.Screen name="students" options={{ title: "Students", tabBarIcon: ({ color }) => <Users size={22} color={color} /> }} />
      <Tabs.Screen name="profile" options={{ title: "Profile", tabBarIcon: ({ color }) => <User size={22} color={color} /> }} />
    </Tabs>
  );
}

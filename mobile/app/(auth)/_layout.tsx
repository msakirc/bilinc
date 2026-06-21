import { Stack } from 'expo-router';

export default function AuthLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="welcome" />
      <Stack.Screen name="onboarding" />
      <Stack.Screen name="login" />
      <Stack.Screen name="register" />
      <Stack.Screen name="setup-security" />
      <Stack.Screen name="reset-password" />
      <Stack.Screen name="legal/[doc]" />
    </Stack>
  );
}

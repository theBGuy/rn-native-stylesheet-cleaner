// @ts-nocheck
import { StyleSheet, View } from "react-native";
export function TestComponent() {
  return <View style={styles.container}>Test</View>;
}
const styles = StyleSheet.create({
  container: { flex: 1 },
  unused: { flex: 2 },
});
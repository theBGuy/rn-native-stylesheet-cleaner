// @ts-nocheck
import { StyleSheet, View, Text } from "react-native";
import { type ActivityIndicatorProps, ActivityIndicator as PaperActivityIndicator } from "react-native-paper";

type Props = {
  title: string;
};

export function TypeScriptComponent({ title }: Props) {
  const helloWorld = (msg: string) => {
    console.log("Hello!");
  };
  
  return (
    <View style={styles.container}>
      <Text style={styles.text}>{title}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  // container: { flex: 1 },
  // text: { color: 'blue' },
  unused: { flex: 2 },
});
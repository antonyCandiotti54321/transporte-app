import { useRouter, useNavigationContainerRef } from 'expo-router';
import { useEffect } from 'react';
import { View, Text } from 'react-native';

export default function Index() {
  const router = useRouter();

  useEffect(() => {
    const timeout = setTimeout(() => {
      router.replace('/login');
    }, 0); // Espera un microtiempo para evitar errores

    return () => clearTimeout(timeout);
  }, []);

  return (
    <View>
      <Text>Redirigiendo...</Text>
    </View>
  );
}

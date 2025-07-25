import { useState } from 'react';
import { View, Text, TextInput, Button, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';

export default function LoginScreen() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const router = useRouter();

  const handleLogin = async () => {
    try {
      const response = await fetch('https://api-transporte-98xe.onrender.com/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      const data = await response.json();

      if (response.ok) {
        await AsyncStorage.setItem('token', data.token);
        await AsyncStorage.setItem('nombreCompleto', data.nombreCompleto);
        await AsyncStorage.setItem('idUsuario', data.idUsuario.toString());
        await AsyncStorage.setItem('rol', data.rol);

        Alert.alert('Éxito', 'Sesión iniciada correctamente');
        router.replace('/home');
      } else {
        Alert.alert('Error', data?.message || 'Credenciales incorrectas');
      }
    } catch (error) {
      Alert.alert('Error', 'No se pudo conectar con el servidor');
    }
  };

  return (
    <View style={{ padding: 20 }}>
      <Text>Usuario</Text>
      <TextInput
        placeholder="nombre de usuario"
        value={username}
        onChangeText={setUsername}
        style={{ borderWidth: 1, padding: 10, marginBottom: 10 }}
        autoCapitalize="none"
      />
      <Text>Contraseña</Text>
      <TextInput
        placeholder="••••••"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
        style={{ borderWidth: 1, padding: 10, marginBottom: 20 }}
      />
      <Button title="Iniciar sesión" onPress={handleLogin} />
    </View>
  );
}

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Client } from '@stomp/stompjs';
import SockJS from 'sockjs-client';
import * as Location from 'expo-location';
import { useEffect, useRef, useState } from 'react';
import { Alert, Text, View } from 'react-native';

export default function Home() {
  const [location, setLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [payloadVisible, setPayloadVisible] = useState<string | null>(null);
  const stompClient = useRef<Client | null>(null);
  const intervalRef = useRef<number | null>(null);


  useEffect(() => {
    const pedirPermisoYConectar = async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permiso denegado', 'Se requiere acceso a la ubicación');
        return;
      }

      try {
        const token = await AsyncStorage.getItem('token');
        const idString = await AsyncStorage.getItem('id');
        const id = idString ? parseInt(idString) : null;

        if (!token || !id) {
          Alert.alert('Error', 'Token o ID no encontrado');
          console.log('token:', token);
          console.log('id:', id);
          return;
        }

        const client = new Client({
          webSocketFactory: () => new SockJS(`https://transporte-ecug.onrender.com/ws?token=${token}`),
          debug: (str) => console.log('STOMP:', str),
          onConnect: async () => {
            console.log('✅ Conectado por STOMP con SockJS');

            // Inicia el envío periódico cada 5 segundos
            intervalRef.current = setInterval(async () => {
              const loc = await Location.getCurrentPositionAsync({});
              setLocation(loc.coords);

              const payload = {
                id: id,
                latitud: loc.coords.latitude,
                longitud: loc.coords.longitude,
              };

              setPayloadVisible(JSON.stringify(payload, null, 2));

              client.publish({
                destination: '/app/ubicacion',
                body: JSON.stringify(payload),
              });

              console.log('📡 Payload enviado:', payload);
            }, 5000);
          },
          onStompError: (frame) => {
            console.error('❌ Error STOMP:', frame.headers['message']);
            console.error('Detalles:', frame.body);
          },
        });

        stompClient.current = client;
        client.activate();
      } catch (e) {
        console.log('Error al obtener token o ubicación:', e);
      }
    };

    pedirPermisoYConectar();

    return () => {
      // Limpieza
      stompClient.current?.deactivate();
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  return (
    <View style={{ padding: 20 }}>
      <Text style={{ fontWeight: 'bold', fontSize: 16 }}>Ubicación actual:</Text>
      {location ? (
        <Text>Lat: {location.latitude}, Lng: {location.longitude}</Text>
      ) : (
        <Text>Obteniendo ubicación...</Text>
      )}

      {payloadVisible && (
        <View style={{ marginTop: 20 }}>
          <Text style={{ fontWeight: 'bold' }}>Payload enviado:</Text>
          <Text style={{ fontFamily: 'monospace' }}>{payloadVisible}</Text>
        </View>
      )}
    </View>
  );
}

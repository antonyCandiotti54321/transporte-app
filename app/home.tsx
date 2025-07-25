import AsyncStorage from '@react-native-async-storage/async-storage';
import { Client } from '@stomp/stompjs';
import SockJS from 'sockjs-client';
import { useEffect, useRef, useState } from 'react';
import { Alert, Text, View, Button } from 'react-native';

type Coordenada = {
  latitud: number;
  longitud: number;
};

export default function Home() {
  const [location, setLocation] = useState<Coordenada | null>(null);
  const [payloadVisible, setPayloadVisible] = useState<string | null>(null);
  const [enviandoUbicacion, setEnviandoUbicacion] = useState(false);

  const stompClient = useRef<Client | null>(null);
  const ubicacionesRef = useRef<Coordenada[]>([]);

  const saveIntervalRef = useRef<number | null>(null);
  const sendIntervalRef = useRef<number | null>(null);

  const idRef = useRef<number | null>(null);
  const baseLat = useRef(-12.05);
  const baseLng = useRef(-77.04);

  useEffect(() => {
    const inicializar = async () => {
      const token = await AsyncStorage.getItem('token');
      const idString = await AsyncStorage.getItem('idUsuario');
      const id = idString ? parseInt(idString) : null;
      idRef.current = id;

      if (!token || !id) {
        Alert.alert('Error', 'Token o ID no encontrado');
        return;
      }

      const client = new Client({
        webSocketFactory: () => new SockJS(`https://api-transporte-98xe.onrender.com/ws?token=${token}`),
        debug: (str) => console.log('STOMP:', str),
        onConnect: () => {
          console.log('✅ Conectado STOMP');
        },
        onStompError: (frame) => {
          console.error('❌ Error STOMP:', frame.headers['message']);
          console.error('Detalles:', frame.body);
        },
      });

      stompClient.current = client;
      client.activate();
    };

    inicializar();

    return () => {
      stopSending();
      stompClient.current?.deactivate();
    };
  }, []);

  const generateFakeLocation = (): Coordenada => {
    const delta = 0.00002;
    const rand = Math.random() * 100;
    let latOffset = 0;
    let lngOffset = 0;

    if (rand < 60) {
      // 60% ir adelante
      latOffset = delta;
    } else if (rand < 75) {
      // 15% adelante izquierda o derecha
      latOffset = delta;
      lngOffset = Math.random() < 0.5 ? -delta : delta;
    } else if (rand < 80) {
      // 5% atrás izquierda o derecha
      latOffset = -delta;
      lngOffset = Math.random() < 0.5 ? -delta : delta;
    } else {
      // 20% no se mueve (queda quieto)
      latOffset = 0;
      lngOffset = 0;
    }

    baseLat.current += latOffset;
    baseLng.current += lngOffset;

    return {
      latitud: parseFloat(baseLat.current.toFixed(6)),
      longitud: parseFloat(baseLng.current.toFixed(6)),
    };
  };

  const startSending = () => {
    if (!stompClient.current?.connected || !idRef.current) return;
    setEnviandoUbicacion(true);

    // ✅ Guardar ubicación cada 0.4 segundos
    saveIntervalRef.current = setInterval(() => {
      const ubicacion = generateFakeLocation();
      ubicacionesRef.current.push(ubicacion);
      setLocation(ubicacion);
    }, 400) as unknown as number;

    // ✅ Enviar paquete cada 5 segundos
    sendIntervalRef.current = setInterval(() => {
      if (ubicacionesRef.current.length === 0) return;

      const payload = {
        id: idRef.current,
        ubicaciones: [...ubicacionesRef.current],
      };

      stompClient.current?.publish({
        destination: '/app/ubicacion',
        body: JSON.stringify(payload),
      });

      console.log('📦 Enviado paquete con', ubicacionesRef.current.length, 'ubicaciones');
      setPayloadVisible(JSON.stringify(payload, null, 2));
      ubicacionesRef.current = [];
    }, 5000) as unknown as number;
  };

  const stopSending = () => {
    if (saveIntervalRef.current !== null) clearInterval(saveIntervalRef.current);
    if (sendIntervalRef.current !== null) clearInterval(sendIntervalRef.current);

    saveIntervalRef.current = null;
    sendIntervalRef.current = null;
    setEnviandoUbicacion(false);
    console.log('⛔ Envío detenido');
  };

  return (
    <View style={{ padding: 20 }}>
      <Text style={{ fontWeight: 'bold', fontSize: 16 }}>Ubicación actual:</Text>
      {location ? (
        <Text>Lat: {location.latitud}, Lng: {location.longitud}</Text>
      ) : (
        <Text>Ubicación no disponible</Text>
      )}

      <View style={{ marginTop: 20 }}>
        {!enviandoUbicacion ? (
          <Button title="Iniciar envío de ubicaciones" onPress={startSending} />
        ) : (
          <Button title="Detener envío" onPress={stopSending} color="red" />
        )}
      </View>

      {payloadVisible && (
        <View style={{ marginTop: 20 }}>
          <Text style={{ fontWeight: 'bold' }}>Último paquete enviado:</Text>
          <Text style={{ fontFamily: 'monospace' }}>{payloadVisible}</Text>
        </View>
      )}
    </View>
  );
}

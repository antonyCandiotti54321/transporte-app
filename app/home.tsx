// imports
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Client } from '@stomp/stompjs';
import SockJS from 'sockjs-client';
import { useEffect, useRef, useState } from 'react';
import { Alert, Text, View, Button, ScrollView } from 'react-native';
import { useNavigation } from '@react-navigation/native';

type Coordenada = {
  latitud: number;
  longitud: number;
};

export default function Home() {
  const [location, setLocation] = useState<Coordenada | null>(null);
  const [payloadVisible, setPayloadVisible] = useState<string | null>(null);
  const [enviandoUbicacion, setEnviandoUbicacion] = useState(false);
  const [simulando10, setSimulando10] = useState(false);

  const stompClient = useRef<Client | null>(null);
  const ubicacionesRef = useRef<Coordenada[]>([]);
  const saveIntervalRef = useRef<number | null>(null);
  const sendIntervalRef = useRef<number | null>(null);

  const idRef = useRef<number | null>(null);
  const lastPositionRef = useRef<Coordenada>({ latitud: -12.05, longitud: -77.04 });

  const fakeDrivers = useRef<{
    [id: number]: {
      ubicaciones: Coordenada[];
      lastPosition: Coordenada;
      saveInterval: number;
      sendInterval: number;
    };
  }>({});

  const navigation = useNavigation<any>();

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
        onConnect: () => console.log('✅ Conectado STOMP'),
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
      stopSimulacion10();
      stompClient.current?.deactivate();
    };
  }, []);

  const generateFakeLocation = (prev: Coordenada): Coordenada => {
    const delta = 0.0002;
    const rand = Math.random() * 100;
    let latOffset = 0;
    let lngOffset = 0;

    if (rand < 60) {
      latOffset = delta;
    } else if (rand < 75) {
      latOffset = delta;
      lngOffset = Math.random() < 0.5 ? delta : -delta;
    } else if (rand < 80) {
      latOffset = -delta;
      lngOffset = Math.random() < 0.5 ? delta : -delta;
    } else {
      lngOffset = Math.random() < 0.5 ? delta : -delta;
    }

    const newLat = parseFloat((prev.latitud + latOffset).toFixed(6));
    const newLng = parseFloat((prev.longitud + lngOffset).toFixed(6));
    return { latitud: newLat, longitud: newLng };
  };

  const startSending = () => {
    if (!stompClient.current?.connected || !idRef.current) return;
    if (saveIntervalRef.current || sendIntervalRef.current) return;
    setEnviandoUbicacion(true);

    saveIntervalRef.current = setInterval(() => {
      const nuevaUbicacion = generateFakeLocation(lastPositionRef.current);
      lastPositionRef.current = nuevaUbicacion;
      ubicacionesRef.current.push(nuevaUbicacion);
      setLocation(nuevaUbicacion);
    }, 200) as unknown as number;

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

  const startSimulacion10 = () => {
    if (!stompClient.current?.connected || simulando10) return;
    setSimulando10(true);

    for (let i = 1; i <= 10; i++) {
      const initialLat = -12.05 + i * 0.002;
      const initialLng = -77.04 + i * 0.002;
      const ubicaciones: Coordenada[] = [];
      let lastPosition = { latitud: initialLat, longitud: initialLng };

      const saveInterval = setInterval(() => {
        const nuevaUbicacion = generateFakeLocation(lastPosition);
        lastPosition = nuevaUbicacion;
        ubicaciones.push(nuevaUbicacion);
      }, 200) as unknown as number;

      const sendInterval = setInterval(() => {
        if (ubicaciones.length === 0) return;
        const payload = { id: i, ubicaciones: [...ubicaciones] };

        stompClient.current?.publish({
          destination: '/app/ubicacion',
          body: JSON.stringify(payload),
        });

        console.log(`🚛 Chofer ${i}: enviado ${ubicaciones.length} ubicaciones`);
        ubicaciones.length = 0;
      }, 5000) as unknown as number;

      fakeDrivers.current[i] = {
        ubicaciones,
        lastPosition,
        saveInterval,
        sendInterval,
      };
    }
  };

  const stopSimulacion10 = () => {
    Object.values(fakeDrivers.current).forEach((driver) => {
      clearInterval(driver.saveInterval);
      clearInterval(driver.sendInterval);
    });
    fakeDrivers.current = {};
    setSimulando10(false);
    console.log('⛔ Simulación de 10 choferes detenida');
  };

  const cerrarSesion = async () => {
    await AsyncStorage.removeItem('token');
    await AsyncStorage.removeItem('idUsuario');
    navigation.reset({
      index: 0,
      routes: [{ name: 'login' }],
    });
  };

  return (
    <ScrollView contentContainerStyle={{ padding: 20 }}>
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

      <View style={{ marginTop: 20 }}>
        {!simulando10 ? (
          <Button title="Simular 10 choferes" onPress={startSimulacion10} color="green" />
        ) : (
          <Button title="Detener simulación de 10 choferes" onPress={stopSimulacion10} color="orange" />
        )}
      </View>

      {payloadVisible && (
        <View style={{ marginTop: 20 }}>
          <Text style={{ fontWeight: 'bold' }}>Último paquete enviado:</Text>
          <Text style={{ fontFamily: 'monospace' }}>{payloadVisible}</Text>
        </View>
      )}

      {/* Botón de Cerrar Sesión */}
      <View style={{ marginTop: 40 }}>
        <Button title="Cerrar sesión" color="#555" onPress={cerrarSesion} />
      </View>
    </ScrollView>
  );
}

import { Image } from 'expo-image';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Button, Platform, StyleSheet } from 'react-native';
import Geolocation, { type GeolocationResponse } from '@react-native-community/geolocation';
import MapView, { Marker } from 'react-native-maps';

import { HelloWave } from '@/components/hello-wave';
import ParallaxScrollView from '@/components/parallax-scroll-view';
import TextHelloWorld from '@/components/TextHelloWorld';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { EmailInput } from '@/components/EmailInput';
import { FlipWebView } from '@/components/FlipWebView';
import { Link } from 'expo-router';

function getCurrentPosition(options: {
  timeout?: number;
  maximumAge?: number;
  enableHighAccuracy?: boolean;
}) {
  return new Promise<GeolocationResponse>((resolve, reject) => {
    Geolocation.getCurrentPosition(resolve, reject, options);
  });
}

export default function HomeScreen() {
  const [email, setEmail] = useState('');
  const [location, setLocation] = useState<GeolocationResponse | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [isLoadingLocation, setIsLoadingLocation] = useState(false);

  const requestLocationPermission = useCallback(async () => {
    if (Platform.OS === 'web') {
      setLocationError('Location is only available on iOS and Android.');
      return false;
    }

    if (Platform.OS === 'android') {
      const { PermissionsAndroid } = await import('react-native');
      const permission = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
        {
          title: 'Location permission',
          message: 'We use your location to center the map on your last known position.',
          buttonPositive: 'Allow',
          buttonNegative: 'Deny',
        }
      );

      return permission === PermissionsAndroid.RESULTS.GRANTED;
    }

    return await new Promise<boolean>((resolve) => {
      Geolocation.requestAuthorization(
        () => resolve(true),
        () => resolve(false)
      );
    });
  }, []);

  const loadLastKnownLocation = useCallback(async () => {
    setIsLoadingLocation(true);
    setLocationError(null);

    const granted = await requestLocationPermission();
    if (!granted) {
      setLocationError('Location permission was denied.');
      setIsLoadingLocation(false);
      return;
    }

    try {
      const lastKnownPosition = await getCurrentPosition({
        maximumAge: Infinity,
        timeout: 1500,
        enableHighAccuracy: false,
      });

      setLocation(lastKnownPosition);
    } catch (error) {
      const geolocationError = error as { message?: string };
      setLocationError(geolocationError.message ?? 'Unable to get the last known location.');
    } finally {
      setIsLoadingLocation(false);
    }
  }, [requestLocationPermission]);

  const mapRegion = useMemo(() => {
    if (!location) {
      return {
        latitude: 37.78825,
        longitude: -122.4324,
        latitudeDelta: 0.06,
        longitudeDelta: 0.03,
      };
    }

    return {
      latitude: location.coords.latitude,
      longitude: location.coords.longitude,
      latitudeDelta: 0.01,
      longitudeDelta: 0.01,
    };
  }, [location]);

  return (
    <ParallaxScrollView
      headerBackgroundColor={{ light: '#A1CEDC', dark: '#1D3D47' }}
      headerImage={
        <Image
          source={require('@/assets/images/partial-react-logo.png')}
          style={styles.reactLogo}
        />
      }>
      <ThemedView style={styles.titleContainer}>
        <ThemedText type="title">Welcome!</ThemedText>
        <HelloWave />
      </ThemedView>
      <ThemedView style={styles.stepContainer}>
        <ThemedText type="subtitle">Test Email Input</ThemedText>
        <EmailInput value={email} onChangeText={setEmail} />
      </ThemedView>
      <ThemedView style={styles.stepContainer}>
        <ThemedText type="subtitle">Test WebView</ThemedText>
        <FlipWebView />
      </ThemedView>
      <TextHelloWorld stepContainer={styles.stepContainer} />
      <ThemedView style={styles.stepContainer}>
        <Link href="/modal">
          <Link.Trigger>
            <ThemedText type="subtitle">Step 2: Explore</ThemedText>
          </Link.Trigger>
          <Link.Preview />
          <Link.Menu>
            <Link.MenuAction title="Action" icon="cube" onPress={() => alert('Action pressed')} />
            <Link.MenuAction
              title="Share"
              icon="square.and.arrow.up"
              onPress={() => alert('Share pressed')}
            />
            <Link.Menu title="More" icon="ellipsis">
              <Link.MenuAction
                title="Delete"
                icon="trash"
                destructive
                onPress={() => alert('Delete pressed')}
              />
            </Link.Menu>
          </Link.Menu>
        </Link>

        <ThemedText>
          {`Tap the Explore tab to learn more about what's included in this starter app.`}
        </ThemedText>
      </ThemedView>
      <ThemedView style={styles.stepContainer}>
        <ThemedText type="subtitle">Last Known Location</ThemedText>
        <Button
          title={isLoadingLocation ? 'Loading location...' : 'Load last known location'}
          onPress={loadLastKnownLocation}
          disabled={isLoadingLocation}
        />
        {isLoadingLocation && <ActivityIndicator />}
        {locationError ? <ThemedText>{locationError}</ThemedText> : null}
        {Platform.OS !== 'web' ? (
          <MapView style={styles.map} region={mapRegion}>
            {location ? (
              <Marker
                coordinate={{
                  latitude: location.coords.latitude,
                  longitude: location.coords.longitude,
                }}
                title="Last known location"
              />
            ) : null}
          </MapView>
        ) : (
          <ThemedText>Map preview is not available on web for react-native-maps.</ThemedText>
        )}
        {location ? (
          <ThemedText>
            {`Lat: ${location.coords.latitude.toFixed(6)}, Lng: ${location.coords.longitude.toFixed(6)}`}
          </ThemedText>
        ) : null}
      </ThemedView>
      <ThemedView style={styles.stepContainer}>
        <ThemedText type="subtitle">Step 3: Get a fresh start</ThemedText>
        <ThemedText>
          {`When you're ready, run `}
          <ThemedText type="defaultSemiBold">npm run reset-project</ThemedText> to get a fresh{' '}
          <ThemedText type="defaultSemiBold">app</ThemedText> directory. This will move the current{' '}
          <ThemedText type="defaultSemiBold">app</ThemedText> to{' '}
          <ThemedText type="defaultSemiBold">app-example</ThemedText>.
        </ThemedText>
      </ThemedView>
    </ParallaxScrollView>
  );
}

const styles = StyleSheet.create({
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  stepContainer: {
    gap: 8,
    marginBottom: 8,
  },
  map: {
    height: 200,
    borderRadius: 12,
    overflow: 'hidden',
  },
  reactLogo: {
    height: 178,
    width: 290,
    bottom: 0,
    left: 0,
    position: 'absolute',
  },
});

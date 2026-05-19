import { Image, View } from 'react-native';

export function LogoTopLeft() {
  return (
    <View style={{ position: 'absolute', top: 16, left: 16, zIndex: 10 }}>
      <Image
        source={require('@/assets/images/logo.png')}
        style={{ width: 40, height: 40 }}
        resizeMode="contain"
      />
    </View>
  );
}

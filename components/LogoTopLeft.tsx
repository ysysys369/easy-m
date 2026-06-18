import { Image, View } from 'react-native';
import { position } from '@/lib/rtl';

export function LogoTopLeft() {
  return (
    <View style={{ position: 'absolute', top: 16, ...position.start(16), zIndex: 10 }}>
      <Image
        source={require('@/assets/images/logo.png')}
        style={{ width: 40, height: 40 }}
        resizeMode="contain"
      />
    </View>
  );
}

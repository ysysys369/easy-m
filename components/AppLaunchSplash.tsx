import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Image, Text, View } from 'react-native';
import { rtl } from '@/lib/rtl';

type AppLaunchSplashProps = {
  visible?: boolean;
  onHidden?: () => void;
};

const LOGO = require('@/assets/images/logo.png');

export function AppLaunchSplash({
  visible = true,
  onHidden,
}: AppLaunchSplashProps) {
  const [mounted, setMounted] = useState(visible);
  const [logoFailed, setLogoFailed] = useState(false);
  const opacity = useRef(new Animated.Value(visible ? 1 : 0)).current;
  const logoAnim = useRef(new Animated.Value(0)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;
  const dotOne = useRef(new Animated.Value(0.25)).current;
  const dotTwo = useRef(new Animated.Value(0.25)).current;
  const dotThree = useRef(new Animated.Value(0.25)).current;

  useEffect(() => {
    const animation = Animated.parallel([
      Animated.timing(logoAnim, {
        toValue: 1,
        duration: 650,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.loop(
        Animated.sequence([
          Animated.timing(glowAnim, {
            toValue: 1,
            duration: 1200,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(glowAnim, {
            toValue: 0,
            duration: 1200,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
        ])
      ),
      Animated.loop(
        Animated.stagger(170, [
          Animated.sequence([
            Animated.timing(dotOne, {
              toValue: 1,
              duration: 420,
              useNativeDriver: true,
            }),
            Animated.timing(dotOne, {
              toValue: 0.25,
              duration: 420,
              useNativeDriver: true,
            }),
          ]),
          Animated.sequence([
            Animated.timing(dotTwo, {
              toValue: 1,
              duration: 420,
              useNativeDriver: true,
            }),
            Animated.timing(dotTwo, {
              toValue: 0.25,
              duration: 420,
              useNativeDriver: true,
            }),
          ]),
          Animated.sequence([
            Animated.timing(dotThree, {
              toValue: 1,
              duration: 420,
              useNativeDriver: true,
            }),
            Animated.timing(dotThree, {
              toValue: 0.25,
              duration: 420,
              useNativeDriver: true,
            }),
          ]),
        ])
      ),
    ]);

    animation.start();
    return () => animation.stop();
  }, [dotOne, dotThree, dotTwo, glowAnim, logoAnim]);

  useEffect(() => {
    if (visible) {
      setMounted(true);
      Animated.timing(opacity, {
        toValue: 1,
        duration: 260,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }).start();
      return;
    }

    Animated.timing(opacity, {
      toValue: 0,
      duration: 420,
      easing: Easing.inOut(Easing.quad),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (!finished) return;
      setMounted(false);
      onHidden?.();
    });
  }, [onHidden, opacity, visible]);

  if (!mounted) return null;

  const logoOpacity = logoAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });
  const logoTranslateY = logoAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [14, 0],
  });
  const glowScale = glowAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.92, 1.08],
  });
  const glowOpacity = glowAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.42, 0.72],
  });

  return (
    <Animated.View
      pointerEvents="auto"
      accessible={true}
      accessibilityRole="progressbar"
      accessibilityLabel="Easy-M נטען"
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 9999,
        elevation: 9999,
        backgroundColor: '#050507',
        alignItems: 'center',
        justifyContent: 'center',
        opacity,
      }}
    >
      <Animated.View
        style={{
          position: 'absolute',
          width: 220,
          height: 220,
          borderRadius: 110,
          backgroundColor: 'rgba(236,72,153,0.20)',
          opacity: glowOpacity,
          transform: [{ scale: glowScale }],
          shadowColor: '#ec4899',
          shadowOffset: { width: 0, height: 0 },
          shadowOpacity: 0.7,
          shadowRadius: 44,
        }}
      />
      <Animated.View
        style={{
          position: 'absolute',
          width: 170,
          height: 170,
          borderRadius: 85,
          backgroundColor: 'rgba(124,58,237,0.34)',
          opacity: glowOpacity,
          transform: [{ scale: glowScale }],
          shadowColor: '#7C3AED',
          shadowOffset: { width: 0, height: 0 },
          shadowOpacity: 0.9,
          shadowRadius: 34,
        }}
      />

      <Animated.View
        style={{
          alignItems: 'center',
          opacity: logoOpacity,
          transform: [{ translateY: logoTranslateY }],
        }}
      >
        <View
          style={{
            width: 108,
            height: 108,
            borderRadius: 32,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'rgba(255,255,255,0.04)',
            borderWidth: 1,
            borderColor: 'rgba(255,255,255,0.10)',
          }}
        >
          {logoFailed ? (
            <Text
              style={{
                color: '#fff',
                fontSize: 20,
                fontWeight: '900',
                letterSpacing: 0,
              }}
            >
              Easy-M
            </Text>
          ) : (
            <Image
              source={LOGO}
              onError={() => setLogoFailed(true)}
              resizeMode="contain"
              style={{ width: 76, height: 76 }}
            />
          )}
        </View>

        <Text
          style={{
            color: '#fff',
            fontSize: 18,
            fontWeight: '800',
            marginTop: 26,
            textAlign: 'center',
            writingDirection: 'rtl',
          }}
        >
          ה-AI שמנהל לך את השיווק
        </Text>

        <View
          style={{
            flexDirection: rtl.flexDirection,
            gap: 7,
            marginTop: 22,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {[
            { id: 'one', color: '#a78bfa', opacity: dotOne },
            { id: 'two', color: '#ec4899', opacity: dotTwo },
            { id: 'three', color: '#a78bfa', opacity: dotThree },
          ].map((dot) => (
            <Animated.View
              key={dot.id}
              style={{
                width: 7,
                height: 7,
                borderRadius: 4,
                backgroundColor: dot.color,
                opacity: dot.opacity,
              }}
            />
          ))}
        </View>
      </Animated.View>
    </Animated.View>
  );
}

import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const TAB_HEIGHT = 64;
const TAB_MARGIN_H = 16;
const TAB_MARGIN_BOTTOM = 10;

export function FloatingTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();

  const visibleRoutes = state.routes.filter((route) => {
    const { options } = descriptors[route.key];
    return typeof options.tabBarButton !== 'function';
  });

  return (
    // Full-screen transparent wrapper — pointerEvents="box-none" lets touches
    // pass through to the scene everywhere except the actual tab buttons.
    <View pointerEvents="box-none" style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }}>
      {/* Outer glow layer */}
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          bottom: insets.bottom + TAB_MARGIN_BOTTOM - 4,
          left: TAB_MARGIN_H - 4,
          right: TAB_MARGIN_H - 4,
          height: TAB_HEIGHT + 8,
          borderRadius: 32,
          backgroundColor: 'transparent',
          shadowColor: '#8B5CF6',
          shadowOffset: { width: 0, height: 0 },
          shadowOpacity: 0.45,
          shadowRadius: 28,
          elevation: 0,
        }}
      />

      {/* Tab bar pill */}
      <View
        style={{
          position: 'absolute',
          bottom: insets.bottom + TAB_MARGIN_BOTTOM,
          left: TAB_MARGIN_H,
          right: TAB_MARGIN_H,
          height: TAB_HEIGHT,
          backgroundColor: 'rgba(15, 15, 25, 0.75)',
          borderRadius: 28,
          borderWidth: 1,
          borderColor: 'rgba(139, 92, 246, 0.25)',
          flexDirection: 'row',
          alignItems: 'center',
          shadowColor: '#000000',
          shadowOffset: { width: 0, height: 8 },
          shadowOpacity: 0.4,
          shadowRadius: 16,
          elevation: 16,
        }}
      >
        {visibleRoutes.map((route) => {
          const { options } = descriptors[route.key];
          const isFocused = state.routes[state.index].key === route.key;
          const color = isFocused ? '#7C3AED' : '#71717a';

          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });
            if (!isFocused && !event.defaultPrevented) {
              navigation.navigate(route.name);
            }
          };

          return (
            <Pressable
              key={route.key}
              onPress={onPress}
              style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 10 }}
            >
              {options.tabBarIcon?.({ focused: isFocused, color, size: 22 })}
              <Text style={{ color, fontSize: 10, fontWeight: '600' }}>
                {options.title ?? route.name}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

/** Bottom padding screens must add so their scroll content clears the floating bar. */
export const FLOATING_TAB_PADDING = 100;

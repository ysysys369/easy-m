import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { rtl } from '@/lib/rtl';

const TAB_HEIGHT = 72;
const TAB_ICON_SIZE = 26;
const TAB_MARGIN_H = 18;
const TAB_BOTTOM_GAP = 18;

export function FloatingTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const bottomOffset = insets.bottom + TAB_BOTTOM_GAP;

  const visibleRoutes = state.routes.filter((route) => {
    const { options } = descriptors[route.key];
    return typeof options.tabBarButton !== 'function';
  });

  return (
    // Full-screen transparent wrapper — pointerEvents="box-none" lets touches
    // pass through to the scene everywhere except the actual tab buttons.
    <View
      pointerEvents="box-none"
      style={[
        StyleSheet.absoluteFillObject,
        {
          justifyContent: 'flex-end',
          paddingBottom: bottomOffset,
          paddingHorizontal: TAB_MARGIN_H,
        },
      ]}
    >
      {/* Fixed floating dock. The solid surface prevents page content from
          showing through while the bar sits above the iPhone home indicator. */}
      <View
        style={{
          height: TAB_HEIGHT,
          paddingTop: 3,
          paddingHorizontal: 8,
          backgroundColor: '#090910',
          borderRadius: 30,
          borderWidth: 1,
          borderColor: 'rgba(139, 92, 246, 0.24)',
          flexDirection: rtl.flexDirection,
          alignItems: 'center',
          shadowColor: '#000000',
          shadowOffset: { width: 0, height: 8 },
          shadowOpacity: 0.42,
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
              accessible={true}
              accessibilityRole="tab"
              accessibilityLabel={String(options.title ?? route.name)}
              style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 4, minHeight: TAB_HEIGHT }}
            >
              {options.tabBarIcon?.({ focused: isFocused, color, size: TAB_ICON_SIZE })}
              <Text style={{ color, fontSize: 12, fontWeight: '800', lineHeight: 15 }}>
                {options.title ?? route.name}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

/** Bottom padding screens must add so their scroll content clears the fixed bar. */
export const FLOATING_TAB_PADDING = 150;

import { type ComponentProps } from 'react';
import { Pressable } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

const ReanimatedPressable = Animated.createAnimatedComponent(Pressable);

type Props = Omit<ComponentProps<typeof Pressable>, 'style'> & {
  style?: ComponentProps<typeof Animated.View>['style'];
  scaleTo?: number;
};

/** A Pressable that scales down slightly while pressed, via reanimated. */
export function AnimatedPressable({ scaleTo = 0.96, onPressIn, onPressOut, style, ...rest }: Props) {
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <ReanimatedPressable
      onPressIn={event => {
        scale.value = withTiming(scaleTo, { duration: 80 });
        onPressIn?.(event);
      }}
      onPressOut={event => {
        scale.value = withTiming(1, { duration: 120 });
        onPressOut?.(event);
      }}
      style={[style, animatedStyle]}
      {...rest}
    />
  );
}

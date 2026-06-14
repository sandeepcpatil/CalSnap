import type { ColorValue } from 'react-native';
import type { InternalTheme } from '../../types';
type IconButtonMode = 'outlined' | 'contained' | 'contained-tonal';
export declare const getIconButtonColor: ({ theme, disabled, mode, selected, customIconColor, customContainerColor, customRippleColor, }: {
    theme: InternalTheme;
    disabled?: boolean;
    selected?: boolean;
    mode?: IconButtonMode;
    customIconColor?: string;
    customContainerColor?: string;
    customRippleColor?: ColorValue;
}) => {
    iconColor: string;
    backgroundColor: string | undefined;
    rippleColor: ColorValue;
    borderColor: string | undefined;
};
export {};
//# sourceMappingURL=utils.d.ts.map
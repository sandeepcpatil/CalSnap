import type { InternalTheme } from '../../types';
export declare const getAndroidSelectionControlColor: ({ theme, disabled, checked, customColor, customUncheckedColor, }: {
    theme: InternalTheme;
    checked: boolean;
    disabled?: boolean;
    customColor?: string;
    customUncheckedColor?: string;
}) => {
    rippleColor: string;
    selectionControlColor: string;
};
export declare const getSelectionControlIOSColor: ({ theme, disabled, customColor, }: {
    theme: InternalTheme;
    disabled?: boolean;
    customColor?: string;
}) => {
    checkedColor: string;
    rippleColor: string;
};
//# sourceMappingURL=utils.d.ts.map
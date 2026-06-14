import type { GestureResponderEvent } from 'react-native';
export declare const handlePress: ({ onPress, value, onValueChange, event, }: {
    onPress?: (e: GestureResponderEvent) => void;
    value: string;
    onValueChange?: (value: string) => void;
    event: GestureResponderEvent;
}) => void;
export declare const isChecked: ({ value, status, contextValue, }: {
    value: string;
    status?: "checked" | "unchecked";
    contextValue?: string;
}) => "checked" | "unchecked" | undefined;
//# sourceMappingURL=utils.d.ts.map
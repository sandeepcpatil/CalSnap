import { ViewStyle } from "react-native";
import AbstractChart, { AbstractChartConfig, AbstractChartProps } from "./AbstractChart";
import { ChartData } from "./HelperTypes";
export interface BarChartProps extends AbstractChartProps {
    data: ChartData;
    width: number;
    height: number;
    fromZero?: boolean;
    withInnerLines?: boolean;
    yAxisLabel: string;
    yAxisSuffix: string;
    chartConfig: AbstractChartConfig;
    style?: Partial<ViewStyle>;
    horizontalLabelRotation?: number;
    verticalLabelRotation?: number;
    /**
     * Show vertical labels - default: True.
     */
    withVerticalLabels?: boolean;
    /**
     * Show horizontal labels - default: True.
     */
    withHorizontalLabels?: boolean;
    /**
     * The number of horizontal lines
     */
    segments?: number;
    showBarTops?: boolean;
    showValuesOnTopOfBars?: boolean;
    withCustomBarColorFromData?: boolean;
    flatColor?: boolean;
}
type BarChartState = {};
declare class BarChart extends AbstractChart<BarChartProps, BarChartState> {
    getBarPercentage: () => number;
    renderBars: ({ data, width, height, paddingTop, paddingRight, barRadius, withCustomBarColorFromData }: Pick<Omit<AbstractChartConfig, "data">, "width" | "height" | "paddingRight" | "paddingTop" | "barRadius"> & {
        data: number[];
        withCustomBarColorFromData: boolean;
    }) => JSX.Element[];
    renderBarTops: ({ data, width, height, paddingTop, paddingRight }: Pick<Omit<AbstractChartConfig, "data">, "width" | "height" | "paddingRight" | "paddingTop"> & {
        data: number[];
    }) => JSX.Element[];
    renderColors: ({ data, flatColor }: Pick<AbstractChartConfig, "data"> & {
        flatColor: boolean;
    }) => JSX.Element[];
    renderValuesOnTopOfBars: ({ data, width, height, paddingTop, paddingRight }: Pick<Omit<AbstractChartConfig, "data">, "width" | "height" | "paddingRight" | "paddingTop"> & {
        data: number[];
    }) => JSX.Element[];
    render(): JSX.Element;
}
export default BarChart;
//# sourceMappingURL=BarChart.d.ts.map
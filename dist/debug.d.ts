type MetricKey = "events" | "filtered" | "rendered";
export declare class DebugMetrics {
    private _data;
    track(key: MetricKey): void;
    counts(key: MetricKey): {
        min1: number;
        min5: number;
        min15: number;
        min30: number;
        hour1: number;
        hour3: number;
    };
    tableHtml(): string;
}
export {};

export interface HasSubscribeEvents {
    subscribeEvents(callback: (event: {
        data: {
            entity_id: string;
        };
    }) => void, eventType: string): Promise<() => void>;
}
export declare class SubscriptionManager {
    private _gen;
    private _unsub;
    get active(): boolean;
    subscribe(connection: Partial<HasSubscribeEvents> | null | undefined, trackedIds: Set<string> | null | undefined, onMatch: () => void): void;
    clear(): void;
}

function timeAgo(ms) {
    if (ms < 60_000)
        return `${Math.floor(ms / 1_000)}s`;
    if (ms < 3_600_000)
        return `${Math.floor(ms / 60_000)}m`;
    return `${Math.floor(ms / 3_600_000)}h`;
}

class DebugMetrics {
    _data = { events: [], filtered: [], rendered: [] };
    track(key) {
        const now = Date.now();
        this._data[key].push(now);
        this._data[key] = this._data[key].filter((t) => t > now - 10_800_000);
    }
    counts(key) {
        const now = Date.now();
        const arr = this._data[key];
        const r = { min1: 0, min5: 0, min15: 0, min30: 0, hour1: 0, hour3: arr.length };
        for (const t of arr) {
            const age = now - t;
            if (age <= 60_000)
                r.min1++;
            if (age <= 300_000)
                r.min5++;
            if (age <= 900_000)
                r.min15++;
            if (age <= 1_800_000)
                r.min30++;
            if (age <= 3_600_000)
                r.hour1++;
        }
        return r;
    }
    tableHtml() {
        const cell = (n) => `<td style="padding-right:8px;text-align:right">${n}</td>`;
        const hcell = (label) => `<td style="padding-right:8px;text-align:right;color:orange">${label}</td>`;
        const row = (label, key) => {
            const c = this.counts(key);
            return `<tr><td style="padding-right:10px;color:orange">${label}</td>${cell(c.min1)}${cell(c.min5)}${cell(c.min15)}${cell(c.min30)}${cell(c.hour1)}${cell(c.hour3)}</tr>`;
        };
        const rendered = this._data.rendered;
        const pad = (n, w = 2) => String(n).padStart(w, "0");
        const last = rendered.at(-1);
        let ts = "--";
        if (last !== undefined) {
            const d = new Date(last);
            const time = `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}.${pad(d.getMilliseconds(), 3)}`;
            ts = `${time} (${timeAgo(Date.now() - last)} ago)`;
        }
        const footer = `<tr style="font-size:10px"><td style="padding-right:10px;color:indianred">${ts}</td>${hcell("1m")}${hcell("5m")}${hcell("15m")}${hcell("30m")}${hcell("1h")}${hcell("3h")}</tr>`;
        return `<table style="border-collapse:collapse;width:100%">${row("events", "events")}${row("filtered", "filtered")}${row("rendered", "rendered")}${footer}</table>`;
    }
}

class SubscriptionManager {
    _gen = 0;
    _unsub = null;
    get active() {
        return this._unsub !== null;
    }
    subscribe(connection, trackedIds, onMatch) {
        if (!connection?.subscribeEvents)
            return;
        const gen = this._gen;
        connection
            .subscribeEvents((event) => {
            if (this._gen === gen && trackedIds?.has(event.data.entity_id)) {
                onMatch();
            }
        }, "state_changed")
            .then((unsub) => {
            if (this._gen === gen) {
                this._unsub = unsub;
            }
            else {
                unsub();
            }
        })
            .catch(() => { });
    }
    clear() {
        this._gen++;
        this._unsub?.();
        this._unsub = null;
    }
}

export { DebugMetrics, SubscriptionManager, timeAgo };

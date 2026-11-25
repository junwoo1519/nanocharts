/**
 * @fileoverview 초경량 타입 안전 이벤트 버스 (EventEmitter)
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyEventMap = Record<string, any>;
type Handler<T = unknown> = (data: T) => void;

export class EventEmitter<TEvents extends AnyEventMap = AnyEventMap> {
  private events: Map<keyof TEvents, Handler<unknown>[]> = new Map();

  on<K extends keyof TEvents>(event: K, handler: Handler<TEvents[K]>): () => void {
    if (!this.events.has(event)) {
      this.events.set(event, []);
    }
    this.events.get(event)!.push(handler as Handler<unknown>);

    return () => this.off(event, handler);
  }

  off<K extends keyof TEvents>(event: K, handler: Handler<TEvents[K]>): void {
    const handlers = this.events.get(event);
    if (!handlers) return;
    this.events.set(
      event,
      handlers.filter((h) => h !== (handler as Handler<unknown>))
    );
  }

  emit<K extends keyof TEvents>(event: K, data: TEvents[K]): void {
    const handlers = this.events.get(event);
    if (!handlers) return;
    for (const handler of handlers) {
      handler(data);
    }
  }

  clear(): void {
    this.events.clear();
  }
}

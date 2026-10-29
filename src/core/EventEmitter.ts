type Handler<T = unknown> = (data: T) => void;

export class EventEmitter {
  private events: Map<string, Handler[]> = new Map();

  on<T = unknown>(event: string, handler: Handler<T>): () => void {
    if (!this.events.has(event)) {
      this.events.set(event, []);
    }
    this.events.get(event)!.push(handler as Handler);

    return () => this.off(event, handler);
  }

  off<T = unknown>(event: string, handler: Handler<T>): void {
    const handlers = this.events.get(event);
    if (!handlers) return;
    this.events.set(
      event,
      handlers.filter((h) => h !== handler)
    );
  }

  emit<T = unknown>(event: string, data?: T): void {
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

type Resolver<T> = (value: IteratorResult<T>) => void;

export class EventChannel<T> implements AsyncIterable<T> {
  private queue: T[] = [];
  private resolvers: Resolver<T>[] = [];
  private done = false;
  private errorValue: unknown = null;

  push(event: T) {
    if (this.done) return;
    if (this.resolvers.length > 0) {
      const resolve = this.resolvers.shift()!;
      resolve({ value: event, done: false });
      return;
    }
    this.queue.push(event);
  }

  close() {
    if (this.done) return;
    this.done = true;
    while (this.resolvers.length > 0) {
      const resolve = this.resolvers.shift()!;
      resolve({ value: undefined as never, done: true });
    }
  }

  fail(error: unknown) {
    this.errorValue = error;
    this.close();
  }

  [Symbol.asyncIterator](): AsyncIterator<T> {
    return {
      next: () => {
        if (this.errorValue) {
          return Promise.reject(this.errorValue);
        }
        if (this.queue.length > 0) {
          return Promise.resolve({ value: this.queue.shift()!, done: false });
        }
        if (this.done) {
          return Promise.resolve({ value: undefined as never, done: true });
        }
        return new Promise((resolve) => this.resolvers.push(resolve));
      },
    };
  }
}

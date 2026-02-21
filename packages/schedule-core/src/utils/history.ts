/**
 * Generic undo/redo history stack.
 */

export class UndoRedoHistory<T> {
  private _stack: T[] = [];
  private _index = -1;
  private _maxSize: number;

  constructor(maxSize = 50) {
    this._maxSize = maxSize;
  }

  push(state: T): void {
    // Discard any future states after current index
    this._stack = this._stack.slice(0, this._index + 1);
    this._stack.push(state);

    // Trim if exceeding max size
    if (this._stack.length > this._maxSize) {
      this._stack.shift();
    }

    this._index = this._stack.length - 1;
  }

  undo(): T | undefined {
    if (!this.canUndo) return undefined;
    this._index--;
    return this._stack[this._index];
  }

  redo(): T | undefined {
    if (!this.canRedo) return undefined;
    this._index++;
    return this._stack[this._index];
  }

  get canUndo(): boolean {
    return this._index > 0;
  }

  get canRedo(): boolean {
    return this._index < this._stack.length - 1;
  }

  get current(): T | undefined {
    if (this._index < 0 || this._index >= this._stack.length) return undefined;
    return this._stack[this._index];
  }

  clear(): void {
    this._stack = [];
    this._index = -1;
  }
}

import { UndoRedoHistory } from "./history";

describe("UndoRedoHistory", () => {
  it("should start empty", () => {
    const history = new UndoRedoHistory<string>();
    expect(history.current).toBeUndefined();
    expect(history.canUndo).toBe(false);
    expect(history.canRedo).toBe(false);
  });

  it("should track pushed states", () => {
    const history = new UndoRedoHistory<string>();
    history.push("a");
    expect(history.current).toBe("a");
    expect(history.canUndo).toBe(false);
    expect(history.canRedo).toBe(false);

    history.push("b");
    expect(history.current).toBe("b");
    expect(history.canUndo).toBe(true);
    expect(history.canRedo).toBe(false);
  });

  it("should undo to previous state", () => {
    const history = new UndoRedoHistory<string>();
    history.push("a");
    history.push("b");
    history.push("c");

    expect(history.undo()).toBe("b");
    expect(history.current).toBe("b");
    expect(history.canUndo).toBe(true);
    expect(history.canRedo).toBe(true);

    expect(history.undo()).toBe("a");
    expect(history.current).toBe("a");
    expect(history.canUndo).toBe(false);
    expect(history.canRedo).toBe(true);
  });

  it("should redo to next state", () => {
    const history = new UndoRedoHistory<string>();
    history.push("a");
    history.push("b");
    history.push("c");

    history.undo();
    history.undo();

    expect(history.redo()).toBe("b");
    expect(history.current).toBe("b");
    expect(history.redo()).toBe("c");
    expect(history.current).toBe("c");
    expect(history.canRedo).toBe(false);
  });

  it("should return undefined when undo is not possible", () => {
    const history = new UndoRedoHistory<string>();
    expect(history.undo()).toBeUndefined();

    history.push("a");
    expect(history.undo()).toBeUndefined();
  });

  it("should return undefined when redo is not possible", () => {
    const history = new UndoRedoHistory<string>();
    expect(history.redo()).toBeUndefined();

    history.push("a");
    expect(history.redo()).toBeUndefined();
  });

  it("should discard future states when pushing after undo", () => {
    const history = new UndoRedoHistory<string>();
    history.push("a");
    history.push("b");
    history.push("c");

    history.undo();
    history.push("d");

    expect(history.current).toBe("d");
    expect(history.canRedo).toBe(false);
    expect(history.canUndo).toBe(true);
    expect(history.undo()).toBe("b");
  });

  it("should respect max size", () => {
    const history = new UndoRedoHistory<number>(3);
    history.push(1);
    history.push(2);
    history.push(3);
    history.push(4);

    // Oldest (1) should have been trimmed
    expect(history.current).toBe(4);
    expect(history.undo()).toBe(3);
    expect(history.undo()).toBe(2);
    expect(history.canUndo).toBe(false);
  });

  it("should clear all states", () => {
    const history = new UndoRedoHistory<string>();
    history.push("a");
    history.push("b");

    history.clear();

    expect(history.current).toBeUndefined();
    expect(history.canUndo).toBe(false);
    expect(history.canRedo).toBe(false);
  });

  it("should work with object states", () => {
    const history = new UndoRedoHistory<{ value: number }>();
    history.push({ value: 1 });
    history.push({ value: 2 });

    expect(history.current).toEqual({ value: 2 });
    expect(history.undo()).toEqual({ value: 1 });
  });
});

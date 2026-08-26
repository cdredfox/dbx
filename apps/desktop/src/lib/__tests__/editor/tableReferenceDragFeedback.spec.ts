// @vitest-environment happy-dom

import { afterEach, describe, expect, it } from "vitest";
import { beginTableReferenceDragFeedback, isOverSqlEditorTarget } from "@/lib/editor/tableReferenceDragFeedback";

afterEach(() => {
  document.body.innerHTML = "";
  document.body.className = "";
  document.body.style.cursor = "";
});

describe("isOverSqlEditorTarget", () => {
  it("detects pointers inside the query editor root only", () => {
    const editor = document.createElement("div");
    editor.setAttribute("data-query-editor-root", "");
    const inner = document.createElement("textarea");
    editor.appendChild(inner);
    document.body.appendChild(editor);

    document.elementFromPoint = () => inner;
    expect(isOverSqlEditorTarget(10, 10)).toBe(true);
    document.elementFromPoint = () => document.body;
    expect(isOverSqlEditorTarget(10, 10)).toBe(false);
  });
});

describe("beginTableReferenceDragFeedback", () => {
  it("shows a following chip and restores body state on end", () => {
    const feedback = beginTableReferenceDragFeedback("id, name 等 3 列");
    const chip = document.querySelector<HTMLElement>("[data-table-reference-drag-chip]");
    expect(chip?.textContent).toBe("id, name 等 3 列");
    expect(document.body.style.cursor).toBe("copy");
    expect(chip?.style.visibility).toBe("hidden");

    feedback.update(40, 60);
    expect(chip?.style.visibility).toBe("visible");
    expect(Number.parseFloat(chip!.style.left)).toBeGreaterThanOrEqual(8);
    expect(Number.parseFloat(chip!.style.top)).toBeGreaterThanOrEqual(8);

    feedback.end();
    expect(document.querySelector("[data-table-reference-drag-chip]")).toBeNull();
    expect(document.body.style.cursor).toBe("");
  });

  it("clamps the chip inside the viewport", () => {
    const feedback = beginTableReferenceDragFeedback("col");
    const chip = document.querySelector<HTMLElement>("[data-table-reference-drag-chip]")!;
    feedback.update(window.innerWidth - 2, window.innerHeight - 2);
    const left = Number.parseFloat(chip.style.left);
    const top = Number.parseFloat(chip.style.top);
    expect(left + chip.getBoundingClientRect().width).toBeLessThanOrEqual(window.innerWidth);
    expect(top + chip.getBoundingClientRect().height).toBeLessThanOrEqual(window.innerHeight);
    feedback.end();
  });
});

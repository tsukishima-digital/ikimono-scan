import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import App from "./App";

describe("App", () => {
  it("states the classifier scope before a user selects an image", () => {
    render(<App />);

    expect(screen.getByText("甲虫版")).toBeInTheDocument();
    expect(screen.getByText("日本の甲虫")).toBeInTheDocument();
    expect(screen.getByText("クビアカに重点")).toBeInTheDocument();
    expect(screen.getByText(/写真は外部へ送信しません/)).toBeInTheDocument();
  });

  it("rejects a non-image file", () => {
    render(<App />);
    const input = screen.getByLabelText("カメラを起動・画像を選択");

    fireEvent.change(input, {
      target: { files: [new File(["text"], "note.txt", { type: "text/plain" })] },
    });

    expect(screen.getByRole("alert")).toHaveTextContent(
      "画像ファイルを選んでください",
    );
  });
});

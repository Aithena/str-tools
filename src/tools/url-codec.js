const SAMPLE = "https://example.com/搜索?q=文本工具&lang=zh-CN&from=str tools";

function encodeComponent(text) {
  return encodeURIComponent(text);
}

function encodeFull(text) {
  return encodeURI(text);
}

function decodeOnce(text) {
  try {
    return decodeURIComponent(text);
  } catch {
    try {
      return decodeURI(text);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`解码失败：${message}`);
    }
  }
}

function decodeFully(text) {
  let current = text;
  for (let i = 0; i < 8; i += 1) {
    const next = decodeOnce(current);
    if (next === current) return { text: next, rounds: i };
    current = next;
  }
  return { text: current, rounds: 8 };
}

export function mountUrlCodec(root) {
  root.innerHTML = `
    <section class="panel">
      <div class="panel-head">
        <div class="panel-title">输入</div>
        <div class="hint">Ctrl + Enter 编码</div>
      </div>
      <div class="input-area">
        <textarea id="url-input" spellcheck="false" placeholder="在此粘贴或输入 URL / 文本"></textarea>
      </div>
      <div class="ops">
        <div class="opts">
          <div class="opt">
            <span>编码范围</span>
            <div class="seg" id="mode-seg">
              <button type="button" data-mode="component" class="active">组件</button>
              <button type="button" data-mode="uri">整段 URL</button>
            </div>
          </div>
        </div>
        <div class="actions">
          <button type="button" class="btn btn-primary" id="btn-encode">编码</button>
          <button type="button" class="btn" id="btn-decode">解码</button>
          <button type="button" class="btn" id="btn-decode-all">完全解码</button>
          <button type="button" class="btn btn-ghost" id="btn-sample">示例</button>
          <button type="button" class="btn btn-ghost" id="btn-clear">清空</button>
        </div>
      </div>
    </section>
    <section class="panel">
      <div class="panel-head">
        <div class="panel-title">结果</div>
        <div class="panel-actions">
          <button type="button" class="btn" id="btn-copy">复制</button>
          <button type="button" class="btn" id="btn-swap">结果回填</button>
        </div>
      </div>
      <pre class="output placeholder wrap" id="url-output">编码或解码结果会显示在这里</pre>
      <div class="status" id="url-status">等待输入</div>
    </section>
  `;

  const input = root.querySelector("#url-input");
  const output = root.querySelector("#url-output");
  const status = root.querySelector("#url-status");
  const modeSeg = root.querySelector("#mode-seg");

  let mode = "component";
  let lastResult = "";

  function setStatus(type, text) {
    status.className = `status${type ? ` ${type}` : ""}`;
    status.textContent = text;
  }

  function setOutput(text, className) {
    output.className = className ? `output wrap ${className}` : "output wrap";
    output.textContent = text;
  }

  function requireInput() {
    const text = input.value;
    if (!text) throw new Error("请输入内容");
    return text;
  }

  function encode() {
    try {
      const text = requireInput();
      lastResult = mode === "uri" ? encodeFull(text) : encodeComponent(text);
      setOutput(lastResult);
      setStatus(
        "ok",
        `编码成功 · ${mode === "uri" ? "整段 URL" : "组件"} · ${lastResult.length} 字符`,
      );
    } catch (error) {
      lastResult = "";
      setOutput(error instanceof Error ? error.message : String(error), "error-text");
      setStatus("err", "编码失败");
    }
  }

  function decode() {
    try {
      const text = requireInput();
      lastResult = decodeOnce(text);
      setOutput(lastResult);
      setStatus("ok", `解码成功 · ${lastResult.length} 字符`);
    } catch (error) {
      lastResult = "";
      setOutput(error instanceof Error ? error.message : String(error), "error-text");
      setStatus("err", "解码失败");
    }
  }

  function decodeAll() {
    try {
      const text = requireInput();
      const result = decodeFully(text);
      lastResult = result.text;
      setOutput(lastResult);
      setStatus(
        "ok",
        result.rounds
          ? `完全解码成功 · ${result.rounds} 轮 · ${lastResult.length} 字符`
          : `无需解码 · ${lastResult.length} 字符`,
      );
    } catch (error) {
      lastResult = "";
      setOutput(error instanceof Error ? error.message : String(error), "error-text");
      setStatus("err", "解码失败");
    }
  }

  modeSeg.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-mode]");
    if (!button) return;
    mode = button.dataset.mode;
    modeSeg.querySelectorAll("button").forEach((item) => item.classList.toggle("active", item === button));
  });

  root.querySelector("#btn-encode").addEventListener("click", encode);
  root.querySelector("#btn-decode").addEventListener("click", decode);
  root.querySelector("#btn-decode-all").addEventListener("click", decodeAll);
  root.querySelector("#btn-sample").addEventListener("click", () => {
    input.value = SAMPLE;
    encode();
  });
  root.querySelector("#btn-clear").addEventListener("click", () => {
    input.value = "";
    lastResult = "";
    setOutput("编码或解码结果会显示在这里", "placeholder");
    setStatus("", "等待输入");
    input.focus();
  });
  root.querySelector("#btn-copy").addEventListener("click", async () => {
    if (!lastResult) {
      setStatus("err", "没有可复制的结果");
      return;
    }
    try {
      await navigator.clipboard.writeText(lastResult);
      setStatus("ok", "已复制到剪贴板");
    } catch {
      setStatus("err", "复制失败，请手动选择复制");
    }
  });
  root.querySelector("#btn-swap").addEventListener("click", () => {
    if (!lastResult) {
      setStatus("err", "没有可回填的结果");
      return;
    }
    input.value = lastResult;
    setStatus("ok", "已回填到输入框");
    input.focus();
  });
  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      encode();
    }
  });
}

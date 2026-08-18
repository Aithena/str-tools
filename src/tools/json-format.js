const SAMPLE = `{
  "tool": "json-format",
  "meta": {
    "name": "STR Tools",
    "enabled": true,
    "version": 1
  },
  "items": [
    {"id": 3, "label": "validate"},
    {"id": 1, "label": "pretty"},
    {"id": 2, "label": "minify"}
  ]
}`;

function escapeHtml(text) {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function highlightJson(json) {
  const escaped = escapeHtml(json);
  return escaped.replace(
    /("(?:\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(?:\s*:)?|\btrue\b|\bfalse\b|\bnull\b|-?\d+(?:\.\d*)?(?:[eE][+-]?\d+)?)/g,
    (match) => {
      let cls = "number";
      if (match.startsWith('"')) {
        cls = /:$/.test(match) ? "key" : "string";
      } else if (match === "true" || match === "false") {
        cls = "boolean";
      } else if (match === "null") {
        cls = "null";
      }
      return `<span class="${cls}">${match}</span>`;
    },
  );
}

function sortValue(value) {
  if (Array.isArray(value)) return value.map(sortValue);
  if (value && typeof value === "object") {
    return Object.keys(value)
      .sort()
      .reduce((acc, key) => {
        acc[key] = sortValue(value[key]);
        return acc;
      }, {});
  }
  return value;
}

function locationFromPosition(text, position) {
  const ahead = text.slice(0, position);
  const lines = ahead.split("\n");
  return { line: lines.length, column: lines[lines.length - 1].length + 1 };
}

function parseInput(raw) {
  const text = raw.replace(/^\uFEFF/, "").trim();
  if (!text) {
    throw new Error("请输入 JSON 内容");
  }
  try {
    return { text, value: JSON.parse(text) };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const posMatch = message.match(/position\s+(\d+)/i);
    if (posMatch) {
      const position = Number(posMatch[1]);
      const { line, column } = locationFromPosition(text, position);
      throw new Error(`${message}（第 ${line} 行，第 ${column} 列）`);
    }
    throw new Error(message);
  }
}

export function mountJsonFormat(root) {
  root.innerHTML = `
    <section class="panel">
      <div class="panel-head">
        <div class="panel-title">输入</div>
        <div class="hint">Ctrl + Enter 格式化</div>
      </div>
      <div class="input-area">
        <textarea id="json-input" spellcheck="false" placeholder="在此粘贴或输入 JSON"></textarea>
      </div>
      <div class="ops">
        <div class="opts">
          <div class="opt">
            <span>缩进</span>
            <div class="seg" id="indent-seg">
              <button type="button" data-indent="2" class="active">2 空格</button>
              <button type="button" data-indent="4">4 空格</button>
              <button type="button" data-indent="tab">Tab</button>
            </div>
          </div>
          <label class="check">
            <input id="sort-keys" type="checkbox" />
            按键名排序
          </label>
        </div>
        <div class="actions">
          <button type="button" class="btn btn-primary" id="btn-format">格式化</button>
          <button type="button" class="btn" id="btn-minify">压缩</button>
          <button type="button" class="btn" id="btn-validate">校验</button>
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
        </div>
      </div>
      <pre class="output placeholder" id="json-output">格式化后的 JSON 会显示在这里</pre>
      <div class="status" id="json-status">等待输入</div>
    </section>
  `;

  const input = root.querySelector("#json-input");
  const output = root.querySelector("#json-output");
  const status = root.querySelector("#json-status");
  const indentSeg = root.querySelector("#indent-seg");
  const sortKeys = root.querySelector("#sort-keys");

  let indent = 2;
  let lastResult = "";

  function setStatus(type, text) {
    status.className = `status${type ? ` ${type}` : ""}`;
    status.textContent = text;
  }

  function setOutput(html, className) {
    output.className = className ? `output ${className}` : "output";
    output.innerHTML = html;
  }

  function currentValue() {
    const parsed = parseInput(input.value);
    return sortKeys.checked ? sortValue(parsed.value) : parsed.value;
  }

  function format() {
    try {
      const value = currentValue();
      lastResult = JSON.stringify(value, null, indent);
      setOutput(highlightJson(lastResult));
      setStatus("ok", `格式化成功 · ${lastResult.length} 字符`);
    } catch (error) {
      lastResult = "";
      setOutput(escapeHtml(error.message), "error-text");
      setStatus("err", "JSON 无效");
    }
  }

  function minify() {
    try {
      const value = currentValue();
      lastResult = JSON.stringify(value);
      setOutput(highlightJson(lastResult));
      setStatus("ok", `压缩成功 · ${lastResult.length} 字符`);
    } catch (error) {
      lastResult = "";
      setOutput(escapeHtml(error.message), "error-text");
      setStatus("err", "JSON 无效");
    }
  }

  function validate() {
    try {
      parseInput(input.value);
      lastResult = "";
      setOutput("JSON 有效", "placeholder");
      setStatus("ok", "校验通过");
    } catch (error) {
      lastResult = "";
      setOutput(escapeHtml(error.message), "error-text");
      setStatus("err", "校验失败");
    }
  }

  indentSeg.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-indent]");
    if (!button) return;
    indent = button.dataset.indent === "tab" ? "\t" : Number(button.dataset.indent);
    indentSeg.querySelectorAll("button").forEach((item) => item.classList.toggle("active", item === button));
  });

  root.querySelector("#btn-format").addEventListener("click", format);
  root.querySelector("#btn-minify").addEventListener("click", minify);
  root.querySelector("#btn-validate").addEventListener("click", validate);
  root.querySelector("#btn-sample").addEventListener("click", () => {
    input.value = SAMPLE;
    format();
  });
  root.querySelector("#btn-clear").addEventListener("click", () => {
    input.value = "";
    lastResult = "";
    setOutput("格式化后的 JSON 会显示在这里", "placeholder");
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
  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      format();
    }
  });
}

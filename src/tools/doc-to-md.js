import init, {
  formatFromBytes,
  formatFromPath,
  toMarkdownBytes,
} from "@firecrawl/anydoc-wasm";
import { marked } from "marked";

const ACCEPT = [
  ".doc",
  ".docx",
  ".docm",
  ".ppt",
  ".pps",
  ".pot",
  ".pptx",
  ".pptm",
  ".ppsx",
  ".ppsm",
  ".xls",
  ".xlsx",
  ".xlsm",
  ".xlsb",
  ".odt",
  ".ods",
  ".odp",
  ".rtf",
  ".epub",
  ".csv",
  ".pdf",
].join(",");

const FORMAT_TAGS = [
  "Word",
  "PowerPoint",
  "Excel",
  "OpenDocument",
  "RTF",
  "EPUB",
  "CSV",
  "PDF",
];

const ERROR_HINTS = {
  unsupported: "不支持该格式，或无法提取内容（纯扫描 PDF 需要 OCR）",
  malformed: "文件结构损坏，无法提取有效内容",
  encrypted: "文件已加密或受密码保护",
  resourceLimit: "超出安全限制（解压、嵌套或节点数）",
  missingPart: "缺少转换所需的文件部件",
};

const SAMPLE_RTF = String.raw`{\rtf1\ansi\deff0{\fonttbl{\f0 Times New Roman;}}
\pard\sa200 anydoc reads the {\b formatting}, the {\i emphasis}, and the {\b\i structure} of a document, then writes the Markdown that says the same thing.\par
\pard\sa200 Drop a Word, PowerPoint, Excel, PDF, or OpenDocument file to convert it locally in the browser.\par
}`;

const SAMPLE_CSV = `格式,类型,说明
docx,Word,WordprocessingML
pptx,演示文稿,PowerPoint
xlsx,表格,Excel
pdf,文档,文本型 PDF
csv,表格,需按扩展名识别
`;

let enginePromise;

function loadEngine() {
  if (!enginePromise) {
    enginePromise = init();
  }
  return enginePromise;
}

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function stemName(name) {
  return name.replace(/\.[^.]+$/, "") || "document";
}

function convertBytes(name, bytes) {
  const format = formatFromBytes(bytes) ?? formatFromPath(name);
  const started = performance.now();
  const markdown = toMarkdownBytes(bytes, format);
  const ms = Math.max(1, Math.round(performance.now() - started));
  return { format, markdown, ms };
}

async function nextPaint() {
  await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
}

export function mountDocToMd(root) {
  document.getElementById("md-preview")?.remove();
  document.body.classList.remove("md-preview-open");

  root.innerHTML = `
    <section class="panel">
      <div class="panel-head">
        <div class="panel-title">文档</div>
        <div class="hint" id="engine-hint">正在加载转换引擎…</div>
      </div>
      <div class="drop-wrap">
        <input id="doc-file" type="file" accept="${ACCEPT}" hidden />
        <button type="button" class="drop-zone" id="drop-zone" disabled>
          <span class="drop-title" id="drop-title">正在准备转换引擎</span>
          <span class="drop-sub">Word / PPT / Excel / PDF / OpenDocument / RTF / EPUB / CSV</span>
          <span class="drop-file" id="drop-file" hidden></span>
        </button>
      </div>
      <div class="format-board">
        ${FORMAT_TAGS.map((tag) => `<span class="tag">${tag}</span>`).join("")}
      </div>
      <div class="ops">
        <div class="hint">基于 anydoc，文件只在本地转换</div>
        <div class="actions">
          <button type="button" class="btn btn-primary" id="btn-convert" disabled>转换</button>
          <button type="button" class="btn btn-ghost" id="btn-sample-rtf" disabled>示例 RTF</button>
          <button type="button" class="btn btn-ghost" id="btn-sample-csv" disabled>示例 CSV</button>
          <button type="button" class="btn btn-ghost" id="btn-clear">清空</button>
        </div>
      </div>
    </section>
    <section class="panel">
      <div class="panel-head">
        <div class="panel-title">Markdown</div>
        <div class="panel-actions">
          <button type="button" class="btn" id="btn-preview">预览</button>
          <button type="button" class="btn" id="btn-copy">复制</button>
          <button type="button" class="btn" id="btn-download">下载 .md</button>
        </div>
      </div>
      <pre class="output placeholder wrap" id="md-output">转换后的 Markdown 会显示在这里</pre>
      <div class="status" id="md-status">等待文件</div>
    </section>
    <div class="md-preview" id="md-preview" hidden>
      <div class="md-preview-backdrop" data-close-preview></div>
      <div class="md-preview-dialog" role="dialog" aria-modal="true" aria-labelledby="md-preview-title">
        <div class="md-preview-head">
          <div class="panel-title" id="md-preview-title">Markdown 预览</div>
          <button type="button" class="btn" id="btn-preview-close" data-close-preview>关闭</button>
        </div>
        <div class="md-preview-body" id="md-preview-body"></div>
      </div>
    </div>
  `;

  const fileInput = root.querySelector("#doc-file");
  const dropZone = root.querySelector("#drop-zone");
  const dropTitle = root.querySelector("#drop-title");
  const dropFile = root.querySelector("#drop-file");
  const engineHint = root.querySelector("#engine-hint");
  const output = root.querySelector("#md-output");
  const status = root.querySelector("#md-status");
  const convertBtn = root.querySelector("#btn-convert");
  const sampleRtfBtn = root.querySelector("#btn-sample-rtf");
  const sampleCsvBtn = root.querySelector("#btn-sample-csv");

  let selected = null;
  let lastResult = "";
  let lastName = "document";
  let runId = 0;
  let engineReady = false;

  function setStatus(type, text) {
    status.className = `status${type ? ` ${type}` : ""}`;
    status.textContent = text;
  }

  function setOutput(text, className) {
    output.className = className ? `output wrap ${className}` : "output wrap";
    output.textContent = text;
  }

  function setSelected(name, bytes) {
    selected = { name, bytes };
    dropFile.hidden = false;
    dropFile.textContent = `${name} · ${formatSize(bytes.byteLength)}`;
    dropTitle.textContent = "已选择文件，可再次拖入替换";
  }

  function setBusy(busy) {
    const disabled = busy || !engineReady;
    dropZone.disabled = disabled;
    convertBtn.disabled = disabled;
    sampleRtfBtn.disabled = disabled;
    sampleCsvBtn.disabled = disabled;
  }

  async function runConvert(name, bytes) {
    const id = ++runId;
    setSelected(name, bytes);
    lastName = stemName(name);
    lastResult = "";
    setOutput("正在转换…", "placeholder");
    setStatus("", "正在转换…");
    setBusy(true);
    await nextPaint();
    try {
      const { format, markdown, ms } = convertBytes(name, bytes);
      if (id !== runId) return;
      lastResult = markdown;
      setOutput(markdown);
      const formatLabel = format ? format.toUpperCase() : "未知";
      setStatus("ok", `${name} → ${formatLabel} · ${markdown.length} 字符 · ${ms} ms`);
    } catch (error) {
      if (id !== runId) return;
      lastResult = "";
      const hint = ERROR_HINTS[error.code] || "转换失败";
      const detail = error.message ? `\n${error.message}` : "";
      setOutput(`${hint}${detail}`, "error-text");
      setStatus("err", hint);
    } finally {
      if (id === runId) setBusy(false);
    }
  }

  async function convertFile(file) {
    const bytes = new Uint8Array(await file.arrayBuffer());
    await runConvert(file.name, bytes);
  }

  dropZone.addEventListener("click", () => {
    if (!dropZone.disabled) fileInput.click();
  });
  fileInput.addEventListener("change", () => {
    const file = fileInput.files?.[0];
    if (file) convertFile(file);
    fileInput.value = "";
  });

  for (const eventName of ["dragover", "drop"]) {
    dropZone.addEventListener(eventName, (event) => event.preventDefault());
  }
  dropZone.addEventListener("dragover", () => dropZone.classList.add("over"));
  dropZone.addEventListener("dragleave", () => dropZone.classList.remove("over"));
  dropZone.addEventListener("drop", () => dropZone.classList.remove("over"));

  root.addEventListener("dragover", (event) => event.preventDefault());
  root.addEventListener("drop", (event) => {
    event.preventDefault();
    dropZone.classList.remove("over");
    const file = event.dataTransfer?.files?.[0];
    if (file && engineReady) convertFile(file);
  });

  const preview = root.querySelector("#md-preview");
  const previewBody = root.querySelector("#md-preview-body");
  const previewCloseBtn = root.querySelector("#btn-preview-close");
  document.body.appendChild(preview);

  function closePreview() {
    if (preview.hidden) return;
    preview.hidden = true;
    document.body.classList.remove("md-preview-open");
    document.removeEventListener("keydown", onPreviewKeydown);
  }

  function onPreviewKeydown(event) {
    if (event.key === "Escape") {
      event.preventDefault();
      closePreview();
    }
  }

  function openPreview() {
    if (!lastResult) {
      setStatus("err", "没有可预览的结果");
      return;
    }
    previewBody.innerHTML = marked.parse(lastResult, { breaks: true, gfm: true });
    preview.hidden = false;
    document.body.classList.add("md-preview-open");
    document.addEventListener("keydown", onPreviewKeydown);
    previewCloseBtn.focus();
  }

  convertBtn.addEventListener("click", () => {
    if (selected) runConvert(selected.name, selected.bytes);
    else fileInput.click();
  });
  sampleRtfBtn.addEventListener("click", () => {
    runConvert("notes.rtf", new TextEncoder().encode(SAMPLE_RTF));
  });
  sampleCsvBtn.addEventListener("click", () => {
    runConvert("report.csv", new TextEncoder().encode(SAMPLE_CSV));
  });
  root.querySelector("#btn-clear").addEventListener("click", () => {
    runId += 1;
    selected = null;
    lastResult = "";
    lastName = "document";
    closePreview();
    dropFile.hidden = true;
    dropFile.textContent = "";
    dropTitle.textContent = engineReady ? "拖入文件，或点击选择" : "正在准备转换引擎";
    setOutput("转换后的 Markdown 会显示在这里", "placeholder");
    setStatus("", "等待文件");
  });
  root.querySelector("#btn-preview").addEventListener("click", openPreview);
  preview.addEventListener("click", (event) => {
    if (event.target.closest("[data-close-preview]")) closePreview();
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
  root.querySelector("#btn-download").addEventListener("click", () => {
    if (!lastResult) {
      setStatus("err", "没有可下载的结果");
      return;
    }
    const url = URL.createObjectURL(new Blob([lastResult], { type: "text/markdown;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `${lastName}.md`;
    link.click();
    URL.revokeObjectURL(url);
    setStatus("ok", `已下载 ${lastName}.md`);
  });

  loadEngine()
    .then(() => {
      engineReady = true;
      engineHint.textContent = "本地转换，文件不会上传";
      dropTitle.textContent = "拖入文件，或点击选择";
      setBusy(false);
    })
    .catch((error) => {
      engineHint.textContent = "引擎加载失败";
      dropTitle.textContent = "转换引擎未能加载";
      setOutput(String(error?.message ?? error), "error-text");
      setStatus("err", "转换引擎加载失败");
    });
}

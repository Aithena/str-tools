import "./style.css";
import { mountJsonFormat } from "./tools/json-format.js";
import { mountDocToMd } from "./tools/doc-to-md.js";

const tools = [
  {
    id: "json-format",
    name: "JSON 格式化",
    mount: mountJsonFormat,
  },
  {
    id: "doc-to-md",
    name: "文档转 MD",
    mount: mountDocToMd,
  },
];

const app = document.querySelector("#app");

function render(activeId) {
  const active = tools.find((tool) => tool.id === activeId) ?? tools[0];

  app.innerHTML = `
    <div class="layout">
      <header class="topbar">
        <div class="brand">
          <span class="brand-mark">STR TOOLS</span>
          <span class="brand-name">文本工具箱</span>
        </div>
        <nav class="menu">
          ${tools
            .map(
              (tool) => `
                <button
                  type="button"
                  class="menu-btn${tool.id === active.id ? " active" : ""}"
                  data-tool="${tool.id}"
                >${tool.name}</button>
              `,
            )
            .join("")}
        </nav>
      </header>
      <main class="workspace" id="workspace"></main>
    </div>
  `;

  app.querySelector(".menu").addEventListener("click", (event) => {
    const button = event.target.closest("[data-tool]");
    if (!button) return;
    const nextId = button.dataset.tool;
    if (nextId !== active.id) render(nextId);
  });

  active.mount(app.querySelector("#workspace"));
}

render(tools[0].id);

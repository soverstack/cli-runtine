import path from "path";
import fs from "fs";
import chalk from "chalk";
import ora from "ora";
import { loadYamlFile } from "../validate/utils/yaml-loader";
import { StateManager, StateBackend, InfrastructureState } from "../apply/utils/state-manager";
import { Platform } from "../../types";
import { InfrastructurePlan } from "../validate/utils/plan-generator";

export interface GraphOptions {
  platformYamlPath: string;
  outputPath?: string;
  type?: "plan" | "state" | "dependencies" | "all";
  format?: "html" | "mermaid";
  open?: boolean;
}

export interface MermaidGraph {
  type: string;
  title: string;
  diagram: string;
}

/**
 * Generate Mermaid.js diagrams from infrastructure
 */
export async function generateInfrastructureGraph(options: GraphOptions): Promise<boolean> {
  console.log(chalk.blue("\n📊 Soverstack Graph Generator\n"));

  const platformDir = path.dirname(path.resolve(options.platformYamlPath));
  const soverstackDir = path.join(platformDir, ".soverstack");

  // Step 1: Load platform
  const spinner = ora("Loading platform configuration...").start();

  const platform = loadYamlFile<Platform>(options.platformYamlPath, undefined as any, "platform");

  if (!platform) {
    spinner.fail("Failed to load platform configuration");
    return false;
  }

  spinner.succeed("Platform configuration loaded");

  // Step 2: Load state
  spinner.start("Loading infrastructure state...");

  const stateBackend: StateBackend = {
    type: platform.state?.backend || "local",
    path: platform.state?.path || path.join(soverstackDir, "state.yaml"),
  };

  const stateManager = new StateManager(stateBackend, platformDir);
  const currentState = await stateManager.loadState();

  if (currentState) {
    spinner.succeed(`State loaded: ${currentState.resources.length} resources`);
  } else {
    spinner.warn("No state found");
  }

  // Step 3: Load plan (if exists)
  const planPath = path.join(soverstackDir, "plan.yaml");
  let plan: InfrastructurePlan | null = null;

  if (fs.existsSync(planPath)) {
    spinner.start("Loading execution plan...");
    plan = loadYamlFile<InfrastructurePlan>(planPath, undefined as any, "plan");
    if (plan) {
      spinner.succeed("Execution plan loaded");
    }
  }

  // Step 4: Generate graphs
  const graphType = options.type || "all";
  const graphs: MermaidGraph[] = [];

  console.log(chalk.blue("\n🎨 Generating diagrams...\n"));

  if (graphType === "plan" || graphType === "all") {
    if (plan) {
      const planGraph = generatePlanGraph(plan);
      graphs.push(planGraph);
      console.log(chalk.green(`  ✅ Plan diagram generated (${plan.resources.length} changes)`));
    }
  }

  if (graphType === "state" || graphType === "all") {
    if (currentState) {
      const stateGraph = generateStateGraph(currentState);
      graphs.push(stateGraph);
      console.log(chalk.green(`  ✅ State diagram generated (${currentState.resources.length} resources)`));
    }
  }

  if (graphType === "dependencies" || graphType === "all") {
    if (plan || currentState) {
      const depsGraph = generateDependenciesGraph(plan, currentState);
      graphs.push(depsGraph);
      console.log(chalk.green("  ✅ Dependencies diagram generated"));
    }
  }

  if (graphs.length === 0) {
    console.log(chalk.yellow("\n⚠️  No data available for graph generation\n"));
    console.log(chalk.gray("  Run 'soverstack plan' first to generate diagrams\n"));
    return false;
  }

  // Step 5: Generate output
  const outputFormat = options.format || "html";
  const outputPath = options.outputPath || path.join(soverstackDir, `graph.${outputFormat}`);

  spinner.start("Generating output file...");

  if (outputFormat === "html") {
    generateHtmlOutput(graphs, outputPath, platform);
    spinner.succeed(`HTML graph generated: ${outputPath}`);
  } else {
    generateMermaidOutput(graphs, outputPath);
    spinner.succeed(`Mermaid diagram generated: ${outputPath}`);
  }

  // Step 6: Open in browser (if requested)
  if (options.open && outputFormat === "html") {
    const { default: open } = await import("open");
    await open(outputPath);
    console.log(chalk.blue("\n🌐 Opened in browser\n"));
  }

  console.log(chalk.green.bold("\n✅ Graph generation completed!\n"));

  return true;
}

/**
 * Generate plan execution graph
 */
function generatePlanGraph(plan: InfrastructurePlan): MermaidGraph {
  let diagram = "graph TD\n";

  // Group changes by layer
  const changesByLayer: Record<string, any[]> = {};

  plan.resources.forEach((change) => {
    if (!changesByLayer[change.layer]) {
      changesByLayer[change.layer] = [];
    }
    changesByLayer[change.layer].push(change);
  });

  // Generate nodes for each layer
  const layers = ["datacenter", "firewall", "bastion", "compute", "cluster", "features"];
  let nodeIndex = 0;

  layers.forEach((layer) => {
    const changes = changesByLayer[layer] || [];

    if (changes.length > 0) {
      const layerNode = `L${nodeIndex}`;
      diagram += `  ${layerNode}["${layer.toUpperCase()}<br/>${changes.length} changes"]\n`;
      diagram += `  style ${layerNode} fill:#4a9eff,stroke:#2563eb,stroke-width:2px\n`;

      changes.forEach((change, idx) => {
        const changeNode = `${layerNode}_C${idx}`;
        const actionColor = getActionColor(change.action);
        const actionIcon = getActionIcon(change.action);

        diagram += `  ${changeNode}["${actionIcon} ${change.resource_type}<br/>${change.resource_id}"]\n`;
        diagram += `  style ${changeNode} fill:${actionColor},stroke:#333,stroke-width:1px\n`;
        diagram += `  ${layerNode} --> ${changeNode}\n`;
      });

      nodeIndex++;
    }
  });

  return {
    type: "plan",
    title: "Execution Plan",
    diagram,
  };
}

/**
 * Generate current state graph
 */
function generateStateGraph(state: InfrastructureState): MermaidGraph {
  let diagram = "graph LR\n";

  // Group resources by layer
  const resourcesByLayer: Record<string, any[]> = {};

  state.resources.forEach((resource) => {
    if (!resourcesByLayer[resource.layer]) {
      resourcesByLayer[resource.layer] = [];
    }
    resourcesByLayer[resource.layer].push(resource);
  });

  // Generate nodes
  const layers = ["datacenter", "firewall", "bastion", "compute", "cluster", "features"];
  let prevLayerNode: string | null = null;

  layers.forEach((layer, layerIdx) => {
    const resources = resourcesByLayer[layer] || [];

    if (resources.length > 0) {
      const layerNode = `L${layerIdx}`;
      diagram += `  ${layerNode}["${layer.toUpperCase()}<br/>${resources.length} resources"]\n`;
      diagram += `  style ${layerNode} fill:#10b981,stroke:#059669,stroke-width:2px\n`;

      // Connect layers sequentially
      if (prevLayerNode) {
        diagram += `  ${prevLayerNode} ==> ${layerNode}\n`;
      }

      // Add resource nodes
      resources.slice(0, 5).forEach((resource, idx) => {
        const resNode = `${layerNode}_R${idx}`;
        diagram += `  ${resNode}["${resource.type}<br/>${resource.id}"]\n`;
        diagram += `  style ${resNode} fill:#d1fae5,stroke:#059669,stroke-width:1px\n`;
        diagram += `  ${layerNode} --> ${resNode}\n`;
      });

      if (resources.length > 5) {
        const moreNode = `${layerNode}_MORE`;
        diagram += `  ${moreNode}["... ${resources.length - 5} more"]\n`;
        diagram += `  style ${moreNode} fill:#f3f4f6,stroke:#9ca3af,stroke-width:1px\n`;
        diagram += `  ${layerNode} --> ${moreNode}\n`;
      }

      prevLayerNode = layerNode;
    }
  });

  return {
    type: "state",
    title: "Current State",
    diagram,
  };
}

/**
 * Generate dependencies graph
 */
function generateDependenciesGraph(
  plan: InfrastructurePlan | null,
  state: InfrastructureState | null
): MermaidGraph {
  let diagram = "graph TD\n";

  // Define layer dependencies
  const layerDeps = [
    { from: "datacenter", to: "compute", label: "provides infrastructure" },
    { from: "datacenter", to: "firewall", label: "network config" },
    { from: "firewall", to: "bastion", label: "secure access" },
    { from: "bastion", to: "compute", label: "jump host" },
    { from: "compute", to: "cluster", label: "worker nodes" },
    { from: "cluster", to: "features", label: "platform services" },
  ];

  // Add layer nodes
  const layers = ["datacenter", "firewall", "bastion", "compute", "cluster", "features"];
  layers.forEach((layer, idx) => {
    const nodeId = `L${idx}`;

    // Count resources in this layer
    let count = 0;
    if (state) {
      count = state.resources.filter((r) => r.layer === layer).length;
    }

    diagram += `  ${nodeId}["${layer.toUpperCase()}<br/>${count} resources"]\n`;
    diagram += `  style ${nodeId} fill:#8b5cf6,stroke:#7c3aed,stroke-width:2px\n`;
  });

  // Add dependencies
  layerDeps.forEach((dep) => {
    const fromIdx = layers.indexOf(dep.from);
    const toIdx = layers.indexOf(dep.to);

    if (fromIdx !== -1 && toIdx !== -1) {
      diagram += `  L${fromIdx} -->|"${dep.label}"| L${toIdx}\n`;
    }
  });

  return {
    type: "dependencies",
    title: "Layer Dependencies",
    diagram,
  };
}

/**
 * Generate interactive HTML with Mermaid.js
 */
function generateHtmlOutput(graphs: MermaidGraph[], outputPath: string, platform: Platform): void {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Soverstack Infrastructure Graph</title>
  <script src="https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js"></script>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      min-height: 100vh;
      padding: 2rem;
    }

    .container {
      max-width: 1400px;
      margin: 0 auto;
    }

    .header {
      background: white;
      padding: 2rem;
      border-radius: 1rem;
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);
      margin-bottom: 2rem;
    }

    .header h1 {
      color: #4a5568;
      margin-bottom: 0.5rem;
      font-size: 2rem;
    }

    .header p {
      color: #718096;
      font-size: 1rem;
    }

    .tabs {
      display: flex;
      gap: 1rem;
      margin-bottom: 2rem;
    }

    .tab {
      background: white;
      padding: 1rem 2rem;
      border-radius: 0.5rem;
      cursor: pointer;
      transition: all 0.3s;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
      font-weight: 500;
      color: #4a5568;
    }

    .tab:hover {
      transform: translateY(-2px);
      box-shadow: 0 6px 12px rgba(0, 0, 0, 0.15);
    }

    .tab.active {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
    }

    .graph-container {
      display: none;
      background: white;
      padding: 2rem;
      border-radius: 1rem;
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);
    }

    .graph-container.active {
      display: block;
      animation: fadeIn 0.5s;
    }

    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(20px); }
      to { opacity: 1; transform: translateY(0); }
    }

    .graph-title {
      font-size: 1.5rem;
      color: #2d3748;
      margin-bottom: 1.5rem;
      font-weight: 600;
    }

    .mermaid {
      display: flex;
      justify-content: center;
      padding: 1rem;
    }

    .footer {
      margin-top: 2rem;
      text-align: center;
      color: white;
      font-size: 0.9rem;
      opacity: 0.8;
    }

    .legend {
      margin-top: 2rem;
      padding: 1rem;
      background: #f7fafc;
      border-radius: 0.5rem;
      border-left: 4px solid #667eea;
    }

    .legend h3 {
      color: #2d3748;
      font-size: 1rem;
      margin-bottom: 0.5rem;
    }

    .legend-items {
      display: flex;
      gap: 1.5rem;
      flex-wrap: wrap;
    }

    .legend-item {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .legend-color {
      width: 16px;
      height: 16px;
      border-radius: 3px;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>📊 Soverstack Infrastructure Graph</h1>
      <p>Project: ${platform.project_name || "Unknown"} | Environment: ${platform.infrastructure_tier || "local"}</p>
    </div>

    <div class="tabs">
${graphs.map((graph, idx) => `      <div class="tab${idx === 0 ? " active" : ""}" onclick="showGraph(${idx})">
        ${graph.title}
      </div>`).join("\n")}
    </div>

${graphs.map((graph, idx) => `    <div class="graph-container${idx === 0 ? " active" : ""}" id="graph-${idx}">
      <div class="graph-title">${graph.title}</div>
      <div class="mermaid">
${graph.diagram}
      </div>
      ${idx === 0 ? `<div class="legend">
        <h3>Legend</h3>
        <div class="legend-items">
          <div class="legend-item">
            <div class="legend-color" style="background: #86efac;"></div>
            <span>Create</span>
          </div>
          <div class="legend-item">
            <div class="legend-color" style="background: #fbbf24;"></div>
            <span>Update</span>
          </div>
          <div class="legend-item">
            <div class="legend-color" style="background: #f87171;"></div>
            <span>Delete</span>
          </div>
          <div class="legend-item">
            <div class="legend-color" style="background: #e5e7eb;"></div>
            <span>No Change</span>
          </div>
        </div>
      </div>` : ""}
    </div>`).join("\n")}

    <div class="footer">
      Generated by Soverstack CLI | ${new Date().toLocaleString()}
    </div>
  </div>

  <script>
    mermaid.initialize({
      startOnLoad: true,
      theme: 'default',
      themeVariables: {
        primaryColor: '#667eea',
        primaryTextColor: '#fff',
        primaryBorderColor: '#5568d3',
        lineColor: '#718096',
        secondaryColor: '#764ba2',
        tertiaryColor: '#f7fafc',
      }
    });

    function showGraph(index) {
      // Hide all graphs
      const graphs = document.querySelectorAll('.graph-container');
      const tabs = document.querySelectorAll('.tab');

      graphs.forEach(g => g.classList.remove('active'));
      tabs.forEach(t => t.classList.remove('active'));

      // Show selected graph
      document.getElementById('graph-' + index).classList.add('active');
      tabs[index].classList.add('active');
    }
  </script>
</body>
</html>`;

  fs.writeFileSync(outputPath, html, "utf-8");
}

/**
 * Generate raw Mermaid output
 */
function generateMermaidOutput(graphs: MermaidGraph[], outputPath: string): void {
  const output = graphs
    .map((graph) => {
      return `# ${graph.title}\n\n${graph.diagram}\n`;
    })
    .join("\n---\n\n");

  fs.writeFileSync(outputPath, output, "utf-8");
}

/**
 * Get color for action type
 */
function getActionColor(action: string): string {
  switch (action) {
    case "create":
      return "#86efac"; // Green
    case "update":
      return "#fbbf24"; // Yellow
    case "delete":
      return "#f87171"; // Red
    default:
      return "#e5e7eb"; // Gray
  }
}

/**
 * Get icon for action type
 */
function getActionIcon(action: string): string {
  switch (action) {
    case "create":
      return "➕";
    case "update":
      return "🔄";
    case "delete":
      return "🗑️";
    default:
      return "➖";
  }
}

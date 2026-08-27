<!DOCTYPE html>

<html class="dark" lang="es"><head>
<meta charset="utf-8"/>
<meta content="width=device-width, initial-scale=1.0" name="viewport"/>
<title>ArqueoGraph - Explorador Sitio Demo CSV</title>
<script src="https://cdn.tailwindcss.com?plugins=forms,container-queries"></script>
<link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&amp;display=swap" rel="stylesheet"/>
<link href="https://fonts.googleapis.com/css2?family=Hanken+Grotesk:wght@400;500;600;700&amp;display=swap" rel="stylesheet"/>
<script id="tailwind-config">
        tailwind.config = {
            darkMode: "class",
            theme: {
                extend: {
                    "colors": {
                        "inverse-surface": "#e4e2e4",
                        "surface-variant": "#353436",
                        "inverse-primary": "#565e74",
                        "surface": "#131315",
                        "on-error-container": "#ffdad6",
                        "primary-fixed-dim": "#bec6e0",
                        "on-tertiary": "#3e2d11",
                        "surface-dim": "#131315",
                        "data-node-image": "#34D399",
                        "error-container": "#93000a",
                        "surface-container": "#1f1f21",
                        "on-tertiary-fixed": "#271901",
                        "on-surface": "#e4e2e4",
                        "primary-fixed": "#dae2fd",
                        "tertiary-fixed": "#fcdeb5",
                        "secondary": "#7bd0ff",
                        "primary": "#bec6e0",
                        "surface-bright": "#39393b",
                        "surface-container-highest": "#353436",
                        "on-surface-variant": "#c6c6cd",
                        "on-tertiary-fixed-variant": "#574425",
                        "background": "#131315",
                        "on-secondary": "#00354a",
                        "surface-container-low": "#1b1b1d",
                        "secondary-fixed-dim": "#7bd0ff",
                        "surface-container-lowest": "#0e0e10",
                        "data-node-pathology": "#FBBF24",
                        "on-background": "#e4e2e4",
                        "on-primary-container": "#798098",
                        "on-secondary-fixed": "#001e2c",
                        "tertiary-container": "#231500",
                        "surface-tint": "#bec6e0",
                        "primary-container": "#0f172a",
                        "error": "#ffb4ab",
                        "surface-elevated": "#1E293B",
                        "on-tertiary-container": "#957d5a",
                        "outline": "#909097",
                        "tertiary": "#dec29a",
                        "data-node-individual": "#94A3B8",
                        "secondary-fixed": "#c4e7ff",
                        "surface-container-high": "#2a2a2b",
                        "on-primary": "#283044",
                        "inverse-on-surface": "#303032",
                        "on-primary-fixed": "#131b2e",
                        "border-muted": "#1E293B",
                        "on-error": "#690005",
                        "data-node-element": "#38BDF8",
                        "on-primary-fixed-variant": "#3f465c",
                        "on-secondary-fixed-variant": "#004c69",
                        "on-secondary-container": "#00374d",
                        "secondary-container": "#00a6e0",
                        "outline-variant": "#45464d",
                        "tertiary-fixed-dim": "#dec29a"
                    },
                    "borderRadius": {
                        "DEFAULT": "0.25rem",
                        "lg": "0.5rem",
                        "xl": "0.75rem",
                        "full": "9999px"
                    },
                    "spacing": {
                        "sidebar-width": "280px",
                        "unit": "4px",
                        "panel-gap": "1px",
                        "container-margin": "24px",
                        "gutter": "16px"
                    },
                    "fontFamily": {
                        "headline-md": ["Hanken Grotesk"],
                        "body-sm": ["Hanken Grotesk"],
                        "title-sm": ["Hanken Grotesk"],
                        "data-numeric": ["Hanken Grotesk"],
                        "label-mono": ["Hanken Grotesk"],
                        "body-base": ["Hanken Grotesk"],
                        "display-lg": ["Hanken Grotesk"]
                    },
                    "fontSize": {
                        "headline-md": ["24px", { "lineHeight": "1.3", "fontWeight": "600" }],
                        "body-sm": ["13px", { "lineHeight": "1.5", "fontWeight": "400" }],
                        "title-sm": ["18px", { "lineHeight": "1.4", "fontWeight": "600" }],
                        "data-numeric": ["14px", { "lineHeight": "1", "fontWeight": "600" }],
                        "label-mono": ["12px", { "lineHeight": "1", "letterSpacing": "0.05em", "fontWeight": "500" }],
                        "body-base": ["14px", { "lineHeight": "1.5", "fontWeight": "400" }],
                        "display-lg": ["36px", { "lineHeight": "1.2", "letterSpacing": "-0.02em", "fontWeight": "700" }]
                    }
                },
            },
        }
    </script>
<style>
        body {
            background-color: theme('colors.background');
            color: theme('colors.on-background');
        }
        ::-webkit-scrollbar {
            width: 8px;
            height: 8px;
        }
        ::-webkit-scrollbar-track {
            background: theme('colors.surface-container-low');
        }
        ::-webkit-scrollbar-thumb {
            background: theme('colors.surface-container-high');
            border-radius: theme('borderRadius.full');
        }
        ::-webkit-scrollbar-thumb:hover {
            background: theme('colors.outline');
        }

        .panel-grid {
            display: grid;
            gap: theme('spacing.panel-gap');
            background-color: theme('colors.border-muted');
        }

        .panel-content {
            background-color: theme('colors.surface');
        }

        .tab-content {
            display: none;
        }
        .tab-content.active {
            display: flex;
        }

        .tab-btn.active {
            background-color: theme('colors.surface-elevated');
            border-color: theme('colors.border-muted');
            color: theme('colors.on-surface');
        }
    </style>
</head>
<body class="h-screen w-full flex flex-col overflow-hidden font-body-base">
<!-- TopNavBar -->
<header class="flex justify-between items-center px-container-margin py-unit w-full h-16 bg-surface border-b border-surface-container-high z-50 shrink-0">
<div class="flex items-center gap-6">
<div class="text-headline-md font-headline-md font-bold text-on-surface">ArqueoGraph</div>
<nav class="hidden md:flex gap-1 h-full items-center">
<a class="text-on-surface-variant hover:text-on-surface hover:bg-surface-container-low transition-colors px-3 py-1 rounded-DEFAULT" href="#">Dashboard</a>
<a class="text-secondary border-b-2 border-secondary font-semibold pb-1 px-3 h-full flex items-center" href="#">Sitios</a>
<a class="text-on-surface-variant hover:text-on-surface hover:bg-surface-container-low transition-colors px-3 py-1 rounded-DEFAULT" href="#">Administración</a>
</nav>
</div>
<div class="flex items-center gap-4">
<button class="bg-primary text-on-primary px-4 py-2 rounded-DEFAULT font-label-mono hover:bg-primary-fixed-dim transition-colors text-sm font-semibold">
                Respaldar datos
            </button>
<div class="flex gap-2">
<button class="p-2 text-on-surface-variant hover:text-on-surface hover:bg-surface-container-low rounded-full transition-colors">
<span class="material-symbols-outlined">settings</span>
</button>
<button class="p-2 text-on-surface-variant hover:text-on-surface hover:bg-surface-container-low rounded-full transition-colors relative">
<span class="material-symbols-outlined">notifications</span>
<span class="absolute top-2 right-2 w-2 h-2 bg-error rounded-full"></span>
</button>
</div>
<img alt="Investigador Principal" class="w-8 h-8 rounded-full border border-surface-container-high ml-2" src="https://lh3.googleusercontent.com/aida-public/AB6AXuDCxckj1TFomFe0jTMG4ejcJAIK9s0B3Njte8vz4l8tjmLFZF2gbSqp27zS1FnnZu518zcHOAeY-CiuBZwn-XvILUrybVADtDjfe7O75ygwJepxE-seK_bkkv-nHPMwh2RDHhVN4oHZ6s0gH8wbt0cFTZKcRDr2pQYvKYpudYA35THLue9HR5IPj0Mxvv99WjcSjqB0gss1Xas2zYlEl7fS4jhEyJquOPPh1ZluOY_tw1gDZCVpQgA"/>
</div>
</header>
<!-- Main Application Area -->
<div class="flex-1 flex overflow-hidden panel-grid relative">
<!-- Left Sidebar -->
<aside class="w-sidebar-width flex flex-col h-full bg-surface-container border-r border-surface-container-high panel-content shrink-0 z-40 relative">
<div class="p-4 border-b border-surface-container-high shrink-0">
<h1 class="font-headline-md text-on-surface text-lg">Sitio Demo CSV</h1>
<p class="font-label-mono text-on-surface-variant text-xs mt-1 uppercase tracking-wider">Análisis de Sitio</p>
</div>
<div class="flex-1 overflow-y-auto p-4 space-y-6">
<!-- Element Distribution Mini Viz -->
<div class="space-y-2">
<h3 class="font-label-mono text-on-surface-variant text-xs uppercase">Distribución de Elementos</h3>
<div class="h-16 w-full bg-surface-container-low rounded border border-surface-container-high relative overflow-hidden flex items-end px-1 gap-0.5">
<!-- Simulated Bar chart for elements -->
<div class="w-1/5 bg-secondary-container h-[80%] hover:bg-secondary transition-colors cursor-pointer group relative">
<div class="absolute -top-6 left-1/2 -translate-x-1/2 bg-surface text-xs px-1 rounded opacity-0 group-hover:opacity-100 font-label-mono border border-surface-container-high">As</div>
</div>
<div class="w-1/5 bg-secondary-container h-[40%] hover:bg-secondary transition-colors cursor-pointer group relative">
<div class="absolute -top-6 left-1/2 -translate-x-1/2 bg-surface text-xs px-1 rounded opacity-0 group-hover:opacity-100 font-label-mono border border-surface-container-high">B</div>
</div>
<div class="w-1/5 bg-secondary-container h-[90%] hover:bg-secondary transition-colors cursor-pointer group relative">
<div class="absolute -top-6 left-1/2 -translate-x-1/2 bg-surface text-xs px-1 rounded opacity-0 group-hover:opacity-100 font-label-mono border border-surface-container-high">Li</div>
</div>
<div class="w-1/5 bg-secondary-container h-[60%] hover:bg-secondary transition-colors cursor-pointer group relative">
<div class="absolute -top-6 left-1/2 -translate-x-1/2 bg-surface text-xs px-1 rounded opacity-0 group-hover:opacity-100 font-label-mono border border-surface-container-high">Mn</div>
</div>
<div class="w-1/5 bg-secondary-container h-[70%] hover:bg-secondary transition-colors cursor-pointer group relative">
<div class="absolute -top-6 left-1/2 -translate-x-1/2 bg-surface text-xs px-1 rounded opacity-0 group-hover:opacity-100 font-label-mono border border-surface-container-high">Zn</div>
</div>
</div>
</div>
<!-- Filters -->
<div class="space-y-4">
<div class="flex justify-between items-center">
<h2 class="font-label-mono text-on-surface-variant text-xs uppercase">Filtros Activos</h2>
<button class="text-secondary text-xs hover:underline">Limpiar Filtros</button>
</div>
<!-- Select Group -->
<div class="space-y-3">
<div>
<label class="block font-label-mono text-on-surface-variant text-[10px] uppercase mb-1">Sexo</label>
<select class="w-full bg-surface text-body-sm text-on-surface border border-surface-container-high rounded p-2 focus:border-secondary focus:ring-1 focus:ring-secondary outline-none appearance-none">
<option>Todos</option>
<option>Femenino</option>
<option>Masculino</option>
<option>Indeterminado</option>
</select>
</div>
<div>
<label class="block font-label-mono text-on-surface-variant text-[10px] uppercase mb-1">Grupo Etario</label>
<select class="w-full bg-surface text-body-sm text-on-surface border border-surface-container-high rounded p-2 focus:border-secondary focus:ring-1 focus:ring-secondary outline-none appearance-none">
<option>Todos</option>
<option>Adulto</option>
<option>Subadulto</option>
</select>
</div>
<div>
<label class="block font-label-mono text-on-surface-variant text-[10px] uppercase mb-1">Elemento Químico</label>
<select class="w-full bg-surface text-body-sm text-on-surface border border-surface-container-high rounded p-2 focus:border-secondary focus:ring-1 focus:ring-secondary outline-none appearance-none" id="element-filter" onchange="updateElementGraph()">
<option value="all">Todos (Grafo Base)</option>
<option value="As">As (Arsénico)</option>
<option value="B">B (Boro)</option>
<option value="Li">Li (Litio)</option>
<option value="Mn">Mn (Manganeso)</option>
<option value="Zn">Zn (Zinc)</option>
</select>
</div>
<div>
<label class="block font-label-mono text-on-surface-variant text-[10px] uppercase mb-1">Patologías (Presencia)</label>
<div class="flex flex-col gap-2 mt-2 max-h-32 overflow-y-auto">
<label class="flex items-center gap-2 cursor-pointer group">
<input class="rounded bg-surface border-surface-container-high text-secondary focus:ring-secondary focus:ring-offset-surface" type="checkbox"/>
<span class="text-body-sm text-on-surface group-hover:text-primary transition-colors">periostitis</span>
</label>
<label class="flex items-center gap-2 cursor-pointer group">
<input class="rounded bg-surface border-surface-container-high text-secondary focus:ring-secondary focus:ring-offset-surface" type="checkbox"/>
<span class="text-body-sm text-on-surface group-hover:text-primary transition-colors">patologia_dental</span>
</label>
<label class="flex items-center gap-2 cursor-pointer group">
<input class="rounded bg-surface border-surface-container-high text-secondary focus:ring-secondary focus:ring-offset-surface" type="checkbox"/>
<span class="text-body-sm text-on-surface group-hover:text-primary transition-colors">criba_orbitalia</span>
</label>
<label class="flex items-center gap-2 cursor-pointer group">
<input class="rounded bg-surface border-surface-container-high text-secondary focus:ring-secondary focus:ring-offset-surface" type="checkbox"/>
<span class="text-body-sm text-on-surface group-hover:text-primary transition-colors">hiperostosis_porotica</span>
</label>
</div>
</div>
</div>
</div>
</div>
<div class="p-4 border-t border-surface-container-high shrink-0 bg-surface-container-lowest">
<div class="flex items-center justify-between text-on-surface-variant text-xs">
<span>Individuos filtrados:</span>
<span class="font-data-numeric text-on-surface text-sm">30 / 30</span>
</div>
<div class="w-full h-1 bg-surface-container-high rounded-full mt-2 overflow-hidden">
<div class="h-full bg-secondary w-full"></div>
</div>
</div>
</aside>
<!-- Main Visualization Stage -->
<main class="flex-1 flex flex-col h-full bg-surface relative overflow-hidden panel-content">
<!-- View Controls Toolbar -->
<div class="h-12 border-b border-surface-container-high flex items-center justify-between px-4 shrink-0 bg-surface-container-lowest">
<div class="flex space-x-1" id="tab-controls">
<button class="tab-btn px-3 py-1.5 text-xs font-label-mono text-on-surface-variant border border-transparent rounded flex items-center gap-2 transition-colors hover:bg-surface-container-high" onclick="switchTab('pca')">
<span class="material-symbols-outlined text-[16px]">scatter_plot</span>
                        PCA
                    </button>
<button class="tab-btn active px-3 py-1.5 text-xs font-label-mono bg-surface-elevated text-on-surface border border-border-muted rounded flex items-center gap-2" onclick="switchTab('red')">
<span class="material-symbols-outlined text-[16px]">hub</span>
                        Red
                    </button>
<button class="tab-btn px-3 py-1.5 text-xs font-label-mono text-on-surface-variant border border-transparent rounded flex items-center gap-2 transition-colors hover:bg-surface-container-high" onclick="switchTab('datos')">
<span class="material-symbols-outlined text-[16px]">table_chart</span>
                        Datos
                    </button>
</div>
<div class="flex items-center gap-3">
<div class="flex items-center gap-2 text-xs font-label-mono text-on-surface-variant">
<span class="w-2 h-2 rounded-full bg-data-node-individual inline-block"></span> Individuo
                        <span class="w-2 h-2 rounded-full bg-secondary inline-block ml-2"></span> Sitio
                    </div>
<div class="h-4 w-px bg-surface-container-high"></div>
<button class="text-on-surface-variant hover:text-on-surface p-1 rounded transition-colors" title="Exportar Vista">
<span class="material-symbols-outlined text-[18px]">download</span>
</button>
<button class="text-on-surface-variant hover:text-on-surface p-1 rounded transition-colors" title="Pantalla Completa">
<span class="material-symbols-outlined text-[18px]">fullscreen</span>
</button>
</div>
</div>
<!-- Visualization Canvas Container -->
<div class="flex-1 relative bg-black/20 overflow-hidden" id="viz-container">
<!-- Tab Content: RED (Graph) - Active by default -->
<div class="absolute inset-0 tab-content active flex-col items-center justify-center" id="tab-red">
<div class="absolute inset-0 flex items-center justify-center pointer-events-none opacity-10">
<div class="w-[80%] h-[80%] border border-surface-container-high rounded-full border-dashed animate-[spin_120s_linear_infinite]"></div>
</div>
<!-- Force Directed Graph Simulation -->
<svg class="w-full h-full" id="graph-svg">
<!-- Links -->
<g stroke="theme('colors.surface-container-high')" stroke-opacity="0.6" stroke-width="1.5">
<line x1="50%" x2="40%" y1="50%" y2="40%"></line>
<line x1="50%" x2="60%" y1="50%" y2="35%"></line>
<line x1="50%" x2="55%" y1="50%" y2="65%"></line>
<line x1="50%" x2="35%" y1="50%" y2="55%"></line>
<line x1="50%" x2="45%" y1="50%" y2="70%"></line>
<line x1="50%" x2="65%" y1="50%" y2="50%"></line>
<line x1="50%" x2="30%" y1="50%" y2="45%"></line>
<line x1="50%" x2="70%" y1="50%" y2="60%"></line>
</g>
<!-- Nodes -->
<g stroke="#131315" stroke-width="1.5">
<!-- Central Node (Site) -->
<circle class="cursor-pointer hover:stroke-white transition-all" cx="50%" cy="50%" fill="#7bd0ff" r="12"><title>Sitio Demo CSV</title></circle>
<!-- Individual Nodes -->
<circle class="cursor-pointer hover:stroke-white transition-all stroke-secondary" cx="40%" cy="40%" fill="#94A3B8" r="6" stroke-width="2"><title>SDC1</title></circle>
<circle class="cursor-pointer hover:stroke-white transition-all" cx="60%" cy="35%" fill="#94A3B8" r="6"><title>SDC2</title></circle>
<circle class="cursor-pointer hover:stroke-white transition-all" cx="55%" cy="65%" fill="#94A3B8" r="6"><title>SDC3</title></circle>
<circle class="cursor-pointer hover:stroke-white transition-all" cx="35%" cy="55%" fill="#94A3B8" r="6"><title>SDC4</title></circle>
<circle class="cursor-pointer hover:stroke-white transition-all" cx="45%" cy="70%" fill="#94A3B8" r="6"><title>SDC5</title></circle>
<circle class="cursor-pointer hover:stroke-white transition-all" cx="65%" cy="50%" fill="#94A3B8" r="6"><title>SDC6</title></circle>
<circle class="cursor-pointer hover:stroke-white transition-all" cx="30%" cy="45%" fill="#94A3B8" r="6"><title>SDC7</title></circle>
<circle class="cursor-pointer hover:stroke-white transition-all" cx="70%" cy="60%" fill="#94A3B8" r="6"><title>SDC8</title></circle>
</g>
<!-- Element Network Overlay (Hidden by default, shown via JS) -->
<g id="element-network" style="display: none;">
<circle cx="50%" cy="50%" fill="none" r="100" stroke="#7bd0ff" stroke-opacity="0.2" stroke-width="20"></circle>
<circle cx="50%" cy="50%" fill="none" r="150" stroke="#7bd0ff" stroke-opacity="0.1" stroke-width="20"></circle>
<text class="font-label-mono" fill="#c6c6cd" font-size="10" text-anchor="middle" x="50%" y="30%">Concentración Alta</text>
<text class="font-label-mono" fill="#c6c6cd" font-size="10" text-anchor="middle" x="50%" y="15%">Concentración Baja</text>
</g>
</svg>
<div class="absolute bottom-4 left-4 text-[10px] font-label-mono text-on-surface-variant bg-surface/80 p-2 rounded border border-surface-container-high" id="graph-legend">
                        Red de Referencia (Individuo → Sitio)
                    </div>
</div>
<!-- Tab Content: PCA (Scatter Plot) -->
<div class="absolute inset-0 tab-content" id="tab-pca">
<div class="absolute inset-0 flex items-center justify-center pointer-events-none opacity-20">
<div class="w-[80%] h-[80%] border border-surface-container-high rounded-full border-dashed"></div>
<div class="absolute w-[60%] h-[60%] border border-surface-container-high rounded-full border-dashed"></div>
</div>
<div class="absolute top-[30%] left-[40%] w-2 h-2 rounded-full bg-data-node-individual cursor-pointer hover:ring-2 hover:ring-white transition-all" title="SDC2"></div>
<div class="absolute top-[45%] left-[60%] w-2 h-2 rounded-full bg-data-node-individual cursor-pointer hover:ring-2 hover:ring-white transition-all ring-2 ring-secondary z-10" title="SDC1"></div>
<div class="absolute top-[60%] left-[30%] w-2 h-2 rounded-full bg-data-node-individual cursor-pointer hover:ring-2 hover:ring-white transition-all" title="SDC3"></div>
<div class="absolute top-[20%] left-[70%] w-2 h-2 rounded-full bg-data-node-individual cursor-pointer hover:ring-2 hover:ring-white transition-all" title="SDC4"></div>
<div class="absolute bottom-10 left-10 right-10 h-px bg-surface-container-high"></div>
<div class="absolute bottom-10 left-10 top-10 w-px bg-surface-container-high"></div>
<span class="absolute bottom-4 left-1/2 -translate-x-1/2 text-[10px] font-label-mono text-on-surface-variant">PC1 (Composición Elemental)</span>
<span class="absolute top-1/2 left-2 -translate-y-1/2 -rotate-90 text-[10px] font-label-mono text-on-surface-variant origin-center">PC2</span>
</div>
<!-- Tab Content: DATOS (Table) -->
<div class="absolute inset-0 tab-content overflow-auto bg-surface" id="tab-datos">
<table class="w-full text-left text-body-sm text-on-surface border-collapse">
<thead class="bg-surface-container-lowest sticky top-0 z-10 font-label-mono text-[10px] text-on-surface-variant uppercase shadow-sm">
<tr>
<th class="px-4 py-3 font-medium border-b border-surface-container-high">ID Individuo</th>
<th class="px-4 py-3 font-medium border-b border-surface-container-high">Sexo</th>
<th class="px-4 py-3 font-medium border-b border-surface-container-high">Edad</th>
<th class="px-4 py-3 font-medium border-b border-surface-container-high text-right">As</th>
<th class="px-4 py-3 font-medium border-b border-surface-container-high text-right">B</th>
<th class="px-4 py-3 font-medium border-b border-surface-container-high text-right">Li</th>
</tr>
</thead>
<tbody class="divide-y divide-surface-container-high">
<tr class="hover:bg-surface-container-low transition-colors cursor-pointer bg-surface-elevated/30">
<td class="px-4 py-3 font-data-numeric">SDC1</td>
<td class="px-4 py-3">femenino</td>
<td class="px-4 py-3">adulto</td>
<td class="px-4 py-3 font-data-numeric text-right">1.2</td>
<td class="px-4 py-3 font-data-numeric text-right">4.5</td>
<td class="px-4 py-3 font-data-numeric text-right">0.8</td>
</tr>
<tr class="hover:bg-surface-container-low transition-colors cursor-pointer">
<td class="px-4 py-3 font-data-numeric">SDC2</td>
<td class="px-4 py-3">masculino</td>
<td class="px-4 py-3">subadulto</td>
<td class="px-4 py-3 font-data-numeric text-right">0.9</td>
<td class="px-4 py-3 font-data-numeric text-right">3.2</td>
<td class="px-4 py-3 font-data-numeric text-right">1.1</td>
</tr>
<tr class="hover:bg-surface-container-low transition-colors cursor-pointer">
<td class="px-4 py-3 font-data-numeric">SDC3</td>
<td class="px-4 py-3">indeterminado</td>
<td class="px-4 py-3">adulto</td>
<td class="px-4 py-3 font-data-numeric text-right">2.1</td>
<td class="px-4 py-3 font-data-numeric text-right">5.0</td>
<td class="px-4 py-3 font-data-numeric text-right">0.5</td>
</tr>
</tbody>
</table>
</div>
</div>
</main>
<!-- Right Sidebar: Detail Panel -->
<aside class="w-[320px] hidden xl:flex flex-col h-full bg-surface border-l border-surface-container-high panel-content shrink-0 z-40">
<!-- Header Detail -->
<div class="p-4 border-b border-surface-container-high bg-surface-container-lowest flex justify-between items-start">
<div>
<div class="flex items-center gap-2 mb-1">
<span class="px-1.5 py-0.5 rounded bg-surface-container-high text-[10px] font-label-mono text-on-surface-variant border border-surface-container-highest">ID</span>
<h2 class="font-title-sm text-on-surface">SDC1</h2>
</div>
<p class="text-body-sm text-on-surface-variant font-label-mono text-[10px]">sitio_demo_csv_001</p>
</div>
<button class="text-on-surface-variant hover:text-on-surface transition-colors">
<span class="material-symbols-outlined text-[20px]">close</span>
</button>
</div>
<div class="flex-1 overflow-y-auto">
<!-- Image Gallery Preview -->
<div class="p-4 border-b border-surface-container-high">
<h3 class="font-label-mono text-on-surface-variant text-[10px] uppercase mb-2">Registro Fotográfico</h3>
<div class="grid grid-cols-2 gap-2">
<div class="aspect-square bg-surface-container-high rounded border border-border-muted relative overflow-hidden group cursor-pointer">
<img class="object-cover w-full h-full opacity-80 group-hover:opacity-100 transition-opacity grayscale hover:grayscale-0" src="https://lh3.googleusercontent.com/aida-public/AB6AXuBSuEOLrj9olkTuDEGOhmsoBcT6LCMMMxwBqyQn5VfSNbwjCM8i1kuzEVoYf2gIYhPN1NaJ7tWkZTJS-Gn8AfZuE5dxi1WpXS5SJa8S405TGC493xSL6ghRh1uzI77DI_WOsyUx_02a76ixzkYjXMPeiLQncXd5RjFGg_Uuh_ToF-VNlYwRQXcURjdrY61fSVoSek40SZLllTdhlyfnhfHQqsttFkkfJBCMjsjkGq7oOfPNqg_gdY4"/>
<span class="absolute bottom-1 right-1 material-symbols-outlined text-[14px] text-white bg-black/50 rounded-sm p-0.5 opacity-0 group-hover:opacity-100 transition-opacity">zoom_in</span>
</div>
<div class="aspect-square bg-surface-container-high rounded border border-border-muted relative overflow-hidden flex items-center justify-center">
<span class="text-[10px] font-label-mono text-on-surface-variant">Sin más imágenes</span>
</div>
</div>
</div>
<!-- Attributes Data List -->
<div class="p-4 space-y-3">
<h3 class="font-label-mono text-on-surface-variant text-[10px] uppercase mb-1">Perfil Biológico</h3>
<div class="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
<div class="text-on-surface-variant text-xs">Sexo</div>
<div class="text-on-surface font-medium text-right capitalize">femenino</div>
<div class="text-on-surface-variant text-xs">Edad</div>
<div class="text-on-surface font-medium text-right capitalize">adulto</div>
</div>
</div>
<!-- Elements Data List -->
<div class="p-4 border-t border-surface-container-high">
<h3 class="font-label-mono text-on-surface-variant text-[10px] uppercase mb-2">Composición Elemental (ppm)</h3>
<div class="space-y-1 font-data-numeric text-xs">
<div class="flex justify-between p-1 bg-surface-container-lowest rounded">
<span class="text-on-surface-variant">As</span>
<span class="text-secondary">1.2</span>
</div>
<div class="flex justify-between p-1 rounded">
<span class="text-on-surface-variant">B</span>
<span class="text-secondary">4.5</span>
</div>
<div class="flex justify-between p-1 bg-surface-container-lowest rounded">
<span class="text-on-surface-variant">Li</span>
<span class="text-secondary">0.8</span>
</div>
<div class="flex justify-between p-1 rounded">
<span class="text-on-surface-variant">Mn</span>
<span class="text-secondary">12.4</span>
</div>
<div class="flex justify-between p-1 bg-surface-container-lowest rounded">
<span class="text-on-surface-variant">Zn</span>
<span class="text-secondary">85.3</span>
</div>
</div>
</div>
<!-- Pathologies List -->
<div class="p-4 border-t border-surface-container-high bg-surface-container-lowest/50">
<h3 class="font-label-mono text-on-surface-variant text-[10px] uppercase mb-3">Patologías Reportadas</h3>
<ul class="space-y-2">
<li class="flex items-start gap-2 p-2 rounded bg-surface border border-surface-container-high">
<span class="material-symbols-outlined text-[16px] text-data-node-pathology mt-0.5">medication</span>
<div>
<div class="text-body-sm text-on-surface font-medium leading-tight capitalize">periostitis</div>
</div>
</li>
<li class="flex items-start gap-2 p-2 rounded bg-surface border border-surface-container-high">
<span class="material-symbols-outlined text-[16px] text-data-node-pathology mt-0.5">medication</span>
<div>
<div class="text-body-sm text-on-surface font-medium leading-tight capitalize">patologia_dental</div>
</div>
</li>
</ul>
</div>
</div>
<!-- Detail Panel Actions -->
<div class="p-4 border-t border-surface-container-high shrink-0 flex gap-2">
<button class="flex-1 bg-surface-container-high hover:bg-surface-elevated text-on-surface py-2 rounded text-xs font-label-mono transition-colors border border-surface-container-highest">
                    Descargar Ficha JSON
                </button>
</div>
</aside>
</div>
<script>
    function switchTab(tabId) {
        // Hide all tabs
        document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
        // Show selected tab
        document.getElementById('tab-' + tabId).classList.add('active');

        // Update buttons
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.remove('bg-surface-elevated', 'text-on-surface', 'border-border-muted', 'active');
            btn.classList.add('text-on-surface-variant', 'border-transparent');
        });

        // Find clicked button and style it
        const clickedBtn = Array.from(document.querySelectorAll('.tab-btn')).find(btn => btn.getAttribute('onclick').includes(tabId));
        if(clickedBtn) {
            clickedBtn.classList.remove('text-on-surface-variant', 'border-transparent');
            clickedBtn.classList.add('bg-surface-elevated', 'text-on-surface', 'border-border-muted', 'active');
        }
    }

    function updateElementGraph() {
        const val = document.getElementById('element-filter').value;
        const legend = document.getElementById('graph-legend');
        const netOverlay = document.getElementById('element-network');

        if (val === 'all') {
            legend.textContent = 'Red de Referencia (Individuo → Sitio)';
            netOverlay.style.display = 'none';
        } else {
            legend.textContent = `Red de Concentraciones: Elemento ${val}`;
            netOverlay.style.display = 'block';
            // In a real app, D3 logic would move nodes here based on concentration of 'val'
        }
    }
</script>
</body></html>
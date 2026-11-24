import { ChangeDetectorRef, Component, ElementRef, HostListener, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import fullAdderExample from '../../public/full-adder.json';
import logicGatesExample from '../../public/logic-gates.json';
import alu74181Example from '../../public/alu-74181.json';
import latchMemoryExample from '../../public/latch-memory.json';
import counterExample from '../../public/counter.json';

type ComponentType = 'battery' | 'switch' | 'push_button_no' | 'push_button_nc' | 'clock' | 'relay' | 'relay_spdt' | 'contact' | 'lamp' | 'fuse';
type TerminalSide = 'left' | 'right' | 'COM' | 'NC' | 'NO' | 'A1' | 'A2';
type ToolMode = 'select' | 'wire';
type RelayDelayMultiplier = 1 | 10 | 100 | 1000;

const COMPONENT_SCALE = 0.5;
const RELAY_ACTUATION_MS = 20;
const RELAY_RELEASE_MS = 10;

interface RelayTransition {
  target: boolean;
  startedAt: number;
  duration: number;
  deadline: number;
  timer: ReturnType<typeof setTimeout>;
}

const COMPONENT_ARTWORK: Record<ComponentType, { inactive: string; active: string }> = {
  battery: {
    inactive: '<svg viewBox="0 0 136 44" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M0 34H61M75 34H136M61 24V44M75 18V44"/></svg>',
    active: '<svg viewBox="0 0 136 44" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M0 34H61M75 34H136M61 24V44M75 18V44"/></svg>',
  },
  clock: {
    inactive: '<svg viewBox="0 0 136 44" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M0 34H20M116 34H136M20 34h10l8-18 10 36 10-36 10 18h28"/></svg>',
    active: '<svg viewBox="0 0 136 44" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M0 34H20M116 34H136M20 34h10l8-18 10 36 10-36 10 18h28"/></svg>',
  },
  switch: {
    inactive: '<svg viewBox="0 0 136 44" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M0 34H45M91 34H136M45 34L88 15"/><circle cx="45" cy="34" r="2"/><circle cx="91" cy="34" r="2"/></svg>',
    active: '<svg viewBox="0 0 136 44" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M0 34H45M91 34H136M45 34H91"/><circle cx="45" cy="34" r="2"/><circle cx="91" cy="34" r="2"/></svg>',
  },
  push_button_no: {
    inactive: '<svg viewBox="0 0 136 44" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M0 34H45M91 34H136M45 34L88 15"/><circle cx="45" cy="34" r="2"/><circle cx="91" cy="34" r="2"/></svg>',
    active: '<svg viewBox="0 0 136 44" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M0 34H45M91 34H136M45 34H91"/><circle cx="45" cy="34" r="2"/><circle cx="91" cy="34" r="2"/></svg>',
  },
  push_button_nc: {
    inactive: '<svg viewBox="0 0 136 44" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M0 34H45M91 34H136M45 34H91"/><circle cx="45" cy="34" r="2"/><circle cx="91" cy="34" r="2"/></svg>',
    active: '<svg viewBox="0 0 136 44" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M0 34H45M91 34H136M45 34L88 15"/><circle cx="45" cy="34" r="2"/><circle cx="91" cy="34" r="2"/></svg>',
  },
  relay: {
    inactive: '<svg viewBox="0 0 136 44" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M0 34H24C24 26 36 26 36 34S48 42 48 34 60 26 60 34 72 42 72 34 84 26 84 34 96 42 96 34 108 26 108 34 120 42 120 34H136"/></svg>',
    active: '<svg viewBox="0 0 136 44" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M0 34H24C24 26 36 26 36 34S48 42 48 34 60 26 60 34 72 42 72 34 84 26 84 34 96 42 96 34 108 26 108 34 120 42 120 34H136"/></svg>',
  },
  relay_spdt: {
    inactive: '<svg viewBox="0 0 176 132" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M0 40H62M134 24H176M134 58H176M62 40L134 24M0 108H28C28 100 40 100 40 108S52 116 52 108 64 100 64 108 76 116 76 108 88 100 88 108 100 116 100 108 112 100 112 108 124 116 124 108 136 100 136 108 148 116 148 108H176"/><circle cx="62" cy="40" r="2.5"/><circle cx="134" cy="24" r="2.5"/><circle cx="134" cy="58" r="2.5"/></svg>',
    active: '<svg viewBox="0 0 176 132" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M0 40H62M134 24H176M134 58H176M62 40L134 58M0 108H28C28 100 40 100 40 108S52 116 52 108 64 100 64 108 76 116 76 108 88 100 88 108 100 116 100 108 112 100 112 108 124 116 124 108 136 100 136 108 148 116 148 108H176"/><circle cx="62" cy="40" r="2.5"/><circle cx="134" cy="24" r="2.5"/><circle cx="134" cy="58" r="2.5"/></svg>',
  },
  contact: {
    inactive: '<svg viewBox="0 0 136 44" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M0 34H45M91 34H136M45 34L88 15"/><circle cx="45" cy="34" r="2"/><circle cx="91" cy="34" r="2"/></svg>',
    active: '<svg viewBox="0 0 136 44" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M0 34H45M91 34H136M45 34L88 15"/><circle cx="45" cy="34" r="2"/><circle cx="91" cy="34" r="2"/></svg>',
  },
  lamp: {
    inactive: '<svg viewBox="0 0 136 44" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M0 34H58M78 34H136"/><circle cx="68" cy="34" r="10"/><path d="m62 28 12 12m0-12L62 40"/></svg>',
    active: '<svg viewBox="0 0 136 44" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M0 34H58M78 34H136"/><circle cx="68" cy="34" r="10"/><path d="m62 28 12 12m0-12L62 40"/></svg>',
  },
  fuse: {
    inactive: '<svg viewBox="0 0 136 44" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M0 34H52M84 34H136M52 21H84V43H52Z"/></svg>',
    active: '<svg viewBox="0 0 136 44" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M0 34H52M84 34H136M52 21H84V43H52Z"/></svg>',
  },
};

interface CircuitComponent {
  id: string;
  type: ComponentType;
  x: number;
  y: number;
  label: string;
  on: boolean;
  energized: boolean;
  pinLabels?: Partial<Record<TerminalSide, string>>;
  rotation?: number;
  intervalMs?: number;
}

interface WireEndpoint {
  id: string;
  side: TerminalSide;
}

interface CircuitWire {
  id: string;
  from: WireEndpoint;
  to: WireEndpoint;
  energized: boolean;
}

interface PowerConnection {
  wire: CircuitWire;
  source: CircuitComponent;
  endpoint: WireEndpoint;
  polarity: '+' | '-';
}

interface TerminalPin {
  side: TerminalSide;
  name: string;
  label?: string;
  x: number;
  y: number;
  labelX?: number;
  labelY?: number;
  align?: 'left-label' | 'right-label';
}

interface CircuitEdge {
  a: string;
  b: string;
  wire?: CircuitWire;
}

interface Point {
  x: number;
  y: number;
}

interface Bounds {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

interface WireRoute {
  path: string;
  blocked: boolean;
  points: Point[];
  net: string;
}

type Selection = { kind: 'component'; id: string } | { kind: 'wire'; id: string } | null;

@Component({
  selector: 'app-root',
  standalone: true,
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App implements OnInit, OnDestroy {
  @ViewChild('canvas') private canvasRef?: ElementRef<HTMLDivElement>;
  @ViewChild('canvasWrap') private canvasWrapRef?: ElementRef<HTMLDivElement>;
  @ViewChild('wireLayer') private wireLayerRef?: ElementRef<SVGSVGElement>;

  readonly componentOrder: ComponentType[] = ['battery', 'switch', 'push_button_no', 'push_button_nc', 'clock', 'relay_spdt', 'lamp'];
  readonly componentScale = COMPONENT_SCALE;
  readonly relayDelayMultipliers: RelayDelayMultiplier[] = [1, 10, 100, 1000];
  readonly definitions: Record<ComponentType, { name: string; short: string; info: string }> = {
    battery: { name: 'Battery', short: 'Battery', info: '24 V power source' },
    switch: { name: 'Switch', short: 'Switch', info: 'Manual normally-open contact' },
    push_button_no: { name: 'Push button NO', short: 'Push button NO', info: 'Momentary normally-open push button' },
    push_button_nc: { name: 'Push button NC', short: 'Push button NC', info: 'Momentary normally-closed push button' },
    clock: { name: 'Clock', short: 'Clock', info: 'Periodic two-terminal pulse generator' },
    relay: { name: 'Relay coil', short: 'Coil', info: '24 V control coil' },
    relay_spdt: { name: 'Relay (SPDT)', short: 'Relay SPDT', info: 'A1/A2 coil · COM, NC and NO contacts' },
    contact: { name: 'NO contact', short: 'NO contact', info: 'Normally-open contact' },
    lamp: { name: 'Lamp', short: 'Lamp', info: '24 V indicator' },
    fuse: { name: 'Fuse', short: 'Fuse', info: 'Circuit protection' },
  };
  private readonly symbolMarkup: Record<ComponentType, string> = {
    battery: '<svg viewBox="0 0 64 38" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M5 19h17m21 0h16M25 10v18m6-13v8m5-13v18m6-13v8"/></svg>',
    switch: '<svg viewBox="0 0 64 38" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M5 20h15m24 0h15M20 20l22-12"/><circle cx="20" cy="20" r="2"/><circle cx="44" cy="20" r="2"/></svg>',
    push_button_no: '<svg viewBox="0 0 64 38" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M5 20h15m24 0h15M20 20l22-12"/><circle cx="20" cy="20" r="2"/><circle cx="44" cy="20" r="2"/><path d="M32 5v8m-4-4h8"/></svg>',
    push_button_nc: '<svg viewBox="0 0 64 38" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M5 20h15m24 0h15M20 20h24"/><circle cx="20" cy="20" r="2"/><circle cx="44" cy="20" r="2"/><path d="M32 5v8m-4-4h8"/></svg>',
    clock: '<svg viewBox="0 0 64 38" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M4 20h10l4-9 6 18 6-18 6 9h12"/></svg>',
    relay: '<svg viewBox="0 0 64 38" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M5 19h10m34 0h10"/><path d="M15 19c0-11 7-11 7 0s7 11 7 0 7-11 7 0 7 11 7 0 7-11 7 0"/></svg>',
    relay_spdt: '<svg viewBox="0 0 64 38" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M4 10h7m30 0h8M11 10c0-8 6-8 6 0s6 8 6 0 6-8 6 0 6 8 6 0 6-8 6 0"/><path d="M7 29h15m16-7h19M22 29l13-8"/><circle cx="22" cy="29" r="1.5"/><circle cx="35" cy="21" r="1.5"/></svg>',
    contact: '<svg viewBox="0 0 64 38" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M5 20h15m24 0h15M20 20l22-12"/><circle cx="20" cy="20" r="2"/><circle cx="44" cy="20" r="2"/></svg>',
    lamp: '<svg viewBox="0 0 64 38" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M5 19h14m26 0h14"/><circle cx="32" cy="19" r="12"/><path d="m26 13 12 12m0-12L26 25"/></svg>',
    fuse: '<svg viewBox="0 0 64 38" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M5 19h13m28 0h13"/><rect x="18" y="11" width="28" height="16" rx="3"/><path d="M23 19h18"/></svg>',
  };
  readonly symbols: Record<ComponentType, SafeHtml>;
  private readonly componentArtwork: Record<ComponentType, { inactive: SafeHtml; active: SafeHtml }>;
  readonly relayPins: TerminalPin[] = [
    { side: 'COM', name: 'COM', label: '', x: 0, y: 50, labelX: -2, labelY: 40, align: 'right-label' },
    { side: 'NC', name: 'NF', label: '', x: 176, y: 34, labelX: 178, labelY: 24, align: 'left-label' },
    { side: 'NO', name: 'NA', label: '', x: 176, y: 68, labelX: 178, labelY: 58, align: 'left-label' },
    { side: 'A1', name: 'Bobina A1', label: '', x: 0, y: 118, labelX: -2, labelY: 108, align: 'right-label' },
    { side: 'A2', name: 'Bobina A2', label: '', x: 176, y: 118, labelX: 178, labelY: 108, align: 'left-label' },
  ];
  private readonly swappedRelayPins: TerminalPin[] = this.relayPins.map((pin) =>
    pin.side === 'A1' || pin.side === 'A2'
      ? {
          ...pin,
          x: 176 - pin.x,
          labelX: pin.x === 0 ? 178 : -2,
          align: pin.x === 0 ? 'left-label' : 'right-label',
        }
      : pin,
  );
  private readonly simplePins: TerminalPin[] = [
    { side: 'left', name: 'left', x: 0, y: 58 },
    { side: 'right', name: 'right', x: 136, y: 58 },
  ];

  components: CircuitComponent[] = [];
  wires: CircuitWire[] = [];
  projectName = 'New circuit';
  selected: Selection = null;
  tool: ToolMode = 'select';
  connectingFrom: WireEndpoint | null = null;
  running = false;
  relayDelayMultiplier: RelayDelayMultiplier = 1;
  fileMenuOpen = false;
  examplesOpen = false;
  zoom = 100;
  toastMessage = '';
  private toastTimer: ReturnType<typeof setTimeout> | undefined;
  private idCounter = 1;
  private dragState: { item: CircuitComponent; offsetX: number; offsetY: number } | null = null;
  private terminalDrag: { from: WireEndpoint; pointerId: number; pointer: Point } | null = null;
  private routeLayout = '';
  private readonly routeCache = new Map<string, WireRoute>();
  private coilLayout = '';
  private swappedCoils = new Set<string>();
  private readonly relayTransitions = new Map<string, RelayTransition>();
  private readonly clockTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private readonly relayOpenAudio = new Audio('relay-open.mp3');
  private readonly relayCloseAudio = new Audio('relay-close.mp3');

  constructor(sanitizer: DomSanitizer, private readonly changeDetector: ChangeDetectorRef) {
    const trust = (markup: string): SafeHtml => sanitizer.bypassSecurityTrustHtml(markup);
    this.relayOpenAudio.preload = 'auto';
    this.relayCloseAudio.preload = 'auto';
    this.symbols = {
      battery: trust(this.symbolMarkup.battery),
      switch: trust(this.symbolMarkup.switch),
      push_button_no: trust(this.symbolMarkup.push_button_no),
      push_button_nc: trust(this.symbolMarkup.push_button_nc),
      clock: trust(this.symbolMarkup.clock),
      relay: trust(this.symbolMarkup.relay),
      relay_spdt: trust(this.symbolMarkup.relay_spdt),
      contact: trust(this.symbolMarkup.contact),
      lamp: trust(this.symbolMarkup.lamp),
      fuse: trust(this.symbolMarkup.fuse),
    };
    this.componentArtwork = {
      battery: { inactive: trust(COMPONENT_ARTWORK.battery.inactive), active: trust(COMPONENT_ARTWORK.battery.active) },
      switch: { inactive: trust(COMPONENT_ARTWORK.switch.inactive), active: trust(COMPONENT_ARTWORK.switch.active) },
      push_button_no: { inactive: trust(COMPONENT_ARTWORK.push_button_no.inactive), active: trust(COMPONENT_ARTWORK.push_button_no.active) },
      push_button_nc: { inactive: trust(COMPONENT_ARTWORK.push_button_nc.inactive), active: trust(COMPONENT_ARTWORK.push_button_nc.active) },
      clock: { inactive: trust(COMPONENT_ARTWORK.clock.inactive), active: trust(COMPONENT_ARTWORK.clock.active) },
      relay: { inactive: trust(COMPONENT_ARTWORK.relay.inactive), active: trust(COMPONENT_ARTWORK.relay.active) },
      relay_spdt: { inactive: trust(COMPONENT_ARTWORK.relay_spdt.inactive), active: trust(COMPONENT_ARTWORK.relay_spdt.active) },
      contact: { inactive: trust(COMPONENT_ARTWORK.contact.inactive), active: trust(COMPONENT_ARTWORK.contact.active) },
      lamp: { inactive: trust(COMPONENT_ARTWORK.lamp.inactive), active: trust(COMPONENT_ARTWORK.lamp.active) },
      fuse: { inactive: trust(COMPONENT_ARTWORK.fuse.inactive), active: trust(COMPONENT_ARTWORK.fuse.active) },
    };
  }

  get selectedComponent(): CircuitComponent | undefined {
    return this.selected?.kind === 'component' ? this.getComponent(this.selected.id) : undefined;
  }

  get selectedWire(): CircuitWire | undefined {
    return this.selected?.kind === 'wire' ? this.wires.find((wire) => wire.id === this.selected?.id) : undefined;
  }

  get activeRelayCount(): number {
    return this.components.filter((item) => (item.type === 'relay' || item.type === 'relay_spdt') && item.energized).length;
  }

  get litLampCount(): number {
    return this.components.filter((item) => item.type === 'lamp' && item.energized).length;
  }

  get canvasMargin(): number {
    const width = this.canvasWrapRef?.nativeElement.clientWidth ?? 1400;
    return this.zoom < 100 ? Math.max(0, (width - 1400 * this.zoom / 100) / 2) : 0;
  }

  get terminalPreviewPath(): string | null {
    const drag = this.terminalDrag;
    const item = drag ? this.getComponent(drag.from.id) : undefined;
    if (!drag || !item) return null;

    const start = this.pinPosition(item, drag.from.side);
    const end = drag.pointer;
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const distance = Math.hypot(dx, dy);
    const handle = Math.max(14, Math.min(120, distance * 0.42));
    const direction = this.pinDirection(item, drag.from.side);
    const control1 = { x: start.x + direction.x * handle, y: start.y + direction.y * handle };
    const control2 = distance
      ? { x: end.x - dx / distance * handle, y: end.y - dy / distance * handle }
      : end;
    return `M ${start.x} ${start.y} C ${control1.x} ${control1.y}, ${control2.x} ${control2.y}, ${end.x} ${end.y}`;
  }

  ngOnInit(): void {
    if (this.loadProject()) this.showToast('Previous project loaded.');
  }

  ngOnDestroy(): void {
    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.stopClockTimers();
    this.clearRelayTransitions();
  }

  @HostListener('document:keydown', ['$event'])
  onKeyDown(event: KeyboardEvent): void {
    const target = event.target;
    const editing = target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement;
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
      event.preventDefault();
      this.saveProject();
    } else if (!editing && (event.key === 'Delete' || event.key === 'Backspace')) {
      this.deleteSelection();
    } else if (!editing && event.key === 'Escape') {
      this.selected = null;
      this.connectingFrom = null;
      this.setTool('select');
    } else if (!editing && event.key.toLowerCase() === 'r') {
      this.rotateSelection();
    } else if (!editing && event.key.toLowerCase() === 'w') {
      this.setTool('wire');
    } else if (!editing && event.key.toLowerCase() === 'v') {
      this.setTool('select');
    }
  }

  updateProjectName(event: Event): void {
    this.projectName = (event.target as HTMLInputElement).value;
  }

  updateComponentName(event: Event, item: CircuitComponent): void {
    item.label = (event.target as HTMLInputElement).value;
  }

  updatePinLabel(event: Event, item: CircuitComponent, side: TerminalSide): void {
    item.pinLabels = { ...item.pinLabels, [side]: (event.target as HTMLInputElement).value };
  }

  pinLabel(item: CircuitComponent, pin: TerminalPin): string {
    return item.pinLabels?.[pin.side] ?? pin.label ?? '';
  }

  getPins(item: CircuitComponent): TerminalPin[] {
    if (item.type !== 'relay_spdt') return this.simplePins;
    return this.coilSwaps().has(item.id) ? this.swappedRelayPins : this.relayPins;
  }

  pinName(item: CircuitComponent | undefined, side: TerminalSide): string {
    if (item?.type === 'relay_spdt') return this.relayPins.find((pin) => pin.side === side)?.name ?? side;
    return side === 'left' ? 'left' : 'right';
  }

  componentDrawing(item: CircuitComponent): SafeHtml {
    const isActive = this.isSwitchLike(item.type) ? item.on : item.energized;
    return this.componentArtwork[item.type][isActive ? 'active' : 'inactive'];
  }

  isSelected(kind: 'component' | 'wire', id: string): boolean {
    return this.selected?.kind === kind && this.selected.id === id;
  }

  addComponent(type: ComponentType): void {
    if (this.running) {
      this.showToast('Stop the simulation before adding components.');
      return;
    }
    const wrap = this.canvasWrapRef?.nativeElement;
    const index = this.components.length;
    const x = wrap
      ? Math.max(25, Math.round((wrap.scrollLeft + wrap.clientWidth * 0.35) * 100 / this.zoom / 22) * 22)
      : 210 + (index % 4) * 190;
    const y = wrap
      ? Math.max(55, Math.round((wrap.scrollTop + wrap.clientHeight * 0.35) * 100 / this.zoom / 22) * 22)
      : 170 + Math.floor(index / 4) * 140;
    const item: CircuitComponent = {
      id: this.makeId('c'),
      type,
      x,
      y,
      label: this.definitions[type].short,
      on: false,
      energized: false,
      rotation: 0,
      ...(type === 'clock' ? { intervalMs: 1000 } : {}),
    };
    this.components = [...this.components, item];
    this.selected = { kind: 'component', id: item.id };
    this.setTool('select');
  }

  setTool(tool: ToolMode): void {
    this.tool = tool;
    this.connectingFrom = null;
  }

  componentClick(event: MouseEvent, item: CircuitComponent): void {
    if ((event.target as HTMLElement).closest('.terminal')) return;
    event.stopPropagation();
    if (this.running && item.type === 'switch') {
      item.on = !item.on;
      this.calculateSimulation();
      return;
    }

    if (this.tool !== 'wire') this.selected = { kind: 'component', id: item.id };
  }

  pressPushButton(event: PointerEvent, item: CircuitComponent): void {
    const target = event.target;
    if (!this.running || !this.isPushButton(item.type) ||
        (target instanceof HTMLElement && target.closest('.terminal, .power-marker'))) return;
    event.stopPropagation();
    if (!item.on) {
      item.on = true;
      this.calculateSimulation();
    }
  }

  releasePushButton(item: CircuitComponent): void {
    if (!this.isPushButton(item.type) || !item.on) return;
    item.on = false;
    if (this.running) this.calculateSimulation();
  }

  toggleSwitch(item: CircuitComponent): void {
    if (!this.running || item.type !== 'switch') return;
    item.on = !item.on;
    this.calculateSimulation();
  }

  startDrag(event: PointerEvent, item: CircuitComponent): void {
    if ((event.target as HTMLElement).closest('.terminal, .power-marker') || this.tool === 'wire' || this.running || event.button !== 0) return;
    event.preventDefault();
    const rect = this.canvasRef?.nativeElement.getBoundingClientRect();
    if (!rect) return;
    this.dragState = {
      item,
      offsetX: (event.clientX - rect.left) * 100 / this.zoom - item.x,
      offsetY: (event.clientY - rect.top) * 100 / this.zoom - item.y,
    };
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    this.selected = { kind: 'component', id: item.id };
  }

  @HostListener('document:pointermove', ['$event'])
  onCanvasPointerMove(event: PointerEvent): void {
    if (this.terminalDrag?.pointerId === event.pointerId) {
      this.terminalDrag.pointer = this.pointerPosition(event);
    }
    if (!this.dragState) return;
    const rect = this.canvasRef?.nativeElement.getBoundingClientRect();
    if (!rect) return;
    this.dragState.item.x = Math.max(12, Math.round((event.clientX - rect.left) * 100 / this.zoom - this.dragState.offsetX));
    this.dragState.item.y = Math.max(40, Math.round((event.clientY - rect.top) * 100 / this.zoom - this.dragState.offsetY));
  }

  onCanvasPointerUp(): void {
    this.dragState = null;
  }

  handleTerminal(event: MouseEvent, item: CircuitComponent, side: TerminalSide): void {
    event.stopPropagation();
    if (this.running) {
      this.showToast('Stop the simulation before changing connections.');
      return;
    }
    if (this.tool !== 'wire') {
      this.selected = { kind: 'component', id: item.id };
      return;
    }
    const pin: WireEndpoint = { id: item.id, side };
    if (!this.connectingFrom) {
      this.connectingFrom = pin;
      this.showToast('Agora escolha o segundo terminal.');
      return;
    }
    this.connectTerminals(this.connectingFrom, pin);
  }

  startTerminalDrag(event: PointerEvent, item: CircuitComponent, side: TerminalSide): void {
    if (this.running || event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    this.terminalDrag = {
      from: { id: item.id, side },
      pointerId: event.pointerId,
      pointer: this.pointerPosition(event),
    };
  }

  finishTerminalDrag(event: PointerEvent, item: CircuitComponent, side: TerminalSide): void {
    const drag = this.terminalDrag;
    if (!drag || drag.pointerId !== event.pointerId) return;
    this.terminalDrag = null;
    const hitTarget = document.elementFromPoint?.(event.clientX, event.clientY);
    const terminalTarget = hitTarget?.closest<HTMLButtonElement>('.terminal');
    const componentTarget = terminalTarget?.closest<HTMLElement>('.component');
    const targetItem = componentTarget?.dataset['id']
      ? this.getComponent(componentTarget.dataset['id'])
      : item;
    const targetSide = (terminalTarget?.dataset['side'] as TerminalSide | undefined) ?? side;
    if (!targetItem || (drag.from.id === targetItem.id && drag.from.side === targetSide)) return;
    event.preventDefault();
    this.connectTerminals(drag.from, { id: targetItem.id, side: targetSide });
  }

  @HostListener('document:pointerup')
  clearTerminalDrag(): void {
    this.terminalDrag = null;
  }

  @HostListener('document:pointercancel')
  cancelTerminalDrag(): void {
    this.terminalDrag = null;
  }

  private connectTerminals(from: WireEndpoint, to: WireEndpoint): void {
    if (this.running) {
      this.showToast('Stop the simulation before changing connections.');
      return;
    }
    if (from.id === to.id && from.side === to.side) {
      this.connectingFrom = null;
      return;
    }
    const duplicate = this.wires.some((wire) =>
      (wire.from.id === from.id && wire.from.side === from.side && wire.to.id === to.id && wire.to.side === to.side) ||
      (wire.to.id === from.id && wire.to.side === from.side && wire.from.id === to.id && wire.from.side === to.side),
    );
    if (duplicate) {
      this.showToast('These terminals are already connected.');
    } else {
      this.wires = [...this.wires, { id: this.makeId('w'), from, to, energized: false }];
    }
    this.connectingFrom = null;
  }

  private pointerPosition(event: PointerEvent): Point {
    const rect = this.canvasRef?.nativeElement.getBoundingClientRect();
    if (!rect) return { x: event.clientX, y: event.clientY };
    return {
      x: (event.clientX - rect.left) * 100 / this.zoom,
      y: (event.clientY - rect.top) * 100 / this.zoom,
    };
  }

  selectWire(event: MouseEvent, wire: CircuitWire): void {
    event.stopPropagation();
    if (this.tool !== 'wire') this.selected = { kind: 'wire', id: wire.id };
  }

  onCanvasClick(event: MouseEvent): void {
    if (event.target === event.currentTarget || event.target === this.wireLayerRef?.nativeElement) {
      this.selected = null;
      this.connectingFrom = null;
    }
  }

  powerConnection(wire: CircuitWire): PowerConnection | undefined {
    const from = this.getComponent(wire.from.id);
    const to = this.getComponent(wire.to.id);
    if (!from || !to || (from.type === 'battery') === (to.type === 'battery')) return undefined;
    const source = from.type === 'battery' ? from : to;
    const target = from.type === 'battery' ? to : from;
    const sourceEndpoint = from.type === 'battery' ? wire.from : wire.to;
    const endpoint = from.type === 'battery' ? wire.to : wire.from;
    if ((sourceEndpoint.side !== 'left' && sourceEndpoint.side !== 'right') ||
      !(target.type === 'relay_spdt' ? this.relayPins : this.simplePins).some((pin) => pin.side === endpoint.side)) return undefined;
    return {
      wire,
      source,
      endpoint,
      polarity: sourceEndpoint.side === 'right' ? '+' : '-',
    };
  }

  powerConnections(item: CircuitComponent, side: TerminalSide): PowerConnection[] {
    return this.wires.flatMap((wire) => {
      const connection = this.powerConnection(wire);
      return connection?.endpoint.id === item.id && connection.endpoint.side === side ? [connection] : [];
    });
  }

  wirePath(wire: CircuitWire): string {
    return this.wireRoute(wire).path;
  }

  wireBlocked(wire: CircuitWire): boolean {
    return this.wireRoute(wire).blocked;
  }

  private wireRoute(wire: CircuitWire): { path: string; blocked: boolean } {
    if (this.powerConnection(wire)) return { path: '', blocked: false };
    const layout = JSON.stringify([
      this.components.map((item) => [item.id, item.type, item.x, item.y, item.rotation]),
      this.wires.map((item) => [item.id, item.from.id, item.from.side, item.to.id, item.to.side]),
    ]);
    if (layout !== this.routeLayout) {
      this.routeLayout = layout;
      this.routeCache.clear();
    }
    const cached = this.routeCache.get(wire.id);
    if (cached) return cached;

    const parents = new Map<string, string>();
    const root = (key: string): string => {
      let current = key;
      while (parents.has(current)) current = parents.get(current)!;
      return current;
    };
    const endpointKey = (endpoint: WireEndpoint): string => `${endpoint.id}:${endpoint.side}`;
    this.wires.forEach((item) => {
      const a = root(endpointKey(item.from));
      const b = root(endpointKey(item.to));
      if (a !== b) parents.set(a, b);
    });

    for (const item of this.wires) {
      if (this.routeCache.has(item.id)) continue;
      if (this.powerConnection(item)) continue;
      const from = this.getComponent(item.from.id);
      const to = this.getComponent(item.to.id);
      if (!from || !to) {
        this.routeCache.set(item.id, { path: '', blocked: true, points: [], net: '' });
        continue;
      }
      const net = root(endpointKey(item.from));
      const occupied = [...this.routeCache.values()].filter((route) => route.net !== net && !route.blocked);
      const start = this.pinPosition(from, item.from.side);
      const end = this.pinPosition(to, item.to.side);
      const fromDirection = this.pinDirection(from, item.from.side);
      const toDirection = this.pinDirection(to, item.to.side);
      const curve = this.directCurve(start, end, fromDirection, toDirection, from.id, to.id, occupied);
      if (curve) {
        this.routeCache.set(item.id, { ...curve, blocked: false, net });
        continue;
      }
      const points = this.routeAroundComponents(start, end, fromDirection, toDirection, from.id, to.id, occupied);
      this.routeCache.set(item.id, points
        ? { ...this.curvedDetour(points, fromDirection, toDirection, from.id, to.id, occupied), blocked: false, net }
        : { path: `M ${start.x} ${start.y} L ${end.x} ${end.y}`, blocked: true, points: [], net });
    }
    return this.routeCache.get(wire.id) ?? { path: '', blocked: true };
  }

  runSimulation(): void {
    this.running = !this.running;
    if (this.running) this.startClockTimers();
    else this.stopClockTimers();
    this.calculateSimulation();
    if (this.running && !this.components.some((item) => item.type === 'battery')) {
      this.showToast('Add a battery to test continuity.');
    }
  }

  updateClockInterval(event: Event, item: CircuitComponent): void {
    if (item.type !== 'clock') return;
    const intervalMs = Number((event.target as HTMLInputElement).value);
    if (!Number.isFinite(intervalMs)) return;
    item.intervalMs = Math.max(100, Math.min(5000, Math.round(intervalMs)));
    if (this.running) {
      this.stopClockTimer(item.id);
      this.startClockTimer(item);
    }
  }

  setRelayDelayMultiplier(event: Event): void {
    const value = Number((event.target as HTMLSelectElement).value);
    if (!this.isRelayDelayMultiplier(value)) {
      this.showToast('Invalid delay multiplier.');
      return;
    }
    if (value === this.relayDelayMultiplier) return;
    const now = performance.now();
    this.relayDelayMultiplier = value;
    for (const [id, transition] of [...this.relayTransitions]) {
      const progress = Math.min(1, Math.max(0, (now - transition.startedAt) / transition.duration));
      this.scheduleRelayTransition(id, transition.target, progress);
    }
  }

  saveProject(): void {
    const project = this.projectData();
    let savedLocally = true;
    try {
      localStorage.setItem('rele-lab-project', JSON.stringify(project));
    } catch {
      savedLocally = false;
    }
    try {
      this.downloadProject(project);
      this.showToast(savedLocally ? 'Circuit saved and exported.' : 'Circuit exported; it could not be saved in the browser.');
    } catch {
      this.showToast(savedLocally ? 'Circuit saved in the browser, but the file could not be exported.' : 'The circuit could not be saved or exported.');
    }
  }

  importProject(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;

    file.text().then((text) => {
      try {
        const value: unknown = JSON.parse(text);
        if (!this.applyProject(value)) {
          this.showToast('The file does not contain a valid project.');
          return;
        }
        this.showToast('Project imported.');
      } catch {
        this.showToast('The project file could not be read.');
      }
    }).catch(() => {
      this.showToast('The project file could not be read.');
    });
  }

  private projectData(): {
    version: 1;
    name: string;
    relayDelayMultiplier: RelayDelayMultiplier;
    components: CircuitComponent[];
    wires: CircuitWire[];
  } {
    return {
      version: 1,
      name: this.projectName.trim() || 'New circuit',
      relayDelayMultiplier: this.relayDelayMultiplier,
      components: this.components,
      wires: this.wires,
    };
  }

  private downloadProject(project: ReturnType<App['projectData']>): void {
    const blob = new Blob([JSON.stringify(project, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${project.name.replace(/[^\w.-]+/g, '-').replace(/^-+|-+$/g, '') || 'novo-circuito'}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }

  newProject(): void {
    if ((this.components.length || this.wires.length) && !window.confirm('Delete all components and connections?')) return;
    this.stopClockTimers();
    this.clearRelayTransitions();
    this.components = [];
    this.wires = [];
    this.projectName = 'New circuit';
    this.selected = null;
    this.running = false;
    this.connectingFrom = null;
    this.setTool('select');
  }

  clearCanvas(): void {
    if (!this.components.length && !this.wires.length) return;
    if (!window.confirm('Delete all components and connections?')) return;
    this.stopClockTimers();
    this.clearRelayTransitions();
    this.components = [];
    this.wires = [];
    this.selected = null;
    this.running = false;
    this.connectingFrom = null;
  }

  deleteSelection(): void {
    if (!this.selected) return;
    if (this.selected.kind === 'component') {
      this.stopClockTimer(this.selected.id);
      this.components = this.components.filter((item) => item.id !== this.selected?.id);
      this.wires = this.wires.filter((wire) => wire.from.id !== this.selected?.id && wire.to.id !== this.selected?.id);
    } else {
      this.wires = this.wires.filter((wire) => wire.id !== this.selected?.id);
    }
    this.selected = null;
    this.calculateSimulation();
  }

  undoWire(): void {
    if (!this.wires.length) {
      this.showToast('There are no connections to undo.');
      return;
    }
    this.wires = this.wires.slice(0, -1);
    this.selected = null;
    this.calculateSimulation();
  }

  rotateSelection(): void {
    const item = this.selectedComponent;
    if (!item) return;
    if (this.running) {
      this.showToast('Stop the simulation before rotating components.');
      return;
    }
    item.rotation = ((item.rotation ?? 0) + 90) % 360;
  }

  arrangeComponents(): void {
    if (this.running) {
      this.showToast('Stop the simulation before arranging components.');
      return;
    }
    if (!this.components.length) {
      this.showToast('Adicione componentes antes de organizar a bancada.');
      return;
    }

    const flowRotations = this.relayFlowRotations();
    const components = this.components.map((item) => ({
      ...item,
      rotation: flowRotations.get(item.id) ?? item.rotation,
    }));
    const groups: CircuitComponent[][] = Array.from({ length: 7 }, () => []);
    const top = 70;
    const availableHeight = 730;
    const minGap = 24;
    const height = (item: CircuitComponent): number => {
      const bounds = this.componentBounds(item);
      return bounds.bottom - bounds.top;
    };
    const fits = (group: CircuitComponent[], item: CircuitComponent): boolean =>
      group.reduce((sum, component) => sum + height(component), 0) + height(item) + minGap * group.length <= availableHeight;
    const originalOrder = (a: CircuitComponent, b: CircuitComponent): number =>
      a.y - b.y || a.x - b.x || a.id.localeCompare(b.id);
    const switches = components.filter((item) => this.isSwitchLike(item.type)).sort(originalOrder);
    const lamps = components.filter((item) => item.type === 'lamp').sort(originalOrder);
    const batteries = components.filter((item) => item.type === 'battery').sort(originalOrder);
    const middle = components.filter((item) => item.type !== 'switch' && item.type !== 'lamp' && item.type !== 'battery');
    let leftColumn = 0;
    let rightColumn = 6;

    for (const item of switches) {
      while (leftColumn < rightColumn && !fits(groups[leftColumn], item)) leftColumn++;
      if (!fits(groups[leftColumn], item)) {
        this.showToast('There is not enough space to arrange the circuit on this workbench.');
        return;
      }
      groups[leftColumn].push(item);
    }
    for (const item of lamps) {
      while (rightColumn > leftColumn && !fits(groups[rightColumn], item)) rightColumn--;
      if (rightColumn <= leftColumn || !fits(groups[rightColumn], item)) {
        this.showToast('There is not enough space to arrange the circuit on this workbench.');
        return;
      }
      groups[rightColumn].push(item);
    }

    for (const item of batteries) {
      if (fits(groups[0], item)) groups[0].push(item);
      else middle.push(item);
    }

    const neighbors = new Map(components.map((item) => [item.id, new Set<string>()]));
    const edges = this.wires.filter((wire) => !this.powerConnection(wire) &&
      wire.from.id !== wire.to.id && neighbors.has(wire.from.id) && neighbors.has(wire.to.id));
    for (const wire of edges) {
      neighbors.get(wire.from.id)?.add(wire.to.id);
      neighbors.get(wire.to.id)?.add(wire.from.id);
    }
    const distances = (sources: CircuitComponent[]): Map<string, number> => {
      const result = new Map(sources.map((item) => [item.id, 0]));
      const queue = [...result.keys()];
      for (let index = 0; index < queue.length; index++) {
        const id = queue[index];
        for (const next of neighbors.get(id) ?? []) {
          if (result.has(next)) continue;
          result.set(next, result.get(id)! + 1);
          queue.push(next);
        }
      }
      return result;
    };
    const fromInputs = distances(switches);
    const fromOutputs = distances(lamps);
    const firstMiddle = leftColumn + 1;
    const lastMiddle = rightColumn - 1;
    const preferredColumn = (item: CircuitComponent): number => {
      const fromInput = fromInputs.get(item.id);
      const fromOutput = fromOutputs.get(item.id);
      if (fromInput !== undefined && fromOutput !== undefined) {
        return Math.round(leftColumn + (rightColumn - leftColumn) * fromInput / (fromInput + fromOutput));
      }
      if (fromInput !== undefined) return leftColumn + fromInput;
      if (fromOutput !== undefined) return rightColumn - fromOutput;
      return Math.round((leftColumn + rightColumn) / 2);
    };
    middle.sort((a, b) => height(b) - height(a) || originalOrder(a, b));
    for (const item of middle) {
      const preferred = Math.max(firstMiddle, Math.min(lastMiddle, preferredColumn(item)));
      const columns = Array.from({ length: Math.max(0, lastMiddle - firstMiddle + 1) }, (_, index) => firstMiddle + index)
        .sort((a, b) => Math.abs(a - preferred) - Math.abs(b - preferred) || groups[a].length - groups[b].length || a - b);
      const column = columns.find((index) => fits(groups[index], item));
      if (column === undefined) {
        this.showToast('There is not enough space to arrange the circuit on this workbench.');
        return;
      }
      groups[column].push(item);
    }
    groups.forEach((group) => group.sort(originalOrder));

    const occupiedColumns = groups.map((group, index) => group.length ? index : -1).filter((index) => index >= 0);
    const horizontalGap = occupiedColumns.length > 1 ? Math.min(210, 1180 / (occupiedColumns.length - 1)) : 0;
    const positions = (): Map<string, Point> => {
      const result = new Map<string, Point>();
      groups.forEach((group, column) => {
        if (!group.length) return;
        const x = occupiedColumns.length === 1
          ? column === 0 ? 110 : column === 6 ? 1290 : 700
          : 110 + occupiedColumns.indexOf(column) * horizontalGap;
        const totalHeight = group.reduce((sum, item) => sum + height(item), 0);
        const gap = group.length > 1 ? Math.min(110, (availableHeight - totalHeight) / (group.length - 1)) : 0;
        let y = top + (availableHeight - totalHeight - gap * (group.length - 1)) / 2;
        for (const item of group) {
          result.set(item.id, { x, y: y + height(item) / 2 });
          y += height(item) + gap;
        }
      });
      return result;
    };
    const score = (): number => {
      const locations = positions();
      const placed = components.map((item) => {
        const point = locations.get(item.id)!;
        const width = item.type === 'relay_spdt' ? 176 : 136;
        const componentHeight = item.type === 'relay_spdt' ? 142 : 94;
        return { ...item, x: point.x - width / 2, y: point.y - componentHeight / 2 };
      });
      const placedById = new Map(placed.map((item) => [item.id, item]));
      const swapped = this.chooseCoilSwaps(placed);
      const endpoint = (wireEnd: WireEndpoint): { point: Point; direction: Point } => {
        const item = placedById.get(wireEnd.id)!;
        const pins = item.type !== 'relay_spdt' ? this.simplePins :
          swapped.has(item.id) ? this.swappedRelayPins : this.relayPins;
        const pin = pins.find((entry) => entry.side === wireEnd.side);
        return { point: this.positionForPin(item, pin), direction: this.directionForPin(item, pin) };
      };
      const segments = edges.map((wire) => {
        const from = endpoint(wire.from);
        const to = endpoint(wire.to);
        return { a: from.point, b: to.point, fromDirection: from.direction, toDirection: to.direction, wire };
      });
      const cross = (a: Point, b: Point, c: Point): number => (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
      let total = segments.reduce((sum, segment) => {
        const dx = segment.b.x - segment.a.x;
        const dy = segment.b.y - segment.a.y;
        return sum + Math.hypot(dx, dy) +
          Math.max(0, -dx * segment.fromDirection.x - dy * segment.fromDirection.y) +
          Math.max(0, dx * segment.toDirection.x + dy * segment.toDirection.y);
      }, 0);
      for (let i = 0; i < segments.length; i++) {
        const first = segments[i];
        for (let j = i + 1; j < segments.length; j++) {
          const second = segments[j];
          if (first.wire.from.id === second.wire.from.id || first.wire.from.id === second.wire.to.id ||
            first.wire.to.id === second.wire.from.id || first.wire.to.id === second.wire.to.id) continue;
          if (cross(first.a, first.b, second.a) * cross(first.a, first.b, second.b) < 0 &&
            cross(second.a, second.b, first.a) * cross(second.a, second.b, first.b) < 0) total += 700;
        }
      }
      return total;
    };

    let best = score();
    const groupFits = (group: CircuitComponent[]): boolean =>
      group.reduce((sum, component) => sum + height(component), 0) +
      minGap * (group.length - 1) <= availableHeight;
    for (let pass = 0; pass < 6; pass++) {
      let improved = false;
      for (const group of groups) {
        for (let index = 0; index < group.length - 1; index++) {
          [group[index], group[index + 1]] = [group[index + 1], group[index]];
          const candidate = score();
          if (candidate + 0.01 < best) {
            best = candidate;
            improved = true;
          } else {
            [group[index], group[index + 1]] = [group[index + 1], group[index]];
          }
        }
      }
      for (const group of groups) {
        for (const item of group) {
          if (!neighbors.get(item.id)?.size) continue;
          const original = item.rotation;
          let chosen = original;
          for (const rotation of flowRotations.has(item.id) ? [flowRotations.get(item.id)!] : [0, 90, 180, 270]) {
            item.rotation = rotation;
            if (!groupFits(group)) continue;
            const candidate = score();
            if (candidate + 0.01 < best) {
              best = candidate;
              chosen = rotation;
              improved = true;
            }
          }
          item.rotation = chosen;
        }
      }
      if (!improved) {
        const byId = new Map(components.map((item) => [item.id, item]));
        const groupById = new Map(groups.flatMap((group) => group.map((item) => [item.id, group] as const)));
        const seen = new Set<string>();
        for (const wire of edges) {
          const first = byId.get(wire.from.id)!;
          const second = byId.get(wire.to.id)!;
          const key = JSON.stringify([first.id, second.id].sort());
          if (seen.has(key)) continue;
          seen.add(key);
          const originalFirst = first.rotation;
          const originalSecond = second.rotation;
          let chosenFirst = originalFirst;
          let chosenSecond = originalSecond;
          for (const firstRotation of flowRotations.has(first.id) ? [flowRotations.get(first.id)!] : [0, 90, 180, 270]) {
            first.rotation = firstRotation;
            for (const secondRotation of flowRotations.has(second.id) ? [flowRotations.get(second.id)!] : [0, 90, 180, 270]) {
              second.rotation = secondRotation;
              if (!groupFits(groupById.get(first.id)!) || !groupFits(groupById.get(second.id)!)) continue;
              const candidate = score();
              if (candidate + 0.01 < best) {
                best = candidate;
                chosenFirst = firstRotation;
                chosenSecond = secondRotation;
                improved = true;
              }
            }
          }
          first.rotation = chosenFirst;
          second.rotation = chosenSecond;
        }
      }
      if (!improved) break;
    }

    const layout = positions();
    const rotations = new Map(components.map((item) => [item.id, item.rotation]));
    for (const item of this.components) {
      const point = layout.get(item.id)!;
      const width = item.type === 'relay_spdt' ? 176 : 136;
      const componentHeight = item.type === 'relay_spdt' ? 142 : 94;
      item.x = Math.round(point.x - width / 2);
      item.y = Math.round(point.y - componentHeight / 2);
      item.rotation = rotations.get(item.id);
    }
    this.showToast('Components arranged: inputs on the left and outputs on the right.');
  }

  private relayFlowRotations(): Map<string, number> {
    const components = new Map(this.components.map((item) => [item.id, item]));
    const adjacency = new Map<string, { node: string; relayId?: string }[]>();
    const node = (endpoint: WireEndpoint): string => `${endpoint.id}:${endpoint.side}`;
    const connect = (a: string, b: string, relayId?: string): void => {
      if (!adjacency.has(a)) adjacency.set(a, []);
      if (!adjacency.has(b)) adjacency.set(b, []);
      adjacency.get(a)!.push({ node: b, relayId });
      adjacency.get(b)!.push({ node: a, relayId });
    };
    for (const wire of this.wires) {
      const isNegative = (endpoint: WireEndpoint): boolean =>
        components.get(endpoint.id)?.type === 'battery' && endpoint.side === 'left';
      if (!components.has(wire.from.id) || !components.has(wire.to.id) ||
        isNegative(wire.from) || isNegative(wire.to)) continue;
      connect(node(wire.from), node(wire.to));
    }
    for (const item of this.components) {
      if (item.type === 'relay_spdt') {
        connect(`${item.id}:COM`, `${item.id}:NC`, item.id);
        connect(`${item.id}:COM`, `${item.id}:NO`, item.id);
      } 
    }
    const sources = this.components.flatMap((item) => item.type === 'battery' ? [`${item.id}:right`] :
      this.isSwitchLike(item.type) ? [`${item.id}:left`, `${item.id}:right`] : []);
    const sinks = this.components.filter((item) => item.type === 'lamp')
      .flatMap((item) => [`${item.id}:left`, `${item.id}:right`]);
    const distances = (starts: string[], excludedRelay: string): Map<string, number> => {
      const result = new Map(starts.map((start) => [start, 0]));
      const queue = [...result.keys()];
      for (let index = 0; index < queue.length; index++) {
        const current = queue[index];
        for (const edge of adjacency.get(current) ?? []) {
          if (edge.relayId === excludedRelay || result.has(edge.node)) continue;
          result.set(edge.node, result.get(current)! + 1);
          queue.push(edge.node);
        }
      }
      return result;
    };
    const rotations = new Map<string, number>();
    for (const item of this.components) {
      if (item.type !== 'relay_spdt') continue;
      const inputs = distances(sources, item.id);
      const outputs = distances(sinks, item.id);
      const compare = (values: Map<string, number>): number => {
        const common = values.get(`${item.id}:COM`) ?? Infinity;
        const branches = Math.min(values.get(`${item.id}:NC`) ?? Infinity, values.get(`${item.id}:NO`) ?? Infinity);
        return common < branches ? 1 : common > branches ? -1 : 0;
      };
      const inputVote = compare(inputs);
      const outputVote = -compare(outputs);
      if (inputVote + outputVote > 0) rotations.set(item.id, 0);
      else if (inputVote + outputVote < 0) rotations.set(item.id, 180);
    }
    return rotations;
  }

 
 
  fetchExample(file: string): Promise<void> {
    const examples: Record<string, unknown> = {
      'full-adder.json': fullAdderExample,
      'logic-gates.json': logicGatesExample,
      'alu-74181.json': alu74181Example,
      'latch-memory.json': latchMemoryExample,
      'counter.json': counterExample,
    };
    return Promise.resolve(examples[file]).then((value) => {
        if (value === undefined) throw new Error(`Unknown example: ${file}`);
        if (!this.applyProject(value)) {
          this.showToast(`The ${file} example is not valid.`);
          return;
        }
        this.showToast(`Exemplo ${file} carregado.`);
      })
      .catch(() => {
        this.showToast(`The ${file} example could not be loaded.`);
      });
  }

  showHelp(): void {
    this.showToast('Add components, connect terminals, press R to rotate, and Simulate to test.');
  }

  changeZoom(amount: number): void {
    this.zoom = Math.max(70, Math.min(140, this.zoom + amount));
  }

  fitToView(): void {
    const wrap = this.canvasWrapRef?.nativeElement;
    if (!wrap || !this.components.length) {
      this.zoom = 100;
      wrap?.scrollTo({ left: 0, top: 0, behavior: 'smooth' });
      return;
    }
    const bounds = this.components.map((item) => this.componentBounds(item));
    const maxX = Math.max(...bounds.map((box) => box.right));
    const maxY = Math.max(...bounds.map((box) => box.bottom));
    const fit = Math.floor(Math.min(wrap.clientWidth / maxX, wrap.clientHeight / maxY) * 100);
    this.zoom = Math.max(70, Math.min(115, fit));
    wrap.scrollTo({ left: 0, top: 0, behavior: 'smooth' });
  }

  private calculateSimulation(): void {
    this.wires.forEach((wire) => { wire.energized = false; });
    if (!this.running) {
      this.clearRelayTransitions();
      this.components.forEach((item) => { item.energized = false; });
      return;
    }

    const battery = this.components.find((item) => item.type === 'battery');
    if (!battery) {
      const relays = this.components.filter((item) => item.type === 'relay' || item.type === 'relay_spdt');
      const relayIds = new Set(relays.map((item) => item.id));
      for (const id of this.relayTransitions.keys()) {
        if (!relayIds.has(id)) this.cancelRelayTransition(id);
      }
      for (const item of this.components) {
        if (item.type !== 'relay' && item.type !== 'relay_spdt') item.energized = false;
        else if (!item.energized) this.cancelRelayTransition(item.id);
        else if (this.relayTransitions.get(item.id)?.target !== false) this.scheduleRelayTransition(item.id, false);
      }
      return;
    }
    const positive = `${battery.id}:right`;
    const negative = `${battery.id}:left`;
    const conductingTypes = new Set<ComponentType>(['fuse']);

    const reachable = (start: string, finish: string, edges: CircuitEdge[]): boolean => {
      const adjacency = new Map<string, string[]>();
      edges.forEach((edge) => {
        adjacency.set(edge.a, [...(adjacency.get(edge.a) ?? []), edge.b]);
        adjacency.set(edge.b, [...(adjacency.get(edge.b) ?? []), edge.a]);
      });
      const visited = new Set([start]);
      const queue = [start];
      for (let head = 0; head < queue.length; head++) {
        const current = queue[head];
        if (current === finish) return true;
        (adjacency.get(current) ?? []).forEach((next) => {
          if (!visited.has(next)) {
            visited.add(next);
            queue.push(next);
          }
        });
      }
      return false;
    };

    const isLoadEnergized = (a: string, b: string, edges: CircuitEdge[]): boolean => {
      return (reachable(positive, a, edges) && reachable(negative, b, edges)) ||
        (reachable(positive, b, edges) && reachable(negative, a, edges));
    };

    const buildEdges = (): CircuitEdge[] => {
      const edges: CircuitEdge[] = this.wires.map((wire) => ({
        a: `${wire.from.id}:${wire.from.side}`,
        b: `${wire.to.id}:${wire.to.side}`,
        wire,
      }));
      this.components.forEach((item) => {
        if (item.type === 'battery') return;
        if (item.type === 'relay_spdt') {
          edges.push({ a: `${item.id}:COM`, b: `${item.id}:${item.energized ? 'NO' : 'NC'}` });
          return;
        }
        if (item.type === 'relay' || item.type === 'lamp') return;
        const closed = item.type === 'switch' || item.type === 'push_button_no' || item.type === 'clock' ? item.on
          : item.type === 'push_button_nc' ? !item.on
          : item.type === 'contact' ? this.components.some((relay) =>
            (relay.type === 'relay' || relay.type === 'relay_spdt') && relay.energized)
          : conductingTypes.has(item.type);
        if (closed) {
          edges.push({
            a: `${item.id}:left`,
            b: `${item.id}:right`,
          });
        }
      });
      return edges;
    };

    const edges = buildEdges();
    const relays = this.components.filter((item) => item.type === 'relay' || item.type === 'relay_spdt');
    const relayIds = new Set(relays.map((item) => item.id));
    for (const id of this.relayTransitions.keys()) {
      if (!relayIds.has(id)) this.cancelRelayTransition(id);
    }
    for (const item of relays) {
      const a = item.type === 'relay_spdt' ? `${item.id}:A1` : `${item.id}:left`;
      const b = item.type === 'relay_spdt' ? `${item.id}:A2` : `${item.id}:right`;
      const target = isLoadEnergized(a, b, edges);
      if (target === item.energized) this.cancelRelayTransition(item.id);
      else if (this.relayTransitions.get(item.id)?.target !== target) this.scheduleRelayTransition(item.id, target);
    }
    edges.forEach((edge) => {
      if (edge.wire) {
        edge.wire.energized = [edge.a, edge.b].some((node) =>
          reachable(positive, node, edges) || reachable(negative, node, edges),
        );
      }
    });
    this.components
      .filter((item) => item.type === 'lamp')
      .forEach((item) => {
        item.energized = isLoadEnergized(`${item.id}:left`, `${item.id}:right`, edges);
      });
  }

  private scheduleRelayTransition(id: string, target: boolean, progress = 0): void {
    this.cancelRelayTransition(id);
    const duration = (target ? RELAY_ACTUATION_MS : RELAY_RELEASE_MS) * this.relayDelayMultiplier;
    const now = performance.now();
    const startedAt = now - progress * duration;
    const deadline = now + (1 - progress) * duration;
    const transition: RelayTransition = {
      target, startedAt, duration, deadline,
      timer: setTimeout(() => {
        if (this.relayTransitions.get(id) !== transition) return;
        for (const [pendingId, pending] of this.relayTransitions) {
          if (pending.deadline > deadline) continue;
          this.cancelRelayTransition(pendingId);
          const item = this.components.find((component) => component.id === pendingId);
          if (item) {
            item.energized = pending.target;
            this.playRelaySound(pending.target);
          }
        }
        this.calculateSimulation();
        this.changeDetector.markForCheck();
      }, Math.max(0, deadline - now)),
    };
    this.relayTransitions.set(id, transition);
  }

  private cancelRelayTransition(id: string): void {
    const transition = this.relayTransitions.get(id);
    if (!transition) return;
    clearTimeout(transition.timer);
    this.relayTransitions.delete(id);
  }

  private clearRelayTransitions(): void {
    for (const id of this.relayTransitions.keys()) this.cancelRelayTransition(id);
  }

  private playRelaySound(open: boolean): void {
    const audio = open ? this.relayOpenAudio : this.relayCloseAudio;
    audio.currentTime = 0;
    const playback = audio.play();
    if (playback) void playback.catch(() => undefined);
  }

  private coilSwaps(): Set<string> {
    const layout = JSON.stringify([
      this.components.map((item) => [item.id, item.type, item.x, item.y, item.rotation]),
      this.wires.map((wire) => [wire.id, wire.from.id, wire.from.side, wire.to.id, wire.to.side]),
    ]);
    if (layout === this.coilLayout) return this.swappedCoils;

    const swapped = this.chooseCoilSwaps(this.components);
    this.coilLayout = layout;
    this.swappedCoils = swapped;
    return swapped;
  }

  private chooseCoilSwaps(items: CircuitComponent[]): Set<string> {
    const swapped = new Set<string>();
    const components = new Map(items.map((item) => [item.id, item]));
    const relays = items.filter((item) => item.type === 'relay_spdt');
    const isCoil = (endpoint: WireEndpoint): boolean =>
      components.get(endpoint.id)?.type === 'relay_spdt' && (endpoint.side === 'A1' || endpoint.side === 'A2');
    const wires = this.wires.filter((wire) => !this.powerConnection(wire) && (isCoil(wire.from) || isCoil(wire.to)));
    const pinFor = (item: CircuitComponent, side: TerminalSide): TerminalPin | undefined => {
      const pins = item.type !== 'relay_spdt'
        ? this.simplePins
        : swapped.has(item.id) ? this.swappedRelayPins : this.relayPins;
      return pins.find((pin) => pin.side === side);
    };
    const cost = (wire: CircuitWire): number => {
      const from = components.get(wire.from.id);
      const to = components.get(wire.to.id);
      if (!from || !to) return 0;
      const fromPin = pinFor(from, wire.from.side);
      const toPin = pinFor(to, wire.to.side);
      if (!fromPin || !toPin) return 0;
      const start = this.positionForPin(from, fromPin);
      const end = this.positionForPin(to, toPin);
      const dx = end.x - start.x;
      const dy = end.y - start.y;
      let penalty = 0;
      if (isCoil(wire.from)) {
        const direction = this.directionForPin(from, fromPin);
        penalty += Math.max(0, -dx * direction.x - dy * direction.y);
      }
      if (isCoil(wire.to)) {
        const direction = this.directionForPin(to, toPin);
        penalty += Math.max(0, dx * direction.x + dy * direction.y);
      }
      return Math.hypot(dx, dy) + penalty;
    };

    for (let pass = 0; pass <= relays.length * 2; pass++) {
      let changed = false;
      for (const relay of relays) {
        const incident = wires.filter((wire) => wire.from.id === relay.id || wire.to.id === relay.id);
        if (!incident.length) continue;
        const before = incident.reduce((sum, wire) => sum + cost(wire), 0);
        if (swapped.has(relay.id)) swapped.delete(relay.id);
        else swapped.add(relay.id);
        const after = incident.reduce((sum, wire) => sum + cost(wire), 0);
        if (after + 0.01 < before) changed = true;
        else if (swapped.has(relay.id)) swapped.delete(relay.id);
        else swapped.add(relay.id);
      }
      if (!changed) break;
    }

    return swapped;
  }

  private pinPosition(item: CircuitComponent, side: TerminalSide): Point {
    return this.positionForPin(item, this.getPins(item).find((entry) => entry.side === side));
  }

  private positionForPin(item: CircuitComponent, pin: TerminalPin | undefined): Point {
    const size = item.type === 'relay_spdt' ? { width: 176, height: 142 } : { width: 136, height: 94 };
    const localX = size.width / 2 + ((pin?.x ?? 0) - size.width / 2) * COMPONENT_SCALE;
    const localY = size.height / 2 + ((pin?.y ?? 0) - size.height / 2) * COMPONENT_SCALE;
    const rotation = ((item.rotation ?? 0) % 360 + 360) % 360;
    if (rotation === 90) {
      return {
        x: item.x + size.width / 2 - (localY - size.height / 2),
        y: item.y + size.height / 2 + (localX - size.width / 2),
      };
    }
    if (rotation === 180) {
      return { x: item.x + size.width - localX, y: item.y + size.height - localY };
    }
    if (rotation === 270) {
      return {
        x: item.x + size.width / 2 + (localY - size.height / 2),
        y: item.y + size.height / 2 - (localX - size.width / 2),
      };
    }
    return { x: item.x + localX, y: item.y + localY };
  }

  private pinDirection(item: CircuitComponent, side: TerminalSide): Point {
    return this.directionForPin(item, this.getPins(item).find((pin) => pin.side === side));
  }

  private directionForPin(item: CircuitComponent, pin: TerminalPin | undefined): Point {
    const pointsRight = pin !== undefined && pin.x > 0;
    const direction = { x: pointsRight ? 1 : -1, y: 0 };
    const rotation = ((item.rotation ?? 0) % 360 + 360) % 360;
    if (rotation === 90) return { x: -direction.y, y: direction.x };
    if (rotation === 180) return { x: -direction.x, y: -direction.y };
    if (rotation === 270) return { x: direction.y, y: -direction.x };
    return direction;
  }

  private directCurve(
    start: Point,
    end: Point,
    fromDirection: Point,
    toDirection: Point,
    fromId: string,
    toId: string,
    occupied: WireRoute[],
  ): { path: string; points: Point[] } | null {
    const distance = Math.hypot(end.x - start.x, end.y - start.y);
    const handle = Math.max(4, Math.min(180, distance * 0.42));
    const control1 = { x: start.x + fromDirection.x * handle, y: start.y + fromDirection.y * handle };
    const control2 = { x: end.x + toDirection.x * handle, y: end.y + toDirection.y * handle };
    const obstacles = this.components.map((item) => {
      const box = this.componentBounds(item);
      const margin = item.id === fromId || item.id === toId ? -0.01 : 4;
      return { left: box.left - margin, right: box.right + margin, top: box.top - margin, bottom: box.bottom + margin };
    });
    const segments = occupied.flatMap((route) => route.points.slice(1).map((point, index) =>
      ({ a: route.points[index], b: point })));
    const intersects = (a: Point, b: Point, box: Bounds): boolean => {
      let minimum = 0;
      let maximum = 1;
      for (const [origin, delta, low, high] of [
        [a.x, b.x - a.x, box.left, box.right],
        [a.y, b.y - a.y, box.top, box.bottom],
      ]) {
        if (delta === 0) {
          if (origin < low || origin > high) return false;
        } else {
          const first = (low - origin) / delta;
          const second = (high - origin) / delta;
          minimum = Math.max(minimum, Math.min(first, second));
          maximum = Math.min(maximum, Math.max(first, second));
          if (minimum > maximum) return false;
        }
      }
      return true;
    };
    const closeToSegment = (point: Point, a: Point, b: Point): boolean => {
      if (point.x < Math.min(a.x, b.x) - 3 || point.x > Math.max(a.x, b.x) + 3 ||
        point.y < Math.min(a.y, b.y) - 3 || point.y > Math.max(a.y, b.y) + 3) return false;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const lengthSquared = dx * dx + dy * dy;
      const t = lengthSquared ? Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / lengthSquared)) : 0;
      return (point.x - a.x - t * dx) ** 2 + (point.y - a.y - t * dy) ** 2 < 9;
    };
    const steps = Math.max(12, Math.ceil((distance + 2 * handle) / 6));
    const points = [start];
    let previous = start;
    let overlap = 0;
    for (let step = 1; step <= steps; step++) {
      const t = step / steps;
      const inverse = 1 - t;
      const point = {
        x: inverse ** 3 * start.x + 3 * inverse ** 2 * t * control1.x +
          3 * inverse * t ** 2 * control2.x + t ** 3 * end.x,
        y: inverse ** 3 * start.y + 3 * inverse ** 2 * t * control1.y +
          3 * inverse * t ** 2 * control2.y + t ** 3 * end.y,
      };
      if (point.x < 0 || point.x > 1400 || point.y < 0 || point.y > 850 ||
        obstacles.some((box) => intersects(previous, point, box))) return null;
      overlap = segments.some((segment) => closeToSegment(point, segment.a, segment.b))
        ? overlap + Math.hypot(point.x - previous.x, point.y - previous.y)
        : 0;
      if (overlap > 15) return null;
      if (step === steps || step % Math.ceil(steps / 12) === 0) points.push(point);
      previous = point;
    }
    return {
      path: `M ${start.x} ${start.y} C ${control1.x} ${control1.y}, ${control2.x} ${control2.y}, ${end.x} ${end.y}`,
      points: start.x === end.x && start.x === control1.x && start.x === control2.x ||
        start.y === end.y && start.y === control1.y && start.y === control2.y
        ? [start, end] : points,
    };
  }

  private curvedDetour(
    points: Point[],
    fromDirection: Point,
    toDirection: Point,
    fromId: string,
    toId: string,
    occupied: WireRoute[],
  ): { path: string; points: Point[] } {
    const route = this.simplifyPath(points);
    const result = [route[0]];
    let path = `M ${route[0].x} ${route[0].y}`;
    let index = 0;
    const direction = (a: Point, b: Point): Point => {
      const length = Math.hypot(b.x - a.x, b.y - a.y);
      return { x: (b.x - a.x) / length, y: (b.y - a.y) / length };
    };

    while (index < route.length - 1) {
      const outgoing = index === 0 ? fromDirection : direction(route[index], route[index + 1]);
      let advanced = false;
      for (let target = route.length - 1; target > index; target--) {
        const next = target === route.length - 1 ? toDirection : direction(route[target + 1], route[target]);
        const curve = this.directCurve(route[index], route[target], outgoing, next, fromId, toId, occupied);
        if (!curve) continue;
        path += curve.path.slice(curve.path.indexOf(' C '));
        result.push(...curve.points.slice(1));
        index = target;
        advanced = true;
        break;
      }
      if (!advanced) {
        const remainder = route.slice(index);
        const fallback = this.bezierPath(remainder);
        path += fallback.slice(fallback.indexOf(' L '));
        result.push(...remainder.slice(1));
        break;
      }
    }
    return { path, points: result };
  }

  private routeAroundComponents(
    start: Point,
    end: Point,
    fromDirection: Point,
    toDirection: Point,
    fromId: string,
    toId: string,
    occupied: WireRoute[],
  ): Point[] | null {
    const clearance = 10;
    const obstacles = this.components.map((item) => {
      const bounds = this.componentBounds(item);
      return {
        id: item.id,
        left: bounds.left - clearance, right: bounds.right + clearance,
        top: bounds.top - clearance, bottom: bounds.bottom + clearance,
      };
    });
    const from = { x: start.x + fromDirection.x * clearance, y: start.y + fromDirection.y * clearance };
    const to = { x: end.x + toDirection.x * clearance, y: end.y + toDirection.y * clearance };
    const crosses = (a: Point, b: Point, box: Bounds): boolean => a.x === b.x
      ? a.x > box.left && a.x < box.right && Math.max(a.y, b.y) > box.top && Math.min(a.y, b.y) < box.bottom
      : a.y > box.top && a.y < box.bottom && Math.max(a.x, b.x) > box.left && Math.min(a.x, b.x) < box.right;

    if (obstacles.some((box) => (box.id !== fromId && crosses(start, from, box)) ||
      (box.id !== toId && crosses(end, to, box)))) return null;

    const xs = [...new Set([0, 1400, from.x, to.x, (from.x + to.x) / 2,
      ...obstacles.flatMap((box) => [box.left - 12, box.left, box.right, box.right + 12])])]
      .filter((x) => x >= 0 && x <= 1400 || x === from.x || x === to.x).sort((a, b) => a - b);
    const ys = [...new Set([0, 850, from.y, to.y, (from.y + to.y) / 2,
      ...obstacles.flatMap((box) => [box.top - 12, box.top, box.bottom, box.bottom + 12])])]
      .filter((y) => y >= 0 && y <= 850 || y === from.y || y === to.y).sort((a, b) => a - b);
    const segments = occupied.flatMap((route) => route.points.slice(1).map((point, index) =>
      ({ a: route.points[index], b: point }))).filter(({ a, b }) => a.x === b.x || a.y === b.y);
    const congestion = (a: Point, b: Point): number => {
      let penalty = 0;
      for (const segment of segments) {
        const c = segment.a;
        const d = segment.b;
        if (a.y === b.y && c.y === d.y && a.y === c.y) {
          penalty += Math.max(0, Math.min(Math.max(a.x, b.x), Math.max(c.x, d.x)) -
            Math.max(Math.min(a.x, b.x), Math.min(c.x, d.x))) * 2;
        } else if (a.x === b.x && c.x === d.x && a.x === c.x) {
          penalty += Math.max(0, Math.min(Math.max(a.y, b.y), Math.max(c.y, d.y)) -
            Math.max(Math.min(a.y, b.y), Math.min(c.y, d.y))) * 2;
        } else if (a.y === b.y && c.x === d.x && c.x > Math.min(a.x, b.x) && c.x < Math.max(a.x, b.x) &&
          a.y > Math.min(c.y, d.y) && a.y < Math.max(c.y, d.y) ||
          a.x === b.x && c.y === d.y && c.y > Math.min(a.y, b.y) && c.y < Math.max(a.y, b.y) &&
          a.x > Math.min(c.x, d.x) && a.x < Math.max(c.x, d.x)) {
          penalty += 15;
        }
      }
      return penalty;
    };
    const directions = [{ x: 1, y: 0 }, { x: 0, y: 1 }, { x: -1, y: 0 }, { x: 0, y: -1 }];
    const directionIndex = (direction: Point): number =>
      directions.findIndex((entry) => entry.x === direction.x && entry.y === direction.y);
    const stateId = (x: number, y: number, direction: number): number => ((y * xs.length + x) * 4) + direction;
    const startX = xs.indexOf(from.x);
    const startY = ys.indexOf(from.y);
    const endX = xs.indexOf(to.x);
    const endY = ys.indexOf(to.y);
    const initial = stateId(startX, startY, directionIndex(fromDirection));
    const costs = new Map<number, number>([[initial, 0]]);
    const previous = new Map<number, number>();
    const queue: Array<{ id: number; score: number; cost: number }> = [];
    const push = (entry: { id: number; score: number; cost: number }): void => {
      queue.push(entry);
      let index = queue.length - 1;
      while (index > 0) {
        const parent = Math.floor((index - 1) / 2);
        if (queue[parent].score <= entry.score) break;
        queue[index] = queue[parent];
        index = parent;
      }
      queue[index] = entry;
    };
    const pop = (): { id: number; score: number; cost: number } | undefined => {
      const first = queue[0];
      const last = queue.pop();
      if (!last || !queue.length) return first;
      let index = 0;
      while (index * 2 + 1 < queue.length) {
        let child = index * 2 + 1;
        if (child + 1 < queue.length && queue[child + 1].score < queue[child].score) child++;
        if (queue[child].score >= last.score) break;
        queue[index] = queue[child];
        index = child;
      }
      queue[index] = last;
      return first;
    };
    const heuristic = (x: number, y: number): number => Math.abs(xs[x] - to.x) + Math.abs(ys[y] - to.y);
    push({ id: initial, score: heuristic(startX, startY), cost: 0 });
    let finish: number | undefined;

    while (queue.length) {
      const current = pop()!;
      if (current.cost !== costs.get(current.id)) continue;
      const direction = current.id % 4;
      const node = Math.floor(current.id / 4);
      const x = node % xs.length;
      const y = Math.floor(node / xs.length);
      if (x === endX && y === endY && direction !== directionIndex(toDirection)) {
        finish = current.id;
        break;
      }
      for (let nextDirection = 0; nextDirection < directions.length; nextDirection++) {
        if ((direction + 2) % 4 === nextDirection) continue;
        const step = directions[nextDirection];
        const nx = x + step.x;
        const ny = y + step.y;
        if (nx < 0 || nx >= xs.length || ny < 0 || ny >= ys.length) continue;
        const a = { x: xs[x], y: ys[y] };
        const b = { x: xs[nx], y: ys[ny] };
        if (obstacles.some((box) => crosses(a, b, box))) continue;
        const cost = current.cost + Math.abs(b.x - a.x) + Math.abs(b.y - a.y) +
          (direction === nextDirection ? 0 : 20) + congestion(a, b);
        const id = stateId(nx, ny, nextDirection);
        if (cost >= (costs.get(id) ?? Infinity)) continue;
        costs.set(id, cost);
        previous.set(id, current.id);
        push({ id, cost, score: cost + heuristic(nx, ny) });
      }
    }

    if (finish === undefined) return null;
    const points: Point[] = [];
    for (let id: number | undefined = finish; id !== undefined; id = previous.get(id)) {
      const node = Math.floor(id / 4);
      points.push({ x: xs[node % xs.length], y: ys[Math.floor(node / xs.length)] });
    }
    return [start, ...points.reverse(), end];
  }

  private componentBounds(item: CircuitComponent): { left: number; right: number; top: number; bottom: number } {
    const width = item.type === 'relay_spdt' ? 176 : 136;
    const height = item.type === 'relay_spdt' ? 142 : 94;
    const rotated = item.rotation !== undefined && item.rotation % 180 !== 0;
    const visualWidth = (rotated ? height : width) * COMPONENT_SCALE;
    const visualHeight = (rotated ? width : height) * COMPONENT_SCALE;
    const centerX = item.x + width / 2;
    const centerY = item.y + height / 2;
    return {
      left: centerX - visualWidth / 2,
      right: centerX + visualWidth / 2,
      top: centerY - visualHeight / 2,
      bottom: centerY + visualHeight / 2,
    };
  }

  private simplifyPath(points: Point[]): Point[] {
    const distinct = points.filter((point, index) =>
      index === 0 || point.x !== points[index - 1].x || point.y !== points[index - 1].y,
    );
    return distinct.filter((point, index) => {
      if (index === 0 || index === distinct.length - 1) return true;
      const previous = distinct[index - 1];
      const next = distinct[index + 1];
      return !((previous.x === point.x && point.x === next.x) || (previous.y === point.y && point.y === next.y));
    });
  }

  private bezierPath(points: Point[]): string {
    const simplified = this.simplifyPath(points);
    if (simplified.length < 2) return `M ${simplified[0]?.x ?? 0} ${simplified[0]?.y ?? 0}`;
    let path = `M ${simplified[0].x} ${simplified[0].y}`;

    for (let index = 1; index < simplified.length - 1; index++) {
      const previous = simplified[index - 1];
      const current = simplified[index];
      const next = simplified[index + 1];
      const incomingLength = Math.hypot(current.x - previous.x, current.y - previous.y);
      const outgoingLength = Math.hypot(next.x - current.x, next.y - current.y);
      const radius = Math.min(28, incomingLength / 2, outgoingLength / 2);
      const incoming = { x: (current.x - previous.x) / incomingLength, y: (current.y - previous.y) / incomingLength };
      const outgoing = { x: (next.x - current.x) / outgoingLength, y: (next.y - current.y) / outgoingLength };
      const before = { x: current.x - incoming.x * radius, y: current.y - incoming.y * radius };
      const after = { x: current.x + outgoing.x * radius, y: current.y + outgoing.y * radius };
      const handle = radius * 4 * (Math.SQRT2 - 1) / 3;
      const control1 = { x: before.x + incoming.x * handle, y: before.y + incoming.y * handle };
      const control2 = { x: after.x - outgoing.x * handle, y: after.y - outgoing.y * handle };
      path += ` L ${before.x} ${before.y} C ${control1.x} ${control1.y}, ${control2.x} ${control2.y}, ${after.x} ${after.y}`;
    }

    const last = simplified[simplified.length - 1];
    return `${path} L ${last.x} ${last.y}`;
  }

  getComponent(id: string): CircuitComponent | undefined {
    return this.components.find((item) => item.id === id);
  }

  private createComponent(type: ComponentType, x: number, y: number, label: string): CircuitComponent {
    return { id: this.makeId('c'), type, x, y, label, on: false, energized: false, rotation: 0 };
  }

  private makeId(prefix: 'c' | 'w'): string {
    return `${prefix}-${this.idCounter++}`;
  }

  private showToast(message: string): void {
    this.toastMessage = message;
    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => { this.toastMessage = ''; }, 2300);
  }

  private loadProject(): boolean {
    try {
      const raw = localStorage.getItem('rele-lab-project');
      if (!raw) return false;
      const value: unknown = JSON.parse(raw);
      return this.applyProject(value);
    } catch {
      this.showToast('The saved project could not be read.');
      return false;
    }
  }

  private applyProject(value: unknown): boolean {
    if (!this.isRecord(value) || value['version'] !== 1 ||
        !Array.isArray(value['components']) || !Array.isArray(value['wires'])) return false;
    const loadedComponents = value['components'].filter((item): item is CircuitComponent =>
      this.isRecord(item) && this.isComponentType(item['type']) &&
      typeof item['id'] === 'string' && typeof item['x'] === 'number' &&
      typeof item['y'] === 'number' && typeof item['label'] === 'string',
    ).map((item) => ({
      ...item,
      on: item.on === true,
      energized: false,
      rotation: typeof item.rotation === 'number' ? ((item.rotation % 360) + 360) % 360 : 0,
      intervalMs: item.type === 'clock' && typeof item.intervalMs === 'number'
        ? Math.max(100, Math.min(5000, Math.round(item.intervalMs)))
        : item.type === 'clock' ? 1000 : undefined,
      pinLabels: this.readPinLabels(item['pinLabels']),
    }));
    const ids = new Set(loadedComponents.map((item) => item.id));
    const loadedWires = value['wires'].filter((wire): wire is CircuitWire =>
      this.isRecord(wire) && typeof wire['id'] === 'string' &&
      this.isRecord(wire['from']) && this.isRecord(wire['to']) &&
      typeof wire['from']['id'] === 'string' && ids.has(wire['from']['id']) &&
      typeof wire['to']['id'] === 'string' && ids.has(wire['to']['id']) &&
      this.isTerminalSide(wire['from']['side']) && this.isTerminalSide(wire['to']['side']),
    ).map((wire) => ({
      id: wire.id,
      from: wire.from,
      to: wire.to,
      energized: false,
    }));

    this.stopClockTimers();
    this.clearRelayTransitions();
    this.running = false;
    this.components = loadedComponents;
    this.wires = loadedWires;
    this.selected = null;
    this.connectingFrom = null;
    if (typeof value['name'] === 'string') this.projectName = value['name'];
    if (this.isRelayDelayMultiplier(value['relayDelayMultiplier'])) {
      this.relayDelayMultiplier = value['relayDelayMultiplier'];
    }
    const idsFromProject = [...this.components.map((item) => item.id), ...this.wires.map((wire) => wire.id)]
      .map((id) => Number(id.split('-').pop()))
      .filter(Number.isFinite);
    if (idsFromProject.length) this.idCounter = Math.max(this.idCounter, ...idsFromProject.map((id) => id + 1));
    return true;
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
  }

  private readPinLabels(value: unknown): Partial<Record<TerminalSide, string>> | undefined {
    if (!this.isRecord(value)) return undefined;
    const labels: Partial<Record<TerminalSide, string>> = {};
    for (const side of ['COM', 'NC', 'NO', 'A1', 'A2'] as const) {
      if (typeof value[side] === 'string') labels[side] = value[side].slice(0, 32);
    }
    return Object.keys(labels).length ? labels : undefined;
  }

  private isRelayDelayMultiplier(value: unknown): value is RelayDelayMultiplier {
    return value === 1 || value === 10 || value === 100 || value === 1000;
  }

  private isComponentType(value: unknown): value is ComponentType {
    return this.componentOrder.some((type) => type === value);
  }

  private isPushButton(type: ComponentType): boolean {
    return type === 'push_button_no' || type === 'push_button_nc';
  }

  private isSwitchLike(type: ComponentType): boolean {
    return type === 'switch' || this.isPushButton(type) || type === 'clock';
  }

  private startClockTimers(): void {
    this.components.filter((item) => item.type === 'clock').forEach((item) => this.startClockTimer(item));
  }

  private startClockTimer(item: CircuitComponent): void {
    if (item.type !== 'clock' || this.clockTimers.has(item.id)) return;
    const intervalMs = item.intervalMs ?? 1000;
    let nextToggleAt = performance.now() + intervalMs;
    const scheduleToggle = (): void => {
      if (!this.running || !this.components.includes(item)) {
        this.stopClockTimer(item.id);
        return;
      }
      item.on = !item.on;
      this.calculateSimulation();
      this.changeDetector.detectChanges();
      const now = performance.now();
      nextToggleAt += intervalMs;
      if (nextToggleAt <= now) nextToggleAt = now + intervalMs;
      const timer = setTimeout(scheduleToggle, Math.max(0, nextToggleAt - now));
      this.clockTimers.set(item.id, timer);
    };
    const timer = setTimeout(scheduleToggle, intervalMs);
    this.clockTimers.set(item.id, timer);
  }

  private stopClockTimer(id: string): void {
    const timer = this.clockTimers.get(id);
    if (!timer) return;
    clearTimeout(timer);
    this.clockTimers.delete(id);
  }

  private stopClockTimers(): void {
    for (const id of this.clockTimers.keys()) this.stopClockTimer(id);
    this.components.filter((item) => item.type === 'clock').forEach((item) => { item.on = false; });
  }

  private isTerminalSide(value: unknown): value is TerminalSide {
    return ['left', 'right', 'COM', 'NC', 'NO', 'A1', 'A2'].some((side) => side === value);
  }
}

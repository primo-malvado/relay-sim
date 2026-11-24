import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { App } from './app';

describe('App', () => {
  beforeEach(async () => {
    localStorage.removeItem('rele-lab-project');
    await TestBed.configureTestingModule({ imports: [App] }).compileComponents();
  });

  afterEach(() => vi.useRealTimers());

  const timedRelayCircuit = () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    app.components = [
      { id: 'b', type: 'battery', x: 0, y: 0, label: 'B', on: false, energized: false },
      { id: 's', type: 'switch', x: 0, y: 0, label: 'S', on: false, energized: false },
      { id: 'r', type: 'relay_spdt', x: 0, y: 0, label: 'R', on: false, energized: false },
      { id: 'l', type: 'lamp', x: 0, y: 0, label: 'L', on: false, energized: false },
    ];
    app.wires = [
      { id: 'w1', from: { id: 'b', side: 'right' }, to: { id: 's', side: 'left' }, energized: false },
      { id: 'w2', from: { id: 's', side: 'right' }, to: { id: 'r', side: 'A1' }, energized: false },
      { id: 'w3', from: { id: 'r', side: 'A2' }, to: { id: 'b', side: 'left' }, energized: false },
      { id: 'w4', from: { id: 'b', side: 'right' }, to: { id: 'r', side: 'COM' }, energized: false },
      { id: 'w5', from: { id: 'r', side: 'NO' }, to: { id: 'l', side: 'left' }, energized: false },
      { id: 'w6', from: { id: 'l', side: 'right' }, to: { id: 'b', side: 'left' }, energized: false },
    ];
    return { fixture, app, switchItem: app.components[1], relay: app.components[2], lamp: app.components[3] };
  };

  it('delays SPDT contact and lamp transitions and cancels short coil pulses', () => {
    vi.useFakeTimers();
    const { app, switchItem, relay, lamp } = timedRelayCircuit();
    app.runSimulation();
    app.toggleSwitch(switchItem);
    vi.advanceTimersByTime(19);
    expect([relay.energized, lamp.energized]).toEqual([false, false]);
    app.toggleSwitch(switchItem);
    vi.advanceTimersByTime(30);
    expect([relay.energized, lamp.energized]).toEqual([false, false]);

    app.toggleSwitch(switchItem);
    vi.advanceTimersByTime(20);
    expect([relay.energized, lamp.energized]).toEqual([true, true]);
    app.toggleSwitch(switchItem);
    vi.advanceTimersByTime(9);
    expect([relay.energized, lamp.energized]).toEqual([true, true]);
    app.toggleSwitch(switchItem);
    vi.advanceTimersByTime(20);
    expect([relay.energized, lamp.energized]).toEqual([true, true]);
    app.toggleSwitch(switchItem);
    vi.advanceTimersByTime(10);
    expect([relay.energized, lamp.energized]).toEqual([false, false]);
  });

  it('applies delays separately to relays connected in cascade', () => {
    vi.useFakeTimers();
    const { app, switchItem, relay } = timedRelayCircuit();
    const second = { id: 'r2', type: 'relay_spdt' as const, x: 0, y: 0, label: 'R2', on: false, energized: false };
    app.components.push(second);
    app.wires.push(
      { id: 'w7', from: { id: 'r', side: 'NO' }, to: { id: 'r2', side: 'A1' }, energized: false },
      { id: 'w8', from: { id: 'r2', side: 'A2' }, to: { id: 'b', side: 'left' }, energized: false },
    );
    app.runSimulation();
    app.toggleSwitch(switchItem);
    vi.advanceTimersByTime(20);
    expect([relay.energized, second.energized]).toEqual([true, false]);
    vi.advanceTimersByTime(20);
    expect(second.energized).toBe(true);
    app.toggleSwitch(switchItem);
    vi.advanceTimersByTime(10);
    expect([relay.energized, second.energized]).toEqual([false, true]);
    vi.advanceTimersByTime(10);
    expect(second.energized).toBe(false);
  });

  it('applies simultaneous transitions before reevaluating contacts', () => {
    vi.useFakeTimers();
    const { app, switchItem, relay } = timedRelayCircuit();
    const second = { id: 'r2', type: 'relay_spdt' as const, x: 0, y: 0, label: 'R2', on: false, energized: false };
    app.components.push(second);
    app.wires = app.wires.filter((wire) => wire.id !== 'w4' && wire.id !== 'w5' && wire.id !== 'w6');
    app.wires.push(
      { id: 'w7', from: { id: 's', side: 'right' }, to: { id: 'r', side: 'COM' }, energized: false },
      { id: 'w8', from: { id: 'r', side: 'NC' }, to: { id: 'r2', side: 'A1' }, energized: false },
      { id: 'w9', from: { id: 'r2', side: 'A2' }, to: { id: 'b', side: 'left' }, energized: false },
    );
    app.runSimulation();
    app.toggleSwitch(switchItem);
    vi.advanceTimersByTime(20);
    expect([relay.energized, second.energized]).toEqual([true, true]);
    vi.advanceTimersByTime(10);
    expect(second.energized).toBe(false);
  });

  it('multiplies both delays by the selected value', () => {
    vi.useFakeTimers();
    const { fixture, app, switchItem, relay } = timedRelayCircuit();
    fixture.detectChanges();
    const select = fixture.nativeElement.querySelector('select[aria-label="Relay timing multiplier"]') as HTMLSelectElement;
    for (const multiplier of [1, 10, 100, 1000]) {
      select.value = String(multiplier);
      select.dispatchEvent(new Event('change'));
      app.runSimulation();
      app.toggleSwitch(switchItem);
      vi.advanceTimersByTime(20 * multiplier - 1);
      expect(relay.energized).toBe(false);
      vi.advanceTimersByTime(1);
      expect(relay.energized).toBe(true);
      app.toggleSwitch(switchItem);
      vi.advanceTimersByTime(10 * multiplier - 1);
      expect(relay.energized).toBe(true);
      vi.advanceTimersByTime(1);
      expect(relay.energized).toBe(false);
      app.runSimulation();
    }
  });

  it('rescales a pending transition when the multiplier changes and persists the selection', () => {
    vi.useFakeTimers();
    const { fixture, app, switchItem, relay } = timedRelayCircuit();
    fixture.detectChanges();
    app.runSimulation();
    app.toggleSwitch(switchItem);
    vi.advanceTimersByTime(10);
    const select = fixture.nativeElement.querySelector('select[aria-label="Relay timing multiplier"]') as HTMLSelectElement;
    select.value = '10';
    select.dispatchEvent(new Event('change'));
    vi.advanceTimersByTime(99);
    expect(relay.energized).toBe(false);
    vi.advanceTimersByTime(1);
    expect(relay.energized).toBe(true);
    app.toggleSwitch(switchItem);
    vi.advanceTimersByTime(99);
    expect(relay.energized).toBe(true);
    vi.advanceTimersByTime(1);
    expect(relay.energized).toBe(false);
    app.saveProject();
    const restored = TestBed.createComponent(App);
    restored.detectChanges();
    expect(restored.componentInstance.relayDelayMultiplier).toBe(10);
  });

  it('cancels pending transitions when simulation stops, the circuit changes, or the editor is destroyed', async () => {
    vi.useFakeTimers();
    const { fixture, app, switchItem, relay } = timedRelayCircuit();
    app.runSimulation();
    app.toggleSwitch(switchItem);
    app.runSimulation();
    vi.advanceTimersByTime(100);
    expect(relay.energized).toBe(false);
    app.runSimulation();
    await app.fetchExample('full-adder.json');
    vi.advanceTimersByTime(100);
    expect(app.components.every((item) => !item.energized)).toBe(true);
    app.runSimulation();
    app.toggleSwitch(app.components.find((item) => item.label === 'b')!);
    fixture.destroy();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('lets an activated relay return after its battery is removed', () => {
    vi.useFakeTimers();
    const { app, switchItem, relay, lamp } = timedRelayCircuit();
    app.runSimulation();
    app.toggleSwitch(switchItem);
    vi.advanceTimersByTime(20);
    app.selected = { kind: 'component', id: 'b' };
    app.deleteSelection();
    expect([relay.energized, lamp.energized]).toEqual([true, false]);
    vi.advanceTimersByTime(9);
    expect(relay.energized).toBe(true);
    vi.advanceTimersByTime(1);
    expect(relay.energized).toBe(false);
  });

  it('creates the editor with the SPDT relay in the component library', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Relay SPDT');
    expect(fixture.nativeElement.querySelectorAll('.component-option').length).toBe(7);
  });

  it('toggles the clock output at its configured interval and stops with the simulation', () => {
    vi.useFakeTimers();
    const app = TestBed.createComponent(App).componentInstance;
    const clock = { id: 'clock', type: 'clock' as const, x: 0, y: 0, label: 'Clock', on: false, energized: false, intervalMs: 1000 };
    app.components = [clock];

    app.runSimulation();
    vi.advanceTimersByTime(999);
    expect(clock.on).toBe(false);
    vi.advanceTimersByTime(1);
    expect(clock.on).toBe(true);
    app.runSimulation();
    expect(clock.on).toBe(false);
  });

  it('handles normally open and normally closed push buttons while pressed', () => {
    const app = TestBed.createComponent(App).componentInstance;
    const no = { id: 'no', type: 'push_button_no' as const, x: 0, y: 0, label: 'NA', on: false, energized: false };
    const nc = { id: 'nc', type: 'push_button_nc' as const, x: 0, y: 0, label: 'NF', on: false, energized: false };
    app.components = [no, nc];
    app.running = true;
    const event = new PointerEvent('pointerdown');

    app.pressPushButton(event, no);
    app.pressPushButton(event, nc);
    expect(no.on).toBe(true);
    expect(nc.on).toBe(true);

    app.releasePushButton(no);
    app.releasePushButton(nc);
    expect(no.on).toBe(false);
    expect(nc.on).toBe(false);
  });

  it('loads the SPLIT/MUX network with three inputs and the sum/cout outputs', async () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    await app.fetchExample('full-adder.json');
    const inputs = app.components.filter((item) => item.type === 'switch').map((item) => item.label);
    const relays = app.components.filter((item) => item.type === 'relay_spdt').map((item) => item.label);
    const outputs = app.components.filter((item) => item.type === 'lamp').map((item) => item.label);

    expect(inputs).toEqual(['a', 'b', 'c']);
    expect(relays).toEqual(['R1', 'R2', 'R3', 'R4', 'R5']);
    expect(outputs).toEqual(['sum', 'cout']);
  });

  it('loads the MUX/SPLIT logic example with its five outputs', async () => {
    const app = TestBed.createComponent(App).componentInstance;
    await app.fetchExample('logic-gates.json');

    expect(app.projectName).toBe('Logic gates');
    expect(app.components.filter((item) => item.type === 'switch').map((item) => item.label)).toEqual(['a', 'b']);
    expect(app.components.filter((item) => item.type === 'relay_spdt').map((item) => item.label))
      .toEqual(['R1', 'R2', 'R3', 'R4']);
    expect(app.components.filter((item) => item.type === 'lamp').map((item) => item.label))
      .toEqual(['and', 'or', 'nor', 'xor', 'nand']);

    const component = (label: string) => app.components.find((item) => item.label === label);
    const wire = (from: string, fromSide: string, to: string, toSide: string) =>
      app.wires.some((item) =>
        (item.from.id === component(from)?.id && item.from.side === fromSide && item.to.id === component(to)?.id && item.to.side === toSide) ||
        (item.to.id === component(from)?.id && item.to.side === fromSide && item.from.id === component(to)?.id && item.from.side === toSide));

    expect(wire('R1', 'NO', 'b', 'right')).toBe(true);
    expect(wire('R1', 'NC', '5 V', 'left')).toBe(true);
    expect(wire('R1', 'COM', 'and', 'left')).toBe(true);
    expect(wire('R2', 'NO', '5 V', 'right')).toBe(true);
    expect(wire('R2', 'NC', 'b', 'right')).toBe(true);
    expect(wire('R2', 'COM', 'or', 'left')).toBe(true);
    expect(wire('R3', 'NO', '5 V', 'left')).toBe(true);
    expect(wire('R3', 'NC', '5 V', 'right')).toBe(true);
    expect(wire('R4', 'COM', 'R3', 'COM')).toBe(true);
    expect(wire('R4', 'NC', 'nor', 'left')).toBe(true);
    expect(wire('R4', 'NO', 'xor', 'left')).toBe(true);
  });

  it('exposes the circuit examples in the examples menu', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    const examplesButton = fixture.nativeElement.querySelector('[aria-haspopup="menu"]') as HTMLButtonElement;
    examplesButton.click();
    fixture.detectChanges();
    const entries = [...fixture.nativeElement.querySelectorAll('[role="menuitem"]')].map((item) => item.textContent.trim());
    expect(entries).toEqual(['Logic gates', 'Full adder', 'ALU 74181', 'Latch memory', 'Counter']);
  });

  it('organizes the example into input, circuit and output columns without changing connections', async () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    await app.fetchExample('full-adder.json');
    fixture.detectChanges();
    const originalWires = JSON.stringify(app.wires);
    (fixture.nativeElement.querySelector('.organize-button') as HTMLButtonElement).click();

    const centerX = (item: typeof app.components[number]) => item.x + (item.type === 'relay_spdt' ? 88 : 68);
    const inputs = app.components.filter((item) => item.type === 'switch');
    const outputs = app.components.filter((item) => item.type === 'lamp');
    const middle = app.components.filter((item) => item.type === 'relay_spdt');
    expect(Math.max(...inputs.map(centerX))).toBeLessThan(Math.min(...middle.map(centerX)));
    expect(Math.max(...middle.map(centerX))).toBeLessThan(Math.min(...outputs.map(centerX)));
    expect(Math.max(...outputs.map(centerX))).toBeLessThan(900);
    expect(JSON.stringify(app.wires)).toBe(originalWires);

    const rectangles = app.components.map((item) => {
      const width = item.type === 'relay_spdt' ? 176 : 136;
      const height = item.type === 'relay_spdt' ? 142 : 94;
      const rotated = (item.rotation ?? 0) % 180 !== 0;
      const visualWidth = (rotated ? height : width) / 2;
      const visualHeight = (rotated ? width : height) / 2;
      const x = item.x + width / 2;
      const y = item.y + height / 2;
      return { left: x - visualWidth / 2, right: x + visualWidth / 2,
        top: y - visualHeight / 2, bottom: y + visualHeight / 2 };
    });
    rectangles.forEach((rect, index) => {
      expect(rect.left).toBeGreaterThanOrEqual(0);
      expect(rect.right).toBeLessThanOrEqual(1400);
      expect(rect.top).toBeGreaterThanOrEqual(0);
      expect(rect.bottom).toBeLessThanOrEqual(850);
      rectangles.slice(index + 1).forEach((other) => {
        expect(rect.left < other.right && rect.right > other.left &&
          rect.top < other.bottom && rect.bottom > other.top).toBe(false);
      });
    });

    const layout = app.components.map((item) => [item.id, item.x, item.y, item.rotation]);
    app.arrangeComponents();
    expect(app.components.map((item) => [item.id, item.x, item.y, item.rotation])).toEqual(layout);
    app.saveProject();
    const restored = TestBed.createComponent(App);
    restored.detectChanges();
    expect(restored.componentInstance.components.map((item) => [item.id, item.x, item.y, item.rotation])).toEqual(layout);
    expect(JSON.stringify(restored.componentInstance.wires)).toBe(originalWires);
  });

  it('orients example relays according to the inferred signal flow', async () => {
    const app = TestBed.createComponent(App).componentInstance;
    await app.fetchExample('full-adder.json');
    const wires = JSON.stringify(app.wires);
    app.arrangeComponents();

    expect(Object.fromEntries(app.components.filter((item) => item.type === 'relay_spdt')
      .map((item) => [item.label, item.rotation]))).toEqual({ R1: 90, R2: 180, R3: 0, R4: 180, R5: 180 });
    expect(JSON.stringify(app.wires)).toBe(wires);
  });

  it('infers split and mux orientations independently of wire creation order', () => {
    const app = TestBed.createComponent(App).componentInstance;
    app.components = [
      { id: 's1', type: 'switch', x: 100, y: 100, label: 'S1', on: false, energized: false },
      { id: 's2', type: 'switch', x: 100, y: 500, label: 'S2', on: false, energized: false },
      { id: 'r1', type: 'relay_spdt', x: 500, y: 100, label: 'R1', on: false, energized: false, rotation: 180 },
      { id: 'r2', type: 'relay_spdt', x: 500, y: 500, label: 'R2', on: false, energized: false, rotation: 0 },
      { id: 'l1', type: 'lamp', x: 900, y: 100, label: 'L1', on: false, energized: false },
      { id: 'l2', type: 'lamp', x: 900, y: 500, label: 'L2', on: false, energized: false },
    ];
    app.wires = [
      { id: 'w1', from: { id: 'r1', side: 'COM' }, to: { id: 's1', side: 'right' }, energized: false },
      { id: 'w2', from: { id: 'l1', side: 'left' }, to: { id: 'r1', side: 'NC' }, energized: false },
      { id: 'w3', from: { id: 'r2', side: 'NO' }, to: { id: 's2', side: 'right' }, energized: false },
      { id: 'w4', from: { id: 'l2', side: 'left' }, to: { id: 'r2', side: 'COM' }, energized: false },
    ];
    app.arrangeComponents();
    expect(app.components.find((item) => item.id === 'r1')?.rotation).toBe(0);
    expect(app.components.find((item) => item.id === 'r2')?.rotation).toBe(180);
  });

  it('does not infer contact direction from coil-only connections', () => {
    const app = TestBed.createComponent(App).componentInstance;
    app.components = [
      { id: 'b', type: 'battery', x: 100, y: 100, label: 'B', on: false, energized: false },
      { id: 'r', type: 'relay_spdt', x: 500, y: 200, label: 'R', on: false, energized: false, rotation: 270 },
    ];
    app.wires = [
      { id: 'w1', from: { id: 'b', side: 'right' }, to: { id: 'r', side: 'A1' }, energized: false },
      { id: 'w2', from: { id: 'b', side: 'left' }, to: { id: 'r', side: 'A2' }, energized: false },
    ];
    app.arrangeComponents();
    expect(app.components[1].rotation).toBe(270);
  });

  it('rotates connected terminals toward each other without changing their connections', () => {
    const app = TestBed.createComponent(App).componentInstance;
    app.components = [
      { id: 's', type: 'switch', x: 100, y: 100, label: 'S', on: false, energized: false },
      { id: 'l', type: 'lamp', x: 1000, y: 100, label: 'L', on: false, energized: false },
      { id: 'b', type: 'battery', x: 100, y: 300, label: 'B', on: false, energized: false, rotation: 90 },
    ];
    app.wires = [
      { id: 'w', from: { id: 's', side: 'right' }, to: { id: 'l', side: 'right' }, energized: false },
    ];
    const wires = JSON.stringify(app.wires);
    app.arrangeComponents();

    expect(app.components[0].rotation ?? 0).toBe(0);
    expect(app.components[1].rotation).toBe(180);
    expect(app.components[2].rotation).toBe(90);
    expect(JSON.stringify(app.wires)).toBe(wires);
  });

  it('rotates vertically connected components by a quarter turn', () => {
    const app = TestBed.createComponent(App).componentInstance;
    app.components = [
      { id: 's1', type: 'switch', x: 100, y: 100, label: 'S1', on: false, energized: false },
      { id: 's2', type: 'switch', x: 100, y: 600, label: 'S2', on: false, energized: false },
    ];
    app.wires = [
      { id: 'w', from: { id: 's1', side: 'right' }, to: { id: 's2', side: 'left' }, energized: false },
    ];
    app.arrangeComponents();

    const expected = app.components[0].y < app.components[1].y ? 90 : 270;
    expect(app.components.map((item) => item.rotation)).toEqual([expected, expected]);
  });

  it('orders connected components to avoid an avoidable crossing', () => {
    const app = TestBed.createComponent(App).componentInstance;
    app.components = [
      { id: 's1', type: 'switch', x: 100, y: 100, label: 'S1', on: false, energized: false },
      { id: 's2', type: 'switch', x: 100, y: 600, label: 'S2', on: false, energized: false },
      { id: 'r1', type: 'relay_spdt', x: 600, y: 600, label: 'R1', on: false, energized: false },
      { id: 'r2', type: 'relay_spdt', x: 600, y: 100, label: 'R2', on: false, energized: false },
    ];
    app.wires = [
      { id: 'w1', from: { id: 's1', side: 'right' }, to: { id: 'r1', side: 'COM' }, energized: false },
      { id: 'w2', from: { id: 's2', side: 'right' }, to: { id: 'r2', side: 'COM' }, energized: false },
    ];
    app.arrangeComponents();

    expect((app.components[0].y - app.components[1].y) * (app.components[2].y - app.components[3].y)).toBeGreaterThan(0);
  });

  it('spreads large input and output groups across columns without overlapping rotated relays', () => {
    const app = TestBed.createComponent(App).componentInstance;
    app.components = [
      ...Array.from({ length: 12 }, (_, i) =>
        ({ id: `s${i}`, type: 'switch' as const, x: 100, y: i * 10, label: `S${i}`, on: false, energized: false })),
      ...Array.from({ length: 15 }, (_, i) =>
        ({ id: `r${i}`, type: 'relay_spdt' as const, x: 500, y: i * 10, label: `R${i}`, on: false, energized: false, rotation: 90 })),
      ...Array.from({ length: 11 }, (_, i) =>
        ({ id: `l${i}`, type: 'lamp' as const, x: 1000, y: i * 10, label: `L${i}`, on: false, energized: false })),
    ];
    app.arrangeComponents();
    const inputs = app.components.filter((item) => item.type === 'switch');
    const relays = app.components.filter((item) => item.type === 'relay_spdt');
    const outputs = app.components.filter((item) => item.type === 'lamp');

    expect(new Set(inputs.map((item) => item.x)).size).toBeGreaterThan(1);
    expect(new Set(outputs.map((item) => item.x)).size).toBeGreaterThan(1);
    expect(Math.max(...inputs.map((item) => item.x + 68))).toBeLessThan(Math.min(...relays.map((item) => item.x + 88)));
    expect(Math.max(...relays.map((item) => item.x + 88))).toBeLessThan(Math.min(...outputs.map((item) => item.x + 68)));
    for (const [index, item] of app.components.entries()) {
      const bounds = (component: typeof item) => {
        const width = component.type === 'relay_spdt' ? 176 : 136;
        const height = component.type === 'relay_spdt' ? 142 : 94;
        const rotated = (component.rotation ?? 0) % 180 !== 0;
        return { x: component.x + width / 2, y: component.y + height / 2,
          width: (rotated ? height : width) / 2, height: (rotated ? width : height) / 2 };
      };
      const first = bounds(item);
      expect(first.y - first.height / 2).toBeGreaterThanOrEqual(0);
      expect(first.y + first.height / 2).toBeLessThanOrEqual(850);
      for (const other of app.components.slice(index + 1)) {
        const second = bounds(other);
        expect(Math.abs(first.x - second.x) < (first.width + second.width) / 2 &&
          Math.abs(first.y - second.y) < (first.height + second.height) / 2).toBe(false);
      }
    }
  });

  it('does not partially move components when running or when the layout does not fit', () => {
    const app = TestBed.createComponent(App).componentInstance;
    app.components = Array.from({ length: 50 }, (_, i) =>
      ({ id: `r${i}`, type: 'relay_spdt' as const, x: 200, y: i * 10, label: `R${i}`, on: false, energized: false }));
    const before = app.components.map((item) => [item.x, item.y, item.rotation]);
    app.arrangeComponents();
    expect(app.components.map((item) => [item.x, item.y, item.rotation])).toEqual(before);
    expect(app.toastMessage).toContain('There is not enough space');
    app.running = true;
    app.arrangeComponents();
    expect(app.components.map((item) => [item.x, item.y, item.rotation])).toEqual(before);
    expect(app.toastMessage).toContain('Stop the simulation');
  });

  it('uses the input switches to drive relays and output lamps', async () => {
    vi.useFakeTimers();
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    await app.fetchExample('full-adder.json');
    const inputA = app.components.find((item) => item.type === 'switch' && item.label === 'a');
    const relay2 = app.components.find((item) => item.label === 'R2');
    const relay3 = app.components.find((item) => item.label === 'R3');
    const relay5 = app.components.find((item) => item.label === 'R5');
    const output = (name: string) => app.components.find((item) => item.type === 'lamp' && item.label === name);

    if (!inputA || !relay2 || !relay3 || !relay5 || !output('sum') || !output('cout')) {
      throw new Error('The example circuit must include input a, its relays, and output lamps.');
    }
    app.arrangeComponents();
    app.runSimulation();
    app.toggleSwitch(inputA);
    vi.advanceTimersByTime(1000);
    expect(relay2.energized).toBe(true);
    expect(relay3.energized).toBe(true);
    expect(relay5.energized).toBe(false);
    expect(output('sum')?.energized).toBe(true);
    expect(output('cout')?.energized).toBe(false);
  });

  it('evaluates all output lamps for every combination of inputs a, b and c', async () => {
    vi.useFakeTimers();
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    await app.fetchExample('full-adder.json');
    const inputs = new Map(app.components.filter((item) => item.type === 'switch').map((item) => [item.label, item]));
    const outputNames = ['sum', 'cout'];
    const outputs = new Map(app.components.filter((item) => item.type === 'lamp').map((item) => [item.label, item]));
    const inputA = inputs.get('a');
    const inputB = inputs.get('b');
    const inputC = inputs.get('c');

    if (!inputA || !inputB || !inputC || outputNames.some((name) => !outputs.has(name))) {
      throw new Error('The example circuit must expose all three inputs and both outputs.');
    }

    app.arrangeComponents();
    app.runSimulation();
    for (let mask = 0; mask < 8; mask++) {
      const a = Boolean(mask & 1);
      const b = Boolean(mask & 2);
      const c = Boolean(mask & 4);
      if (inputA.on !== a) app.toggleSwitch(inputA);
      if (inputB.on !== b) app.toggleSwitch(inputB);
      if (inputC.on !== c) app.toggleSwitch(inputC);
      vi.advanceTimersByTime(1000);

      const r2Com = a !== b;
      const expectedOutputs = {
        sum: c ? !r2Com : r2Com,
        cout: !r2Com ? a : c,
      };
      expect(Object.fromEntries(outputNames.map((name) => [name, outputs.get(name)?.energized])))
        .toEqual(expectedOutputs);
    }
  });

  it('switches R1 output from NC to NO when input b changes', async () => {
    vi.useFakeTimers();
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    await app.fetchExample('full-adder.json');
    const inputA = app.components.find((item) => item.type === 'switch' && item.label === 'a');
    const inputB = app.components.find((item) => item.type === 'switch' && item.label === 'b');
    const relay1 = app.components.find((item) => item.label === 'R1');

    if (!inputA || !inputB || !relay1) {
      throw new Error('The example circuit must include inputs a/b and relay R1.');
    }
    app.relayDelayMultiplier = 1;
    app.runSimulation();
    app.toggleSwitch(inputA);
    expect(relay1.energized).toBe(false);
    const ncDrawing = app.componentDrawing(relay1);

    app.toggleSwitch(inputB);
    vi.advanceTimersByTime(20);
    expect(relay1.energized).toBe(true);
    expect(app.componentDrawing(relay1)).not.toBe(ncDrawing);
  });

  it('continues to energize a two-terminal relay coil through a closed switch', () => {
    vi.useFakeTimers();
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    app.components = [
      { id: 'b1', type: 'battery', x: 0, y: 0, label: '24 V', on: false, energized: false },
      { id: 's1', type: 'switch', x: 0, y: 0, label: 'S1', on: false, energized: false },
      { id: 'k1', type: 'relay', x: 0, y: 0, label: 'K1', on: false, energized: false },
    ];
    app.wires = [
      { id: 'w1', from: { id: 'b1', side: 'right' }, to: { id: 's1', side: 'left' }, energized: false },
      { id: 'w2', from: { id: 's1', side: 'right' }, to: { id: 'k1', side: 'left' }, energized: false },
      { id: 'w3', from: { id: 'k1', side: 'right' }, to: { id: 'b1', side: 'left' }, energized: false },
    ];
    const switchItem = app.components.find((item) => item.type === 'switch');
    const relay = app.components.find((item) => item.type === 'relay');

    if (!switchItem || !relay) throw new Error('The simple relay circuit must include its switch and relay.');
    app.runSimulation();
    expect(relay.energized).toBe(false);
    app.toggleSwitch(switchItem);
    vi.advanceTimersByTime(19);
    expect(relay.energized).toBe(false);
    vi.advanceTimersByTime(1);
    expect(relay.energized).toBe(true);
    app.toggleSwitch(switchItem);
    vi.advanceTimersByTime(9);
    expect(relay.energized).toBe(true);
    vi.advanceTimersByTime(1);
    expect(relay.energized).toBe(false);
  });

  it('moves both coil terminals together to improve visible wiring without changing the circuit', () => {
    vi.useFakeTimers();
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    app.components = [
      { id: 'b', type: 'battery', x: 30, y: 450, label: 'Fonte', on: false, energized: false },
      { id: 's', type: 'switch', x: 700, y: 200, label: 'S', on: false, energized: false },
      { id: 'r', type: 'relay_spdt', x: 400, y: 200, label: 'R', on: false, energized: false },
    ];
    app.wires = [
      { id: 'supply', from: { id: 'b', side: 'right' }, to: { id: 's', side: 'left' }, energized: false },
      { id: 'coil', from: { id: 's', side: 'right' }, to: { id: 'r', side: 'A1' }, energized: false },
      { id: 'return', from: { id: 'b', side: 'left' }, to: { id: 'r', side: 'A2' }, energized: false },
    ];
    const relay = app.components[2];
    const endpoints = JSON.stringify(app.wires.map((wire) => [wire.from, wire.to]));
    fixture.detectChanges();

    expect(app.getPins(relay).find((pin) => pin.side === 'A1')?.x).toBe(176);
    expect(app.getPins(relay).find((pin) => pin.side === 'A2')?.x).toBe(0);
    expect(app.wirePath(app.wires[1]).endsWith('532 294.5')).toBe(true);
    expect(fixture.nativeElement.querySelector('[data-id="r"] [data-side="A1"]').style.left).toBe('176px');
    expect(fixture.nativeElement.querySelector('[data-wire-id="return"]').style.left).toBe('-25px');

    app.components[1].x = 100;
    expect(app.getPins(relay).find((pin) => pin.side === 'A1')?.x).toBe(0);
    expect(app.getPins(relay).find((pin) => pin.side === 'A2')?.x).toBe(176);
    expect(app.wirePath(app.wires[1]).endsWith('444 294.5')).toBe(true);
    expect(JSON.stringify(app.wires.map((wire) => [wire.from, wire.to]))).toBe(endpoints);

    app.runSimulation();
    expect(relay.energized).toBe(false);
    app.toggleSwitch(app.components[1]);
    vi.advanceTimersByTime(20);
    expect(relay.energized).toBe(true);
  });

  it('chooses coil sides using the rotated relay geometry', () => {
    const app = TestBed.createComponent(App).componentInstance;
    app.components = [
      { id: 'r', type: 'relay_spdt', x: 400, y: 200, label: 'R', on: false, energized: false, rotation: 90 },
      { id: 's', type: 'switch', x: 420, y: 500, label: 'S', on: false, energized: false },
    ];
    app.wires = [{ id: 'w', from: { id: 's', side: 'left' }, to: { id: 'r', side: 'A1' }, energized: false }];

    expect(app.getPins(app.components[0]).find((pin) => pin.side === 'A1')?.x).toBe(176);
    expect(app.wirePath(app.wires[0]).endsWith('464.5 315')).toBe(true);
    app.components[1].y = 50;
    expect(app.getPins(app.components[0]).find((pin) => pin.side === 'A1')?.x).toBe(0);
    expect(app.wirePath(app.wires[0]).endsWith('464.5 227')).toBe(true);
  });

  it('lets each relay pin label be edited and saves the values', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    app.components = [{ id: 'r', type: 'relay_spdt', x: 200, y: 150, label: 'Relay', on: false, energized: false }];
    fixture.detectChanges();

    const pinLabels = fixture.nativeElement.querySelectorAll('.terminal-label-input') as NodeListOf<HTMLInputElement>;
    expect(pinLabels).toHaveLength(5);
    expect((fixture.nativeElement.querySelector('[data-pin-label="COM"]') as HTMLInputElement).style.left).toBe('-2px');
    expect((fixture.nativeElement.querySelector('[data-pin-label="NC"]') as HTMLInputElement).style.left).toBe('178px');
    const label = fixture.nativeElement.querySelector('.relay-label-input') as HTMLInputElement;
    expect(label.value).toBe('Relay');
    label.value = 'K1';
    label.dispatchEvent(new Event('input'));
    expect(app.components[0].label).toBe('K1');

    const coilLabel = fixture.nativeElement.querySelector('[data-pin-label="A1"]') as HTMLInputElement;
    coilLabel.value = 'Coil In';
    coilLabel.dispatchEvent(new Event('input'));
    expect(app.components[0].pinLabels?.['A1']).toBe('Coil In');
    fixture.detectChanges();
    expect(coilLabel.size).toBe('Coil In'.length);
    app.saveProject();

    const restored = TestBed.createComponent(App);
    restored.detectChanges();
    expect((restored.nativeElement.querySelector('[data-pin-label="A1"]') as HTMLInputElement).value).toBe('Coil In');
  });

  it('creates a connection by dragging between terminals in select mode', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    app.components = [
      { id: 's', type: 'switch', x: 100, y: 100, label: 'S', on: false, energized: false },
      { id: 'l', type: 'lamp', x: 350, y: 100, label: 'L', on: false, energized: false },
    ];
    fixture.detectChanges();
    const pointerEvent = (type: string, clientX: number, clientY: number): Event => {
      const event = new MouseEvent(type, { bubbles: true, button: 0, clientX, clientY });
      Object.defineProperty(event, 'pointerId', { value: 1 });
      return event;
    };

    (fixture.nativeElement.querySelector('[data-id="s"] [data-side="right"]') as HTMLButtonElement)
      .dispatchEvent(pointerEvent('pointerdown', 150, 150));
    fixture.detectChanges();
    const preview = fixture.nativeElement.querySelector('.wire-preview') as SVGPathElement;
    const initialPreviewPath = preview.getAttribute('d');
    document.dispatchEvent(pointerEvent('pointermove', 260, 210));
    fixture.detectChanges();
    expect(preview.getAttribute('d')).not.toBe(initialPreviewPath);

    (fixture.nativeElement.querySelector('[data-id="l"] [data-side="left"]') as HTMLButtonElement)
      .dispatchEvent(pointerEvent('pointerup', 300, 150));
    fixture.detectChanges();

    expect(app.wires).toHaveLength(1);
    expect(app.wires[0]).toMatchObject({
      from: { id: 's', side: 'right' },
      to: { id: 'l', side: 'left' },
    });
    expect(app.tool).toBe('select');
    expect(fixture.nativeElement.querySelector('.wire-preview')).toBeNull();
  });

  it('moves all wires on a coil terminal together without changing their endpoints', () => {
    const app = TestBed.createComponent(App).componentInstance;
    app.components = [
      { id: 'r', type: 'relay_spdt', x: 400, y: 200, label: 'R', on: false, energized: false },
      { id: 's1', type: 'switch', x: 700, y: 150, label: 'S1', on: false, energized: false },
      { id: 's2', type: 'switch', x: 700, y: 300, label: 'S2', on: false, energized: false },
      { id: 's3', type: 'switch', x: 100, y: 200, label: 'S3', on: false, energized: false },
    ];
    app.wires = [
      { id: 'w1', from: { id: 's1', side: 'left' }, to: { id: 'r', side: 'A1' }, energized: false },
      { id: 'w2', from: { id: 's2', side: 'left' }, to: { id: 'r', side: 'A1' }, energized: false },
      { id: 'w3', from: { id: 's3', side: 'right' }, to: { id: 'r', side: 'A2' }, energized: false },
    ];

    expect(app.wirePath(app.wires[0]).endsWith('532 294.5')).toBe(true);
    expect(app.wirePath(app.wires[1]).endsWith('532 294.5')).toBe(true);
    expect(app.wirePath(app.wires[2]).endsWith('444 294.5')).toBe(true);
    expect(app.wires.map((wire) => wire.to.side)).toEqual(['A1', 'A1', 'A2']);
  });

  it('orients connected relay coils toward one another', () => {
    const app = TestBed.createComponent(App).componentInstance;
    app.components = [
      { id: 'r1', type: 'relay_spdt', x: 200, y: 200, label: 'R1', on: false, energized: false },
      { id: 'r2', type: 'relay_spdt', x: 600, y: 200, label: 'R2', on: false, energized: false },
    ];
    app.wires = [{ id: 'w', from: { id: 'r1', side: 'A1' }, to: { id: 'r2', side: 'A1' }, energized: false }];

    expect(app.getPins(app.components[0]).find((pin) => pin.side === 'A1')?.x).toBe(176);
    expect(app.getPins(app.components[1]).find((pin) => pin.side === 'A1')?.x).toBe(0);
    expect(app.wirePath(app.wires[0])).toMatch(/^M 332 294\.5 C .* 644 294\.5$/);
  });

  it('draws curved wires ending at the relay terminal coordinates', async () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    await app.fetchExample('full-adder.json');
    const relay = app.components.find((item) => item.label === 'R4');
    const lamp = app.components.find((item) => item.label === 'sum');
    const outputWire = app.wires.find((wire) => wire.from.id === relay?.id && wire.from.side === 'COM');

    if (!relay || !lamp || !outputWire) throw new Error('The example circuit must include R4 and the sum lamp.');
    const outputPin = app.getPins(relay).find((pin) => pin.side === 'COM');
    const lampPin = app.getPins(lamp).find((pin) => pin.side === 'left');

    if (!outputPin || !lampPin) throw new Error('The relay and lamp terminals must be defined.');
    const path = app.wirePath(outputWire);
    expect(path).toContain(' C ');
    expect(path.startsWith(`M ${relay.x + 132} ${relay.y + 81.5}`)).toBe(true);
    expect(path.endsWith(`${lamp.x + 34} ${lamp.y + 52.5}`)).toBe(true);
  });

  it('represents direct battery connections as polarity markers while keeping other wires visible', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    app.components = [
      { id: 'b', type: 'battery', x: 30, y: 200, label: 'Fonte', on: false, energized: false },
      { id: 's', type: 'switch', x: 250, y: 100, label: 'S', on: false, energized: false },
      { id: 'l', type: 'lamp', x: 500, y: 100, label: 'L', on: false, energized: false, rotation: 90 },
    ];
    app.wires = [
      { id: 'positive', from: { id: 'b', side: 'right' }, to: { id: 's', side: 'left' }, energized: false },
      { id: 'negative', from: { id: 'l', side: 'right' }, to: { id: 'b', side: 'left' }, energized: false },
      { id: 'normal', from: { id: 's', side: 'right' }, to: { id: 'l', side: 'left' }, energized: false },
    ];
    fixture.detectChanges();

    const positive = fixture.nativeElement.querySelector('[data-wire-id="positive"]') as HTMLButtonElement;
    const negative = fixture.nativeElement.querySelector('[data-wire-id="negative"]') as HTMLButtonElement;
    expect(positive.textContent?.trim()).toBe('+');
    expect(negative.textContent?.trim()).toBe('-');
    expect(negative.style.transform).toContain('rotate(-90deg)');
    expect(fixture.nativeElement.querySelectorAll('.wire-path').length).toBe(1);
    expect(app.wirePath(app.wires[0])).toBe('');
    expect(app.wirePath(app.wires[1])).toBe('');
    expect(app.wirePath(app.wires[2])).toContain(' C ');
    expect(fixture.nativeElement.querySelectorAll('.source-polarity').length).toBe(2);

    positive.click();
    expect(app.selected).toEqual({ kind: 'wire', id: 'positive' });
    app.deleteSelection();
    expect(app.wires.map((wire) => wire.id)).toEqual(['negative', 'normal']);
    expect(app.powerConnections(app.components[1], 'left')).toEqual([]);
    app.saveProject();
    const restored = TestBed.createComponent(App);
    restored.detectChanges();
    expect(restored.componentInstance.wires.map((wire) => wire.id)).toEqual(['negative', 'normal']);
    expect(restored.nativeElement.querySelector('[data-wire-id="negative"]')?.textContent.trim()).toBe('-');
    const loaded = restored.componentInstance;
    loaded.setTool('wire');
    loaded.handleTerminal(new MouseEvent('click'), loaded.components[1], 'left');
    loaded.handleTerminal(new MouseEvent('click'), loaded.components[0], 'right');
    expect(loaded.powerConnections(loaded.components[1], 'left').map((connection) => connection.polarity)).toEqual(['+']);
  });

  it('keeps opposite supply markers separate and leaves battery-to-battery wires visible', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    app.components = [
      { id: 'b1', type: 'battery', x: 30, y: 100, label: 'B1', on: false, energized: false },
      { id: 'b2', type: 'battery', x: 30, y: 300, label: 'B2', on: false, energized: false },
      { id: 's', type: 'switch', x: 300, y: 100, label: 'S', on: false, energized: false },
    ];
    app.wires = [
      { id: 'p', from: { id: 'b1', side: 'right' }, to: { id: 's', side: 'left' }, energized: false },
      { id: 'n', from: { id: 'b1', side: 'left' }, to: { id: 's', side: 'left' }, energized: false },
      { id: 'bb', from: { id: 'b1', side: 'right' }, to: { id: 'b2', side: 'left' }, energized: false },
    ];
    fixture.detectChanges();

    const markers = fixture.nativeElement.querySelectorAll('[data-id="s"] .power-marker') as NodeListOf<HTMLButtonElement>;
    expect([...markers].map((marker) => marker.textContent?.trim())).toEqual(['+', '-']);
    expect(markers[0].style.left).not.toBe(markers[1].style.left);
    expect(fixture.nativeElement.querySelectorAll('.wire-path').length).toBe(1);
    expect(app.powerConnection(app.wires[2])).toBeUndefined();
  });

  it('takes a local rounded detour around a component and updates when it moves', () => {
    const app = TestBed.createComponent(App).componentInstance;
    app.components = [
      { id: 's', type: 'switch', x: 50, y: 100, label: 'S', on: false, energized: false },
      { id: 'obstacle', type: 'lamp', x: 240, y: 100, label: 'O', on: false, energized: false },
      { id: 't', type: 'lamp', x: 450, y: 100, label: 'T', on: false, energized: false },
      { id: 'far', type: 'lamp', x: 1100, y: 700, label: 'F', on: false, energized: false },
    ];
    app.wires = [{ id: 'w', from: { id: 's', side: 'right' }, to: { id: 't', side: 'left' }, energized: false }];
    const wire = app.wires[0];
    const path = app.wirePath(wire);
    const tokens = path.match(/[MLC]|-?\d+(?:\.\d+)?/g);
    if (!tokens) throw new Error('The wire must have a path.');
    const samples: Array<{ x: number; y: number }> = [];
    let current = { x: 0, y: 0 };
    let firstTangent: { x: number; y: number } | undefined;
    let lastTangent: { x: number; y: number } | undefined;
    for (let index = 0; index < tokens.length;) {
      const command = tokens[index++];
      if (command === 'M') {
        current = { x: Number(tokens[index++]), y: Number(tokens[index++]) };
        samples.push(current);
      } else if (command === 'L' || command === 'C') {
        const first = { x: Number(tokens[index++]), y: Number(tokens[index++]) };
        const second = command === 'C'
          ? { x: Number(tokens[index++]), y: Number(tokens[index++]) }
          : first;
        const end = command === 'C'
          ? { x: Number(tokens[index++]), y: Number(tokens[index++]) }
          : first;
        const start = current;
        firstTangent ??= { x: first.x - start.x, y: first.y - start.y };
        const lastControl = command === 'C' ? second : start;
        lastTangent = { x: end.x - lastControl.x, y: end.y - lastControl.y };
        for (let step = 1; step <= 20; step++) {
          const t = step / 20;
          samples.push(command === 'C'
            ? { x: (1 - t) ** 3 * start.x + 3 * (1 - t) ** 2 * t * first.x +
                3 * (1 - t) * t ** 2 * second.x + t ** 3 * end.x,
              y: (1 - t) ** 3 * start.y + 3 * (1 - t) ** 2 * t * first.y +
                3 * (1 - t) * t ** 2 * second.y + t ** 3 * end.y }
            : { x: start.x + t * (end.x - start.x), y: start.y + t * (end.y - start.y) });
        }
        current = end;
      } else {
        throw new Error(`Unexpected path command: ${command}`);
      }
    }

    expect(app.wireBlocked(wire)).toBe(false);
    expect(path).toContain(' C ');
    expect(path).not.toContain(' L ');
    expect(samples.some((point) => point.x > 274 && point.x < 342 && point.y > 123.5 && point.y < 170.5)).toBe(false);
    expect(Math.max(...samples.map((point) => point.y))).toBeLessThan(250);
    expect(Math.max(...samples.map((point) => point.x))).toBeLessThanOrEqual(484);
    expect(samples[0]).toEqual({ x: 152, y: 152.5 });
    expect(samples.at(-1)).toEqual({ x: 484, y: 152.5 });
    expect(firstTangent?.y).toBe(0);
    expect(firstTangent?.x).toBeGreaterThan(0);
    expect(lastTangent?.y).toBe(0);
    expect(lastTangent?.x).toBeGreaterThan(0);

    app.components[1].y = 300;
    const updated = app.wirePath(wire);
    expect(updated).not.toBe(path);
    expect(updated).toMatch(/^M 152 152\.5 C .* 484 152\.5$/);
  });

  it('uses a continuous curve between unobstructed terminals with the correct tangents', () => {
    const app = TestBed.createComponent(App).componentInstance;
    app.components = [
      { id: 's', type: 'switch', x: 50, y: 100, label: 'S', on: false, energized: false },
      { id: 't', type: 'lamp', x: 450, y: 260, label: 'T', on: false, energized: false },
    ];
    app.wires = [{ id: 'w', from: { id: 's', side: 'right' }, to: { id: 't', side: 'left' }, energized: false }];
    const path = app.wirePath(app.wires[0]);
    const values = path.match(/-?\d+(?:\.\d+)?/g)?.map(Number);
    if (!values) throw new Error('The wire must contain a cubic Bézier curve.');

    expect(path).toMatch(/^M [^C]+ C [^L]+$/);
    expect(values).toHaveLength(8);
    const [startX, startY, control1X, control1Y, control2X, control2Y, endX, endY] = values;
    expect([startX, startY, endX, endY]).toEqual([152, 152.5, 484, 312.5]);
    expect(control1X).toBeGreaterThan(startX);
    expect(control1Y).toBe(startY);
    expect(control2X).toBeLessThan(endX);
    expect(control2Y).toBe(endY);
    expect(app.wireBlocked(app.wires[0])).toBe(false);
  });

  it('aligns the curve with terminals on rotated components', () => {
    const app = TestBed.createComponent(App).componentInstance;
    app.components = [
      { id: 's', type: 'switch', x: 50, y: 100, label: 'S', on: false, energized: false, rotation: 90 },
      { id: 't', type: 'lamp', x: 450, y: 300, label: 'T', on: false, energized: false, rotation: 90 },
    ];
    app.wires = [{ id: 'w', from: { id: 's', side: 'right' }, to: { id: 't', side: 'left' }, energized: false }];
    const values = app.wirePath(app.wires[0]).match(/-?\d+(?:\.\d+)?/g)?.map(Number);
    if (!values || values.length !== 8) throw new Error('The wire must contain one cubic Bézier curve.');

    const [startX, startY, control1X, control1Y, control2X, control2Y, endX, endY] = values;
    expect([startX, startY, endX, endY]).toEqual([112.5, 181, 512.5, 313]);
    expect(control1X).toBe(startX);
    expect(control1Y).toBeGreaterThan(startY);
    expect(control2X).toBe(endX);
    expect(control2Y).toBeLessThan(endY);
  });

  it('marks a blocked terminal visibly and recovers after moving the obstruction', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    app.components = [
      { id: 's', type: 'switch', x: 50, y: 100, label: 'S', on: false, energized: false },
      { id: 'obstacle', type: 'lamp', x: 130, y: 100, label: 'O', on: false, energized: false },
      { id: 't', type: 'lamp', x: 450, y: 100, label: 'T', on: false, energized: false },
    ];
    app.wires = [{ id: 'w', from: { id: 's', side: 'right' }, to: { id: 't', side: 'left' }, energized: false }];
    fixture.detectChanges();

    expect(app.wireBlocked(app.wires[0])).toBe(true);
    expect(fixture.nativeElement.querySelector('.wire-path.blocked title')?.textContent)
      .toContain('Move them apart');
    app.components[1].y = 300;
    expect(app.wireBlocked(app.wires[0])).toBe(false);
  });

  it('drops fixed waypoints from older saved projects', () => {
    localStorage.setItem('rele-lab-project', JSON.stringify({
      version: 1,
      components: [
        { id: 'c-1', type: 'battery', x: 80, y: 170, label: 'Battery' },
        { id: 'c-2', type: 'lamp', x: 300, y: 170, label: 'Lamp' },
      ],
      wires: [{
        id: 'w-1',
        from: { id: 'c-1', side: 'right' },
        to: { id: 'c-2', side: 'left' },
        via: [{ x: 190, y: 90 }],
      }],
    }));

    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    const wire = fixture.componentInstance.wires[0];

    if (!wire) throw new Error('The saved project must include its wire.');
    expect('via' in wire).toBe(false);
  });

  it('rotates a selected component by 90 degrees with the R key', async () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    await app.fetchExample('full-adder.json');
    fixture.detectChanges();
    const switchItem = app.components.find((item) => item.type === 'switch');
    const switchWire = app.wires.find((wire) => wire.from.id === switchItem?.id && wire.from.side === 'right');

    if (!switchItem || !switchWire) throw new Error('The example circuit must include a switch and its output wire.');
    const originalPath = app.wirePath(switchWire);
    app.selected = { kind: 'component', id: switchItem.id };
    app.onKeyDown(new KeyboardEvent('keydown', { key: 'r' }));

    expect(switchItem.rotation).toBe(90);
    expect(app.wirePath(switchWire)).not.toBe(originalPath);
    expect(app.wirePath(switchWire).startsWith(`M ${switchItem.x + 62.5} ${switchItem.y + 81}`)).toBe(true);
    const rotatedFixture = TestBed.createComponent(App);
    rotatedFixture.componentInstance.components = [switchItem];
    rotatedFixture.detectChanges();
    const componentElement = rotatedFixture.nativeElement.querySelector(`[data-id="${switchItem.id}"]`) as HTMLElement;
    expect(componentElement.style.transform).toContain('scale(0.5)');
    expect(componentElement.style.getPropertyValue('--counter-rotation')).toBe('-90deg');
  });
});

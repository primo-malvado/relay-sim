# Relay Lab

Relay circuit editor built with Angular standalone.

[Open the app on GitHub Pages](https://primo-malvado.github.io/relay-sim/) ·
[View the code on GitHub](https://github.com/primo-malvado/relay-sim)

## Development

```bash
npm install
npm start
```

Open `http://localhost:4200/`. The app stores circuits in the browser's local storage.

## GitHub Pages deployment

The workflow [.github/workflows/deploy-pages.yml](.github/workflows/deploy-pages.yml)
automatically deploys the app to GitHub Pages whenever a push is made to
`master`.

In the repository settings, open **Pages** and select **GitHub Actions** as the
deployment source. The published app is available at:
[`https://primo-malvado.github.io/relay-sim/`](https://primo-malvado.github.io/relay-sim/).

## Build and tests

```bash
npm run build
npm test
```

The editor lets you assemble circuits, connect terminals, and test basic
continuity. The component library includes switches and momentary normally-open
(NO) and normally-closed (NC) push buttons. The SPDT relay includes an A1/A2
coil and 11 (COM), 12 (NC), and 14 (NO) contacts.
The **Clock** is a periodic two-terminal pulse generator. Select it to adjust
its interval with the slider from 100 ms to 5000 ms.

The **Examples** menu includes **Full adder**, **Logic gates**, **ALU 74181**,
**Latch memory**, and **Counter**.

During simulation, relays take 20 ms to actuate and 10 ms to release. The
**Delay** selector directly multiplies both times by 1, 10, 100, or 1000, which
is useful for observing transitions. If the coil power changes before the delay
finishes, the pending transition is cancelled. Changing the multiplier during
a transition preserves the proportion of elapsed time.

With the simulation stopped, use **Arrange** to distribute switches on the
left, lamps on the right, and the remaining components between them. For SPDT
relays, the orientation follows the inferred flow from switches and positive
power toward the lamps, regardless of wire creation order. This is an
approximation and can be adjusted manually.

Connections use continuous Bézier curves whenever possible and route around
components when needed. Crossing wires do not create an electrical connection;
connections are defined by their terminals. If there is not enough room for a
route, the connection is shown as a dashed orange line; move the components to
fix it.

Direct battery connections are represented by `+` or `-` next to the terminal
instead of a wire. Click the sign to select or delete that connection. Battery
terminals also show their polarity; connections between batteries remain visible.

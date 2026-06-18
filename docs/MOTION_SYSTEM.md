# TukTukGo Motion System

This is the production motion language for the TukTukGo mobile app. It uses authentic Indian auto-rickshaw colors, flat vector geometry, compact timelines, and token-driven colors so the same assets can support light and dark themes.

## Design Tokens

Source palette: `mobile/assets/animations/auto-motion/palette.json`

Core colors:
- Auto yellow: `#F3B51B`
- Auto green: `#1F8A4C`
- Primary teal: `#43B8B3`
- Primary dark: `#339E9A`
- Text: `#17272B`
- Text secondary: `#647678`
- Success: `#22C55E`
- Error: `#EF4444`
- Purple: `#7C3AED`
- Border: `#D8E4E5`
- Surface: `#FFFFFF`

Change colors in one place by editing `mobile/scripts/generate-auto-motion-assets.mjs`, then run:

```powershell
cd mobile
node scripts\generate-auto-motion-assets.mjs
```

## Runtime Components

React Native components live in `mobile/src/components/motion`:
- `AutoMotionScene`: generic scene renderer for all states.
- `AutoMotionLoader`: reusable searching loader.
- `AutoMotionSuccess`: reusable success state.
- `AutoMotionEmptyState`: reusable empty state.
- `AutoMotionButtonLoader`: tiny auto-in-button loader.
- `MotionPressable` and `useMotionPressScale`: button press micro-interaction.
- `AUTO_MOTION_LOTTIE`: static references to the generated Lottie JSON files.

These components use existing `react-native-svg` and `Animated`, so they do not require adding native Lottie or Rive packages to existing flows. Lottie/Rive handoff details are still included below.

## Animation Specs

| ID | Purpose | Storyboard | Sequence | Timing | Lottie JSON | Rive Version | Light/Dark | Dimensions | Optimization |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `searching` | User taps Find Auto | Auto idles over road with radar and pins | Auto eases left/right; radar expands; pins fade in/out | 2.0s loop at 60 FPS | `mobile/assets/animations/auto-motion/searching-nearby-auto.json` | Artboard `SearchingNearbyAuto`; state `idle_loop`; inputs `theme`, `reduceMotion` | Light uses white/transparent; dark swaps surface/text tokens | 240x240 | Vector shapes only, no masks, no rasters |
| `matched` | Driver assigned | Auto approaches destination and success check appears | Move to pin; brake dip; check + particles | 1.6s once | `driver-match-found.json` | Artboard `DriverMatchFound`; trigger `play` | Same palette, dark ring opacity -20% | 240x240 | Single path route, restrained particles |
| `arriving` | Waiting screen | Auto follows dotted route to passenger marker | Route reveal; auto glide; passenger pin pulse | 2.5s loop | `driver-arriving.json` | Artboard `DriverArriving`; numeric `progress` | Dark route uses higher contrast border | 240x240 | Dotted route stroke, reused auto vector |
| `progress` | Active ride | Auto loops between pickup and destination | Markers fixed; route shimmer; auto travels | 2.5s loop | `ride-in-progress.json` | Artboard `RideInProgress`; numeric `routeProgress` | Same as arriving | 240x240 | No blur filters, no raster road |
| `completed` | Trip completed | Auto reaches destination and transitions to success | Arrive; success ring expands; check settles | 1.8s once | `ride-completed.json` | Artboard `RideCompleted`; trigger `complete` | Success green ring adjusts opacity in dark | 240x240 | One ring + check, no confetti burst |
| `button` | Booking button loader | Tiny auto drives inside button bounds | Auto enters, road dash scrolls, exits | 1.2s loop | `booking-button-loader.json` | Artboard `ButtonLoader`; state `button_loop` | Button fill uses primary token | 120x120 source, render 32-76 | Minimal layers for button-safe use |
| `empty` | No drivers available | Parked auto while nearby pins disappear | Pins fade sequentially; auto holds | 2.0s once/hold | `no-drivers-available.json` | Artboard `NoDrivers`; trigger `reset` | Dark keeps auto saturated, muted road | 240x240 | Hold state avoids looping distraction |
| `payment` | UPI success | Auto passes through green success ring | Ring opens; auto passes; check locks | 1.6s once | `payment-success.json` | Artboard `PaymentSuccess`; trigger `paid` | Success token unchanged | 240x240 | No UPI logo dependency; generic success |
| `location` | GPS acquisition | GPS marker with radar circles | Marker fixed; rings expand; center breathes | 2.0s loop | `detecting-location.json` | Artboard `DetectingLocation`; boolean `hasLock` | Dark rings opacity +10% for visibility | 220x220 | Only circles and pin vector |
| `splash` | App launch | Auto outline draws then fills | Outline draw; fill; wheel/lockup settle | 2.5s once | `splash-screen.json` | Artboard `Splash`; trigger `start`, event `finished` | Transparent preferred for native splash | 320x320 | Keep under 3s, no text raster |

All generated Lottie files are currently under 100KB. The largest is `searching-nearby-auto.json`, kept under 60KB.

## Micro Interactions

Use these timings consistently:

- Button press: scale `1 -> 0.97 -> 1`, spring, 120-180ms. Use `MotionPressable`.
- Ride accepted: teal pulse around status badge, 320ms, then hold.
- Ride cancelled: red shake `-4, 4, -2, 0`, 240ms, then fade affected card opacity to 0.65.
- Fare update: number crossfade + upward 4px slide, 260ms.
- ETA update: teal pill pulse + text crossfade, 240ms.
- Pull to refresh: tiny auto button loader at 32px, loop while refreshing.
- Notification arrival: card slides from top 10px with opacity `0 -> 1`, 280ms.
- Error state: red border pulse twice, 220ms each, no aggressive shake.
- Success state: success check scale `0.8 -> 1.08 -> 1`, 420ms.
- Retry action: circular arrow or auto button loader for minimum 500ms to avoid flicker.

## React Native Usage

### Expo-safe vector runtime

```jsx
import {
  AutoMotionButtonLoader,
  AutoMotionEmptyState,
  AutoMotionLoader,
  AutoMotionScene,
  AutoMotionSuccess,
  MotionPressable,
} from "@/components/motion";

export function SearchState() {
  return <AutoMotionLoader type="searching" size={220} theme="light" />;
}

export function CompletedState() {
  return <AutoMotionSuccess message="Ride completed successfully" size={220} />;
}

export function EmptyDrivers() {
  return <AutoMotionEmptyState size={220} />;
}

export function BookingButton() {
  return <AutoMotionButtonLoader />;
}

export function PressableAction({ onPress, children }) {
  return <MotionPressable onPress={onPress}>{children}</MotionPressable>;
}

export function DarkPaymentSuccess() {
  return <AutoMotionScene type="payment" theme="dark" />;
}
```

### Lottie integration

Install later when you are ready to render Lottie natively:

```powershell
cd mobile
npx expo install lottie-react-native
```

```jsx
import LottieView from "lottie-react-native";
import { AUTO_MOTION_LOTTIE } from "@/components/motion";

export function LottieAutoLoader() {
  return (
    <LottieView
      source={AUTO_MOTION_LOTTIE.searching}
      autoPlay
      loop
      resizeMode="contain"
      style={{ width: 220, height: 220 }}
    />
  );
}
```

### Rive integration

Rive is a binary authoring format, so `.riv` should be exported from the Rive editor using the state-machine specs above. Recommended artboards:

```text
SearchingNearbyAuto
DriverMatchFound
DriverArriving
RideInProgress
RideCompleted
ButtonLoader
NoDrivers
PaymentSuccess
DetectingLocation
Splash
```

Install later when adopting Rive:

```powershell
cd mobile
npx expo install rive-react-native
```

```jsx
import Rive from "rive-react-native";

export function RiveSearchingAuto() {
  return (
    <Rive
      resourceName="autoride_motion"
      artboardName="SearchingNearbyAuto"
      stateMachineName="idle_loop"
      style={{ width: 220, height: 220 }}
    />
  );
}
```

## Theme Strategy

Both Lottie and Rive should use named palette groups:
- `auto.yellow`
- `auto.green`
- `ink.primary`
- `brand.primary`
- `state.success`
- `state.error`
- `surface.default`
- `surface.dark`

For React Native SVG runtime, pass a palette override:

```jsx
<AutoMotionScene
  type="arriving"
  palette={{ primary: "#43B8B3", autoYellow: "#F3B51B" }}
/>
```

## Performance Notes

- Keep all scenes vector-only; do not embed PNGs in Lottie.
- Prefer transform and opacity animation; avoid blur, masks, trim-heavy paths, and many particles.
- Keep loop duration between 1.2s and 2.5s so it feels alive without draining battery.
- Render button loader at 32-76px and main scenes at 180-240px.
- Respect reduce-motion by setting `reduceMotion` on `AutoMotionScene`.
- Keep Lottie JSON below 100KB; current generated files meet this target.

## Unused Library/Page Cleanup

No dependency or page removal was performed as part of this motion-system pass. The existing loader component and animation asset are referenced by current auth, passenger, and driver flows. Removing packages safely requires a separate dependency audit with build/runtime verification across Android, iOS, and web.
